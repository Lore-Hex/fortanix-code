import { join, resolve } from "node:path"
import { homedir } from "node:os"
import { spawn } from "node:child_process"
import { startFortanixBridge } from "./fortanix-bridge"
import { confidentialEnvironment } from "../src/main/confidential-runtime"

const key = process.env.TR_FORTANIX_API_KEY
delete process.env.TR_FORTANIX_API_KEY
if (!key) throw new Error("Use the fortanix-code.py launcher to enter your key privately")
const bridge = startFortanixBridge(key)
const root = join(homedir(), ".local/share/fortanix-code")
const { TRCC_CONFIG, ...env } = confidentialEnvironment(root, "")
const binary = resolve(import.meta.dirname, "../../cli/dist/cli-darwin-arm64/bin/opencode")
const child = spawn(binary, process.argv.slice(2), {
  stdio: "inherit",
  env: {
    ...process.env,
    ...env,
    TR_FORTANIX_CONFIG: JSON.stringify({ baseURL: bridge.url, token: bridge.token }),
  },
})
child.once("error", () => {
  bridge.stop()
  process.exitCode = 1
})
child.once("exit", (code) => {
  bridge.stop()
  process.exitCode = code ?? 1
})
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    child.kill(signal)
    bridge.stop()
  })
