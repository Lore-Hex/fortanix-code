import { expect, test } from "bun:test"
import { startFortanixDesktopBridge } from "./fortanix-desktop-bridge"
import { FORTANIX_MODEL } from "./fortanix-policy"

test("desktop pins Fortanix tools and streams without a catalog or fallback", async () => {
  let calls = 0
  const bridge = await startFortanixDesktopBridge({
    readKey: async () => "test-secret",
    fetch: async (input, init) => {
      calls++
      expect(String(input)).toBe("https://api.trustedrouter.com/v1/chat/completions")
      expect(init?.redirect).toBe("error")
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe(FORTANIX_MODEL)
      expect(body.provider).toEqual({ only: ["fortanix"], allow_fallbacks: false })
      expect(body.allow_fallbacks).toBe(false)
      expect(body.tools[0].function.name).toBe("read")
      return new Response("data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } })
    },
  })
  try {
    expect([...(await bridge.models())]).toEqual([FORTANIX_MODEL])
    const response = await fetch(`${bridge.url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: FORTANIX_MODEL,
        stream: true,
        provider: { only: ["other"] },
        tools: [{ type: "function", function: { name: "read" } }],
        messages: [],
      }),
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("data: [DONE]\n\n")
    expect(calls).toBe(1)
  } finally {
    await bridge.stop()
  }
})

test("desktop rejects alternate models before reading credentials", async () => {
  const bridge = await startFortanixDesktopBridge({
    readKey: async () => {
      throw new Error("Must not read key")
    },
  })
  try {
    const response = await fetch(`${bridge.url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "nyte/confidential" }),
    })
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain("Must not read key")
  } finally {
    await bridge.stop()
  }
})

test("desktop provider errors fail closed and do not expose upstream body", async () => {
  let calls = 0
  const bridge = await startFortanixDesktopBridge({
    readKey: async () => "test-secret",
    fetch: async () => {
      calls++
      return Response.json({ error: { message: "sensitive upstream payload" } }, { status: 503 })
    },
  })
  try {
    const response = await fetch(`${bridge.url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
      body: JSON.stringify({ model: FORTANIX_MODEL }),
    })
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("sensitive upstream payload")
    expect(calls).toBe(1)
  } finally {
    await bridge.stop()
  }
})
