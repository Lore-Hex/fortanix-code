export * as ConfidentialConfig from "./confidential.js"

import { Schema } from "effect"
import { Document, Info } from "@opencode/schema/config"
import { fortanixDocument } from "./fortanix.js"

const Input = Schema.Struct({
  baseURL: Schema.String,
  token: Schema.String,
  models: Schema.Array(Schema.String),
})

// Capture once, before tools can mutate their inherited environment. This is a
// capability for the local bridge, never the user's TrustedRouter credential.
const captured = process.env.TRCC_CONFIG
const fortanix = process.env.TR_FORTANIX_CONFIG
if (captured !== undefined && fortanix !== undefined) throw new Error("Conflicting runtime capabilities")
export const enabled = captured !== undefined || fortanix !== undefined
delete process.env.TRCC_CONFIG
delete process.env.TR_FORTANIX_CONFIG

export function document(value: string) {
  const input = Schema.decodeUnknownSync(Schema.fromJsonString(Input))(value)
  const url = new URL(input.baseURL)
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.pathname !== "/v1" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(input.token) ||
    input.models.length === 0 ||
    input.models.length > 10000 ||
    !input.models.includes("nyte/confidential") ||
    input.models.some((id) => !id || id.length > 256 || /[\s\x00-\x1f]/.test(id))
  )
    throw new Error("Invalid confidential runtime capability")

  const info = Schema.decodeUnknownSync(Info)({
    model: { providerID: "trustedrouter", model: "nyte/confidential" },
    update: "disable",
    share: "disabled",
    warming: false,
    plugins: [],
    mcp: {},
    permissions: [{ action: "*", resource: "*", effect: "ask" }],
    policies: [
      { action: "provider.use", resource: "*", effect: "deny" },
      { action: "provider.use", resource: "trustedrouter", effect: "allow" },
    ],
    providers: {
      trustedrouter: {
        name: "NYTE",
        env: [],
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: url.href, apiKey: input.token, provider: "trustedrouter" },
        models: Object.fromEntries(
          input.models.map((id) => [
            id,
            {
              modelID: id,
              name: id === "nyte/confidential" ? "NYTE Confidential (automatic)" : id,
              capabilities: { tools: true },
              limit: { context: 32000, output: 8192 },
            },
          ]),
        ),
      },
    },
  })
  return new Document({ type: "document", info })
}

export function current() {
  if (fortanix !== undefined) return (cached ??= fortanixDocument(fortanix))
  if (captured === undefined) return undefined
  return (cached ??= document(captured))
}

let cached: Document | undefined

export function allows(providerID: string, modelID: string) {
  if (!enabled) return true
  return providerID === "trustedrouter" && Object.hasOwn(current()!.info.providers!.trustedrouter.models!, modelID)
}
