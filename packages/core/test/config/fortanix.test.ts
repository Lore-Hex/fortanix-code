import { expect, test } from "bun:test"
import { fortanixDocument } from "../../src/config/fortanix"

const capability = { baseURL: "http://127.0.0.1:43210/v1", token: "x".repeat(64) }
test("Fortanix variant exposes exactly one model and requires tool approval", () => {
  const { info } = fortanixDocument(JSON.stringify({ ...capability, models: ["other/model"], permissions: [] }))
  expect(Object.keys(info.providers!)).toEqual(["trustedrouter"])
  expect(Object.keys(info.providers!.trustedrouter.models!)).toEqual(["fortanix/glm-5.3-flash"])
  expect(String(info.model?.model)).toBe("fortanix/glm-5.3-flash")
  expect(info.permissions).toEqual([{ action: "*", resource: "*", effect: "ask" }])
  expect(info.plugins).toEqual([])
  expect(info.share).toBe("disabled")
})
test.each([
  "https://api.trustedrouter.com/v1",
  "http://localhost:1234/v1",
  "http://127.0.0.1/v1",
  "http://127.0.0.1:1234/v1?x=1",
])("rejects unowned endpoint %s", (baseURL) =>
  expect(() => fortanixDocument(JSON.stringify({ ...capability, baseURL }))).toThrow(),
)
