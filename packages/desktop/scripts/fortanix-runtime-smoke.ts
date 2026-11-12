import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { startConfidentialProcess } from "../src/main/service/confidential-process"
import { confidentialEnvironment } from "../src/main/confidential-runtime"
import { FORTANIX_MODEL } from "../src/main/fortanix-policy"

const root = await mkdtemp(join(tmpdir(), "fortanix-code-smoke-"))
let calls = 0
const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    assert.equal(request.headers.get("authorization"), `Bearer ${"x".repeat(64)}`)
    const body = (await request.json()) as { model: string }
    assert.equal(body.model, FORTANIX_MODEL)
    calls++
    return new Response(
      `data: ${JSON.stringify({
        id: "smoke",
        object: "chat.completion.chunk",
        created: 1,
        model: body.model,
        choices: [{ index: 0, delta: { role: "assistant", content: "PONG" }, finish_reason: "stop" }],
      })}\n\ndata: [DONE]\n\n`,
      { headers: { "content-type": "text/event-stream" } },
    )
  },
})
const { TRCC_CONFIG, ...env } = confidentialEnvironment(root, "")
let runtime: Awaited<ReturnType<typeof startConfidentialProcess>> | undefined
try {
  runtime = await startConfidentialProcess([resolve(`../cli/dist/cli-${process.platform}-${process.arch}/bin/opencode`)], {
    ...env,
    TR_FORTANIX_CONFIG: JSON.stringify({ baseURL: `http://127.0.0.1:${provider.port}/v1`, token: "x".repeat(64) }),
  })
  const read = async (path: string, body?: unknown) => {
    const url = new URL(path, runtime!.url)
    url.searchParams.set("location[directory]", root)
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        Authorization: `Basic ${Buffer.from(`opencode:${runtime!.password}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(60_000),
    })
    const text = await response.text()
    assert.ok(response.ok, `${path}: ${response.status} ${text}`)
    return text ? JSON.parse(text) : undefined
  }
  const selected = await read("/api/model/default")
  assert.equal(selected.data.id, FORTANIX_MODEL)
  assert.deepEqual(
    (await read("/api/provider")).data.map((p: { id: string }) => p.id),
    ["trustedrouter"],
  )
  assert.deepEqual(
    (await read("/api/model")).data.map((m: { id: string }) => m.id),
    [FORTANIX_MODEL],
  )
  assert.equal((await read("/api/experimental/generate", { prompt: "Reply PONG" })).data.text, "PONG")
  assert.equal(calls, 1)
  const session = await read("/api/session", { location: { directory: root } })
  const permission = await read(`/api/session/${session.data.id}/permission`, {
    action: "shell",
    resources: ["printf FORTANIX_OK"],
    save: [],
    metadata: {},
  })
  assert.equal(permission.data.effect, "ask")
  await read(`/api/session/${session.data.id}/permission/${permission.data.id}/reply`, { decision: "reject" })
  assert.deepEqual((await read(`/api/session/${session.data.id}/permission`)).data, [])
  console.log(
    "PASS compiled Fortanix runtime: one provider/model, streamed fake PONG, explicit tool permission and denial",
  )
} finally {
  await runtime?.stop()
  provider.stop(true)
  await rm(root, { recursive: true, force: true })
}
