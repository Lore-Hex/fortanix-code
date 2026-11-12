import { expect, test } from "bun:test"
import { FORTANIX_MODEL, fortanixRequest } from "./fortanix-policy"

test("pins every tool turn and preserves native tool content", () => {
  const tools = [{ type: "function", function: { name: "read_file" } }]
  const messages = [{ role: "tool", tool_call_id: "call1", content: "hello" }]
  const body = fortanixRequest({
    model: FORTANIX_MODEL,
    messages,
    tools,
    stream: true,
    allow_fallbacks: true,
    provider: { only: ["other"], allow_fallbacks: true },
  })
  expect(body).toMatchObject({
    model: FORTANIX_MODEL,
    messages,
    tools,
    stream: true,
    allow_fallbacks: false,
    provider: { only: ["fortanix"], allow_fallbacks: false },
  })
})
test.each([
  {},
  { model: "nyte/confidential" },
  { model: FORTANIX_MODEL, models: [] },
  { model: FORTANIX_MODEL, route: "auto" },
  { model: FORTANIX_MODEL, store: true },
])("rejects alternate routing or storage %j", (body) => expect(() => fortanixRequest(body)).toThrow())
