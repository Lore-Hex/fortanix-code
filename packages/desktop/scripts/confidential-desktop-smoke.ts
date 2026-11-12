import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { _electron as electron } from "@playwright/test"

const root = await mkdtemp(join(tmpdir(), "trusted-cowork-desktop-smoke-"))
const app = await electron.launch({
  args: [resolve(".")],
  env: {
    ...process.env,
    OPENCODE_DESKTOP_TEST_ROOT: root,
    OPENCODE_DESKTOP_DISABLE_PROTOCOL_REGISTRATION: "1",
  },
  timeout: 30_000,
})
try {
  const page = await app.firstWindow()
  await page.getByRole("button", { name: "Sign in", exact: true }).waitFor()
  assert.equal(await page.title(), "Fortanix Code")
  assert.equal(
    await page.locator(".trcc-sign-in").evaluate((node) => getComputedStyle(node).getPropertyValue("-webkit-app-region")),
    "drag",
    "the frameless sign-in background must let users move the window",
  )
  assert.equal(
    await page.locator(".trcc-account-content").evaluate((node) => getComputedStyle(node).getPropertyValue("-webkit-app-region")),
    "no-drag",
    "sign-in controls must remain clickable",
  )
  await page.getByRole("button", { name: "Use an API key", exact: true }).click()
  await page.getByLabel("NYTE / TrustedRouter API key", { exact: true }).waitFor()
  await page.getByLabel("NYTE / TrustedRouter API key", { exact: true }).fill("test-only-not-a-real-key")
  assert.equal(await page.getByLabel("NYTE / TrustedRouter API key", { exact: true }).inputValue(), "test-only-not-a-real-key")
  assert.equal(await page.locator(".trcc-wordmark").innerText(), "Fortanix Code")
  const blocked = await page.evaluate(async () => {
    const denied: boolean[] = []
    for (const url of ["https://example.com/", "file:///etc/hosts", "http://127.0.0.1:1/", "oc://extensions/test.js"]) {
      try {
        await fetch(url)
        denied.push(false)
      } catch {
        denied.push(true)
      }
    }
    return denied
  })
  assert.deepEqual(blocked, [true, true, true, true])
  console.log("PASS: desktop sign-in renders, API-key fallback opens, renderer network stays restricted")
} finally {
  await app.close()
  await rm(root, { recursive: true, force: true })
}
