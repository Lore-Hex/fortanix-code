export const FORTANIX_MODEL = "fortanix/glm-5.3-flash"

export function fortanixRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request")
  const body = value as Record<string, unknown>
  if (body.model !== FORTANIX_MODEL) throw new Error("Only Fortanix GLM 5.3 Flash is allowed")
  if (
    body.models !== undefined ||
    body.route !== undefined ||
    body.base_url !== undefined ||
    body.previous_response_id ||
    body.conversation ||
    body.background ||
    body.store === true
  )
    throw new Error("Routing and storage overrides are unavailable")
  const { store, ...rest } = body
  return { ...rest, allow_fallbacks: false, provider: { only: ["fortanix"], allow_fallbacks: false } }
}
