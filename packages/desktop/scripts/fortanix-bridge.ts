import { randomBytes, timingSafeEqual } from "node:crypto"
import { serve } from "bun"
import { TrustedRouter } from "@lore-hex/trusted-router"
import { FORTANIX_MODEL, fortanixRequest } from "../src/main/fortanix-policy"

export function startFortanixBridge(key: string) {
  const token = randomBytes(32).toString("hex")
  const client = new TrustedRouter({
    apiKey: key,
    baseUrl: "https://api.trustedrouter.com/v1",
    maxRetries: 0,
    regionalFailover: false,
    fetchImpl: (input, init) => fetch(input, { ...init, redirect: "error" }),
  })
  const server = serve({
    hostname: "127.0.0.1",
    port: 0,
    maxRequestBodySize: 8 * 1024 * 1024,
    idleTimeout: 255,
    async fetch(request) {
      const actual = Buffer.from(request.headers.get("authorization") ?? "")
      const expected = Buffer.from(`Bearer ${token}`)
      const fail = (status: number, message: string) =>
        Response.json({ error: { message } }, { status, headers: { "cache-control": "no-store" } })
      if (request.headers.has("origin") || actual.length !== expected.length || !timingSafeEqual(actual, expected))
        return fail(401, "Unauthorized")
      const path = new URL(request.url).pathname
      if (request.method === "GET" && path === "/v1/models")
        return Response.json({ object: "list", data: [{ id: FORTANIX_MODEL, object: "model" }] })
      if (request.method !== "POST" || path !== "/v1/chat/completions") return fail(404, "Unsupported endpoint")
      let body
      try {
        body = fortanixRequest(await request.json())
      } catch {
        return fail(400, "Only the pinned Fortanix route is available")
      }
      try {
        const result = await client.rawRequest("POST", "/chat/completions", {
          body,
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(600_000)]),
        })
        if (!result.ok) {
          await result.body?.cancel()
          return fail(result.status, `Fortanix request failed (HTTP ${result.status}); no fallback attempted`)
        }
        return new Response(result.body, {
          headers: {
            "content-type": result.headers.get("content-type") ?? "application/json",
            "cache-control": "no-store",
          },
        })
      } catch {
        return fail(502, "Fortanix unavailable; no fallback attempted")
      }
    },
  })
  return { url: `http://127.0.0.1:${server.port}/v1`, token, stop: () => server.stop(true) }
}
