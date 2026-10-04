# KeyTab long-term audit

Living record of whole-codebase audits. Each pass lists what it fixed and what remains open, so later passes
and upstream merges can check against it.

- **Pass 1**, 2026-10-04, against `5132287`. Covered release and build scripts, CI, bundle configuration, the
  runtime network and IPC surface, paywall residue, branding, licensing, platform-compatibility code and
  documentation drift.
- **Pass 2**, 2026-10-04, against `16ec005`. Added Swift runtime behavior (logging, crash handling, subprocesses,
  threading hazards, the update policy), localization completeness, vendored binary signatures, and a re-check of
  every pass 1 item.

Off-macOS limits: both passes ran on a host without Xcode, so `npm run test:all` and `ai/build.sh` were not run
there. The Swift changes from pass 2 are validated by CI's compile and test run on `main`. Node tests and
`npm run validate` pass. Nothing below is evidence of notarization, Gatekeeper, Sparkle update installation, Space
or multi-display behavior, Intel behavior, or macOS 26 behavior.

## Fixed

| ID | Pass | Finding | Fix |
| --- | --- | --- | --- |
| F1 | 1 | Release preflight compared the origin URL case-sensitively against `BurntToasters/KeyTab`. The real clone URL is `https://github.com/BurntToasters/keyTAB`, so every release preflight failed. | `isCanonicalOrigin` matches HTTPS or SSH GitHub URLs for the repository case-insensitively, as GitHub does. Forks, other owners, other hosts and suffix tricks are still rejected. |
| F2 | 1 | Beta builds read `releases/latest/download/appcast-beta.xml`, which existed only on the stable release that was latest when the beta shipped. After the next stable release, beta installs got a 404 and were never offered the new stable build. | Every stable release also uploads a GPG-signed copy of `appcast.xml` as `appcast-beta.xml`. A later beta publish replaces it. The copy is left out of `SHA256SUMS`. |
| F3 | 1 | A beta publish mirrored whatever `dist/appcast-beta.xml` was on disk. | Publish refuses a beta feed that does not name `KeyTab-<version>.zip`. |
| F4 | 1 | `mac-keychain-ssh.sh` defaulted to `$USER/Library/…`, a relative path. | Uses `$HOME`. |
| F5 | 2 | **The local CLI port was unauthenticated in Release builds** (pass 1 H1). Any same-user process could read every window title through KeyTab's Screen Recording and Accessibility grants, or inject faults such as `--qa-stall-main=` and `--qa-mute-ax-destroys=`. | `CliEvents`, `CliServer` and `CliClient` compile only in Debug builds. Shipped KeyTab exposes no command interface. The QA and E2E port remains in Debug. |
| F6 | 2 | **The vendored Sparkle helpers carry the AltTab maintainer's Developer ID** (`Louis Pontoise (QXD7GW8FHY)`). The release build signed the app with `codesign --deep`, which does not reach `Versions/A/Updater.app` or `Autoupdate`, so releases would have shipped code signed by another team (pass 1 H2). | `signRelease` signs inside-out without `--deep`: `Autoupdate`, `Updater.app`, `Sparkle.framework`, then the app, each with hardened runtime and a timestamp. The app's entitlements apply to the app only. Release validation walks every Mach-O in the bundle and fails unless each is signed by `FYJZP8B2KG`. |
| F7 | 2 | Paywall vestiges (pass 1 M1): `SearchDiscoveryPolicy.Access` trial/pro/locked tiers and the always-false `optedOut`; the `QaSurfaces` license field and `--qa-license`; Pro-prompt comments; and the dead `EmailLineWrap` (left over from the removed upgrade button). | Removed, along with their tests, project references and comments. The search-hint QA preview had lost its menu entry when the Pro section went, so it is back as "Show search hint next session" in the QA menu. |
| F8 | 2 | Specs described removed paywall behavior (pass 1 M2). | `SearchDiscovery`, `SearchModeResolver`, `SearchFieldEditing`, `OnActionExtension` and `PreferencesMigrations` specs were rewritten to match the code. `SidebarList`, `UsageStatsMessage` and `EmailLineWrap` specs, whose code is gone, were deleted. |
| F9 | 2 | A third-party RescueTime help URL was in the permissions log, and that message named only Accessibility (pass 1 M3). | Message rewritten without the link, and it now names both permissions. |
| F10 | 2 | Compatibility paths for macOS 13 and older remained (pass 1 L1). | Removed the `#available(macOS 13)` branch, the `@available(macOS 12.3/14.0)` annotations and the redundant `#available(macOS 14.0)` check. |
| F11 | 2 | `.periphery.yml` excluded a path that no longer exists (pass 1 L2). | It now excludes the two `@_silgen_name` declaration files. |
| F12 | 2 | Upstream issue numbers read as KeyTab issues (pass 1 M7). | 459 references in 130 source and spec files are now `AltTab #NNNN`. |
| F13 | 2 | The pass 1 fixture rename had turned three upstream issue URLs into `github.com/keytab/alt-tab-macos/…`. | Restored to `github.com/lwouis/alt-tab-macos/…`. |
| F14 | 2 | The `crashReportsQueue` left over from AppCenter crash reporting was never started. | Removed. |
| F15 | 2 | The "AltTab runtime branding" validation matched any line with a quote, so comments containing quotes failed it. | `swiftRuntimeBrandingLines` checks only Swift string-literal content outside `//` comments, with tests. |

