export * as BackgroundService from "./background-service"

import { app } from "electron"
import { Context, Effect, Layer, Semaphore } from "effect"
import { confidentialAccount } from "../confidential-account"
import { confidentialEnvironment } from "../confidential-runtime"
import { setConfidentialSidecar } from "../confidential-network"
import { Shutdown } from "../lifecycle/shutdown"
import { BackgroundServiceState } from "./background-service-state"
import { DesktopCli } from "./desktop-cli"
import { SidecarCredentials } from "./sidecar-credentials"
import { startConfidentialProcess } from "./confidential-process"

export interface Interface {
  readonly connection: Effect.Effect<SidecarCredentials.Data>
  readonly reconnect: Effect.Effect<SidecarCredentials.Data>
}
export class Service extends Context.Service<Service, Interface>()("opencode/desktop/BackgroundService") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const cli = yield* DesktopCli.Service
    const shutdown = yield* Shutdown.Service
    const account = confidentialAccount()
    const lock = Semaphore.makeUnsafe(1)
    let running: Awaited<ReturnType<typeof startConfidentialProcess>> | undefined
    const stop = async () => {
      await account.signIn.cancel()
      await (await account.bridge).stop()
      await running?.stop()
    }
    yield* shutdown.add(Effect.promise(stop))
    const connect = lock.withPermit(
      Effect.gen(function* () {
        const resolved = yield* cli.resolve
        return yield* Effect.tryPromise(async () => {
          await running?.stop()
          const bridge = await account.bridge
          const { TRCC_CONFIG, ...environment } = confidentialEnvironment(app.getPath("userData"), "")
          running = await startConfidentialProcess(resolved.command, {
            ...environment,
            TR_FORTANIX_CONFIG: JSON.stringify({ baseURL: bridge.url, token: bridge.token }),
          })
          const ready = { url: running.url, password: running.password }
          setConfidentialSidecar(ready.url)
          SidecarCredentials.set(ready)
          return ready
        })
      }),
    )
    return Service.of(yield* BackgroundServiceState.make({ initial: connect, reconnect: connect.pipe(Effect.orDie) }))
  }),
)
