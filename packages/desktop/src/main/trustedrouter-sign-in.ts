import { timingSafeEqual } from "node:crypto"
import { createServer } from "node:http"
import { TrustedRouter } from "@lore-hex/trusted-router"

export class TrustedRouterSignIn {
  private pending?: Promise<void>
  private controller?: AbortController

  constructor(
    private readonly options: {
      openBrowser(url: string): Promise<void>
      saveKey(key: unknown): Promise<void>
      fetch?: typeof fetch
      port?: number
      timeoutMs?: number
    },
  ) {}

  start() {
    if (this.pending) return this.pending
    const controller = new AbortController()
    this.controller = controller
    this.pending = this.run(controller.signal).finally(() => {
      this.pending = undefined
      this.controller = undefined
    })
    return this.pending
  }

  async cancel() {
    this.controller?.abort()
    await this.pending?.catch(() => {})
  }

  private async run(cancel: AbortSignal) {
    const signal = AbortSignal.any([cancel, AbortSignal.timeout(this.options.timeoutMs ?? 300_000)])
    const client = new TrustedRouter({
      controlBaseUrl: "https://trustedrouter.com/v1",
      maxRetries: 0,
      fetchImpl: (input, init) =>
        (this.options.fetch ?? fetch)(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        }),
    })
    const server = createServer()
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject)
        server.listen(this.options.port ?? 3000, "127.0.0.1", () => resolve())
      })
      signal.throwIfAborted()
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("Sign-in unavailable")
      const host = `127.0.0.1:${address.port}`
      const callback = new URL(`http://${host}/trcc/oauth`)
      const authorization = await new TrustedRouter({
        controlBaseUrl: "https://trustedrouter.com",
      }).createOAuthAuthorization({ callbackUrl: callback.href, keyLabel: "Fortanix Code" })
      const expected = Buffer.from(authorization.state ?? "")
      const code = await new Promise<string>((resolve, reject) => {
        const abort = () => reject(new Error("Sign-in cancelled or timed out"))
        signal.addEventListener("abort", abort, { once: true })
        let consumed = false
        server.on("request", (request, response) => {
          response.setHeader("Cache-Control", "no-store")
          response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
          response.setHeader("Referrer-Policy", "no-referrer")
          response.setHeader("Content-Type", "text/plain; charset=utf-8")
          const url = URL.parse(request.url ?? "/", callback.origin)
          const state = Buffer.from(url?.searchParams.get("state") ?? "")
          if (
            consumed ||
            request.method !== "GET" ||
            request.headers.host !== host ||
            !url ||
            url.origin !== callback.origin ||
            url.pathname !== callback.pathname ||
            url.searchParams.getAll("state").length !== 1 ||
            !expected.length ||
            state.length !== expected.length ||
            !timingSafeEqual(state, expected)
          ) {
            response.writeHead(400).end("Invalid sign-in callback")
            return
          }
          consumed = true
          const value = url.searchParams.get("code")
          if (
            url.searchParams.has("error") ||
            !value ||
            value.length > 4096 ||
            url.searchParams.getAll("code").length !== 1
          ) {
            response.writeHead(400).end("Sign-in was not approved")
            reject(new Error("Sign-in was not approved"))
            return
          }
          response.end("Return to Fortanix Code. You can close this tab.")
          signal.removeEventListener("abort", abort)
          resolve(value)
        })
        void this.options.openBrowser(authorization.url).catch(() => reject(new Error("Could not open browser")))
      })
      signal.throwIfAborted()
      const result = await client.exchangeOAuthKey({
        code,
        codeVerifier: authorization.codeVerifier,
        codeChallengeMethod: "S256",
        timeout: 15_000,
      })
      signal.throwIfAborted()
      await this.options.saveKey(result.key)
    } catch {
      throw new Error("Sign-in could not be completed. Close any app using port 3000, then try again.")
    } finally {
      server.close()
      server.closeAllConnections()
    }
  }
}
