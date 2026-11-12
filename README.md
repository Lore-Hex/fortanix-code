# Fortanix Code

An OpenCode coding agent pinned to **GLM 5.3 Flash on Fortanix through TrustedRouter**.

Every model request uses `fortanix/glm-5.3-flash` at `https://api.trustedrouter.com/v1`,
with `provider.only: ["fortanix"]` and `allow_fallbacks: false`. Other models and
providers are rejected. Native tool calls and streaming are preserved.

Fortanix Code includes a separate desktop app and terminal launcher. The desktop
uses its own `com.trustedrouter.fortanixcode` application identity and profile,
browser sign-in, OS-encrypted credentials, and explicit tool approvals. It does
not replace Trusted Cowork or read its saved credentials. Desktop version
`0.1.0-alpha.1` is undergoing signing and notarization; only verified artifacts
will be published as downloads.

## Run Fortanix Code

Currently built locally on Apple Silicon macOS. Requires Python 3, Bun 1.4.2 on
PATH, and Node 24 or newer for development.

```sh
bun install --frozen-lockfile
cd packages/cli
bun run script/build.ts --single --skip-install --skip-web-ui
cd ../..
python3 fortanix-code.py
```

Enter your TrustedRouter key at the hidden prompt. It is not saved or bundled.
The bridge retains the key; OpenCode receives a temporary local capability.
The profile is separate at `~/.local/share/fortanix-code`. Local tools require
approval. Approved shell commands can access files and the network: this is not
an operating-system sandbox.

## Fortanix Privacy and Verification

The current route is advertised as zero data retention, **not verified E2EE
confidential inference**. Source files selected for review go through
TrustedRouter to Fortanix. Do not interpret this variant as offering the
confidential-route guarantee described in the legacy desktop documentation below.

On November 12, 2026, a live native-tool call and tool-result follow-up succeeded
on this exact model. Both calls reported one Fortanix candidate and zero
fallbacks, despite the catalog advertising no tools. This does not establish
reliability for every coding task.

## Legacy Trusted Cowork Desktop

The following documents the separate base product, not this Fortanix variant.

A macOS desktop agent built on OpenCode, using confidential models through TrustedRouter.

Sign in with TrustedRouter in your browser or add an API key. The default model is
`trustedrouter/confidential`. You can select qualified confidential models by name.
Every inference request requires confidential routing and denies data collection.
There is no fallback to another inference backend.

Local tools require permission. Conversations are stored on your Mac. This is not
an OS sandbox: approved tools can access files and the network.

See [security boundaries and release checks](TRUSTED-COWORK.md). The app uses HTTPS
and gateway confidential-route enforcement; it does not independently verify the
client TLS socket through attestation.

## Downloads

Use the signed macOS packages linked from [TrustedRouter](https://trustedrouter.com/confidential-cowork).
Updates are manual. Windows and Linux packages are not released for this version.

## Development

Requires Bun 1.4.2 and Node 24 or newer. Ensure Bun 1.4.2 is also first on PATH
because build and test subprocesses invoke `bun`.

```sh
bun install --frozen-lockfile
bun run check
cd packages/cli
OPENCODE_CHANNEL=prod OPENCODE_VERSION=0.4.0-alpha.2 bun run script/build.ts --single --baseline --skip-install --skip-web-ui
cd ../desktop
bun typecheck
bun test src/main electron-builder.config.test.ts --timeout 30000
OPENCODE_CHANNEL=prod OPENCODE_CLI_DIST=../cli/dist bun run build
bun scripts/confidential-runtime-smoke.ts
bun scripts/confidential-desktop-smoke.ts
```

The main process uses `@lore-hex/trusted-router` with `https://api.confidential.trustedrouter.com/v1`.
Only it can decrypt the stored API key. The bundled runtime receives a scoped
local capability, not the real key. Browser authorization uses `https://trustedrouter.com`.

## Attribution

Based on OpenCode 2.0.32, upstream commit `4745089e365ed1a9cdfec8eb831ab8a4efe92d78`.
The [upstream README](README.upstream.md) and [MIT license](LICENSE) are retained.
Upstream workflows are archived under `.github/upstream-workflows` and do not execute
in this repository.