## Open findings

### High

- **H3 — Release prerequisites (blocked on owner).**
  - `SPARKLE_PUBLIC_KEY` is empty in `config/base.xcconfig`. Generate the key pair with Sparkle 2.9.1's
    `bin/generate_keys` from the upstream release tarball. The vendor script drops that tool. The private key goes
    in the login keychain under account `ed25519`, so set `KEYTAB_SPARKLE_ACCOUNT=ed25519`.
  - The KeyTab GPG key, notary profile and Developer ID identity for team `FYJZP8B2KG` must be supplied.
  - The repository must be public.
  - `node scripts/validate.mjs --release` fails only on the Sparkle key.
- **H4 — Native verification of F6 (blocked on owner).** Run `npm run release:mac` on a Mac with the Developer ID,
  then install an older signed build and let Sparkle update it. Confirm that `Autoupdate` launches (Sparkle's
  installer validates the helpers' signatures against the host app).

### Medium

- **M4 — Remaining upstream artwork.** `resources/icons/menubar/menubar-*.pdf` is AltTab's menubar glyph, and
  `resources/illustrations/**` are AltTab-era renders. Replace the glyph with a template image that matches the
  keycap app icon (`scripts/assets/generate-icon.mjs`).
- **M5 — No upstream sync procedure.** Add `docs/UPSTREAM.md`. It should cover how to diff upstream tags and which
  paths are always dropped (`src/pro`, `src/api`, AppCenter, the license URL scheme, release-build CLI exposure).
  It should run `npm run validate` plus the residue greps, prefix new upstream issue numbers as `AltTab #`, and
  update the base version together in `NOTICE.md`, `README.md`, `AboutTab.swift`, `AGENTS.md` and
  `validate.mjs`.
- **M6 — KeyTab has no changelog of its own.** `changelog.md` is upstream history kept for provenance. Add a
  KeyTab section for KeyTab releases.
- **M8 — Vendored helper re-signing at vendor time.** `vendor/scripts/update_sparkle.sh` still re-signs the
  helpers with whatever Developer ID is in the keychain. That was AltTab's maintainer last time. Since F6 re-signs
  at release, the next Sparkle update should sign them with KeyTab's identity, or leave them ad hoc.
- **M9 — Tracking telemetry still records in Release builds**, into a bounded in-memory ring (`TelemetryRing`)
  that only the Debug-only `--qa-telemetry` command drains. It is local and capped, with no network, but it is
  wasted work. Gate the recorder's entry points under `#if DEBUG` or a cheap static flag.

### Low

- **L3 — The keychain password is passed in argv** to `security` on the release host. This is a limitation of the
  `security` tool, so keep the release host single-user.
- **L4 — Vendored dependencies have no update signal.** Check Sparkle releases at least every quarter and before
  each KeyTab release.
- **L5 — CI runs only on `macos-15` arm64.** Adding a `macos-26` job is cheap. Intel stays a manual release check.
- **L6 — Nine inherited `TODO`s**, including what to do when the Debug CLI port is already taken. Triage them into
  issues.
- **L8 — The branding scan does not see multi-line (`"""`) string content.** Text inside those blocks is not
  checked for "AltTab". Extend `swiftRuntimeBrandingLines` if new multi-line user-facing strings appear.

## Verified clean (pass 2)

- **Network:** the only runtime URLs are the KeyTab repository link and the Sparkle feed. There is no
  `URLSession`, telemetry upload or crash upload. Updates are user-controlled in General settings (manual,
  periodic check, or auto-install), and Sparkle system profiling is off.
- **Logging and subprocesses:** `Logger` writes to stdout only, never to a file. Subprocess use is limited to
  `open`, `hdiutil`, a quoted relaunch script in `MoveToApplicationsFolder`, and the Debug profile's `top` call.
  None of them interpolates untrusted input unquoted.
- **Threading:** `DispatchQueue.main.sync` remains only behind `Thread.isMainThread` guards (`AXUIElement`,
  `CGEvent.toNSEvent`) and in the Debug-only CLI.
- **Localization:** the 202 keys match between the base and `en` tables, every key is used in Swift, no
  translation carries orphan keys, and no table contains Pro, trial, license, upgrade or "AltTab" strings.
- **Identity and licensing:**
  - Bundle ID, minimum macOS, hardened runtime, no URL scheme and library validation are all asserted by
    `validate.mjs`.
  - Secrets travel over stdin, and child processes get secrets stripped.
  - CI is read-only, with no secrets and no publishing.
  - The licence and notice files are present, and the app icon is original KeyTab artwork.
