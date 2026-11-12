import { accountApi } from "./account-api"
import "./account.css"
import { api } from "./api"
import { createSignal, Show } from "solid-js"
import { Button } from "@opencode/ui/button"
import { useLanguage } from "@opencode/app/desktop"

export function AccountBar() {
  const language = useLanguage()
  return (
    <header class="trcc-account-bar">
      <span>{language.t("cowork.name")}</span>
      <button onClick={() => void accountApi.accountSignOut()}>{language.t("cowork.signOut")}</button>
    </header>
  )
}

export function AccountSignIn(props: { onSignedIn(): void }) {
  const language = useLanguage()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal("")
  const [key, setKey] = createSignal("")
  const [manual, setManual] = createSignal(false)
  async function submit(apiKey = false) {
    setBusy(true)
    setError("")
    try {
      if (apiKey) await accountApi.accountSaveKey(key())
      if (!apiKey) await accountApi.accountSignIn()
      setKey("")
      props.onSignedIn()
    } catch {
      setError(language.t("cowork.signInError"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main class="trcc-sign-in">
      <div class="trcc-account-content">
        <div class="trcc-wordmark" aria-hidden="true">
          {language.t("cowork.name")}
        </div>
        <h1>{language.t("cowork.name")}</h1>
        <Button size="large" onClick={() => void submit()} disabled={busy()}>
          {language.t(busy() ? "cowork.waiting" : "cowork.signIn")}
        </Button>
        <Show when={busy()}>
          <Button variant="ghost" onClick={() => void accountApi.accountCancel()}>
            {language.t("cowork.cancel")}
          </Button>
        </Show>
        <Show when={error()}>
          <p role="alert">{error()}</p>
        </Show>
        <Button variant="ghost" disabled={busy()} onClick={() => setManual(!manual())}>
          {language.t("cowork.useKey")}
        </Button>
        <Show when={manual()}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit(true)
            }}
          >
            <label for="trcc-key">{language.t("cowork.keyLabel")}</label>
            <input
              id="trcc-key"
              type="password"
              autocomplete="off"
              spellcheck={false}
              value={key()}
              onInput={(event) => setKey(event.currentTarget.value)}
              disabled={busy()}
            />
            <Button type="submit" disabled={busy() || !key().trim()}>
              {language.t("cowork.connect")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void api.openExternal("https://trustedrouter.com/console/api-keys")}
            >
              {language.t("cowork.getKey")}
            </Button>
          </form>
        </Show>
      </div>
    </main>
  )
}
