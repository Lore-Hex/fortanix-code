import { join } from "node:path"
import { app, safeStorage, shell } from "electron"
import { CredentialVault } from "./credential-vault"
import { startFortanixDesktopBridge } from "./fortanix-desktop-bridge"
import { TrustedRouterSignIn } from "./trustedrouter-sign-in"

let account: ReturnType<typeof create> | undefined

function create() {
  const vault = new CredentialVault(join(app.getPath("userData"), "trustedrouter.credential"), safeStorage)
  const bridge = startFortanixDesktopBridge({ readKey: () => vault.read() })
  const signIn = new TrustedRouterSignIn({
    openBrowser: (url) => shell.openExternal(url),
    saveKey: async (key) => {
      ;(await bridge).invalidate()
      await vault.save(key)
    },
  })
  return { vault, bridge, signIn }
}

export function confidentialAccount() {
  account ??= create()
  return account
}
