import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "Fortanix Code Dev",
  beta: "Fortanix Code Beta",
  prod: "Fortanix Code",
}

const appIDs: Record<string, string> = {
  dev: "com.trustedrouter.fortanixcode.dev",
  beta: "com.trustedrouter.fortanixcode.beta",
  prod: "com.trustedrouter.fortanixcode",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "Fortanix Code Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "com.trustedrouter.fortanixcode.dev"
