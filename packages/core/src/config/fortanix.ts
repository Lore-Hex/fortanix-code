import { Schema } from "effect"
import { Document, Info } from "@opencode/schema/config"

export function fortanixDocument(value: string) {
  const input = Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Struct({ baseURL: Schema.String, token: Schema.String })),
  )(value)
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
    !/^[A-Za-z0-9_-]{32,256}$/.test(input.token)
  )
    throw new Error("Invalid Fortanix runtime capability")
  const model = "fortanix/glm-5.3-flash"
  return new Document({
    type: "document",
    info: Schema.decodeUnknownSync(Info)({
      model: { providerID: "trustedrouter", model },
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
          name: "Fortanix Code",
          env: [],
          package: "@opencode/ai/providers/openai-compatible",
          settings: { baseURL: url.href, apiKey: input.token, provider: "trustedrouter" },
          models: {
            [model]: {
              modelID: model,
              name: "GLM 5.3 Flash (Fortanix)",
              capabilities: { tools: true },
              limit: { context: 131072, output: 16384 },
            },
          },
        },
      },
    }),
  })
}
