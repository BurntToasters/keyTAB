# KeyTab long-term audit

Living record of whole-codebase audits. Each pass lists what it fixed and what remains open, so later passes
and upstream merges can check against it.

- **Pass 1**, 2026-10-04, against `5132287`. Covered release and build scripts, CI, bundle configuration, the
  runtime network and IPC surface, paywall residue, branding, licensing, platform-compatibility code and
  documentation drift.
- **Pass 2**, 2026-10-04, against `16ec005`. Added Swift runtime behavior (logging, crash handling, subprocesses,
  threading hazards, the update policy), localization completeness, vendored binary signatures, and a re-check of
  every pass 1 item.
- **Pass 3**, 2026-10-04, against `25da2aa`. Ran the first CI build in this repository's history that got past
  compilation, and used its compiler output as a source of findings. Also covered merge leftovers, dead code,
  Debug-only symbol leakage into Release, and the brand artwork.

Off-macOS limits: all passes ran on a host without Xcode, so `npm run test:all` and `ai/build.sh` were not run
there. Swift changes are validated by CI on `main`: the Xcode 26 test gate, the Debug build and, since pass 3, an
unsigned Release compile. Node tests and
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
| F16 | 3 | **`main` had never compiled since the AltTab 11.8.0 merge** (`6b5ff78`). CI was red on every run: `KeyRepeatTimer` called an undefined `ticksToSeconds`, its tests called functions the merge had dropped, `ShortcutOverrideSegmented` and `ShortcutOverrideRadios` were half-converted to `ShortcutOverrideBinding` (with a leftover Pro-badge refresh), and `QaSurfaces` ended a list with a stray `]`. | Restored the key-repeat parsing (malformed values fall back to macOS defaults), rewrote both bindings on the base class, and fixed the syntax. A bracket-balance sweep of every Swift file found nothing else. |
| F17 | 3 | CI built with Xcode 16.4 (macOS 15 SDK), but 11.8.0 uses macOS 26 SDK API (`NSGlassEffectView`). | CI selects the newest installed Xcode 26 and fails clearly if there is none. The README states the requirement. |
| F18 | 3 | `test:all` crashed after a green test run: `treeHash` listed `Info.plist` and `KeyTab.entitlements` as if they were directories. | `treeHash` hashes plain files too, with a test. |
| F19 | 3 | CI never compiled the Release configuration, so Debug-only gating (`#if DEBUG`) mistakes could ship. | `npm run build:release-smoke` runs an unsigned single-architecture Release compile in CI. A scan found no Debug-only symbol used by Release code. |
| F20 | 3 | Dead code from the removed feedback and crash-report features: `DebugProfile`, its `Bash` helper, a menubar Pro badge layer, and unused helpers and symbol cases. | Removed, along with their project references. |
| F21 | 3 | The menubar glyphs were AltTab's artwork (pass 1 M4). The first KeyTab app icon was a placeholder. | New brand: a row of window tiles in which the selected tile is a keycap with ⇥, on amber to ember. The app icon and all three menubar variants are generated from code (`scripts/assets/`). `docs/BRAND.md` records the concept and palette. |
| F15 | 2 | The "AltTab runtime branding" validation matched any line with a quote, so comments containing quotes failed it. | `swiftRuntimeBrandingLines` checks only Swift string-literal content outside `//` comments, with tests. |

## Open findings

### High

- **H3 — Release prerequisites (blocked on owner).**
  - `SPARKLE_PUBLIC_KEY` is empty in `config/base.xcconfig`. Follow "One-time Sparkle setup" in
    `docs/RELEASING.md`.
  - The KeyTab GPG key, notary profile and Developer ID identity for team `FYJZP8B2KG` must be supplied.
  - The repository must be public.
  - `node scripts/validate.mjs --release` fails only on the Sparkle key.
- **H4 — Native verification of F6 (blocked on owner).** Run `npm run release:mac` on a Mac with the Developer ID,
  then install an older signed build and let Sparkle update it. Confirm that `Autoupdate` launches (Sparkle's
  installer validates the helpers' signatures against the host app).

### Medium

- **M4 — The settings illustrations carry third-party artwork.** `resources/illustrations/*.heic` are AltTab-era
  screenshots of the switcher. They show no AltTab branding, but they do include Apple's Sonoma wallpaper and the
  Finder icon, which upstream could not license under GPL-3.0. Re-shoot them from KeyTab on a Mac over a neutral
  or KeyTab-palette background with KeyTab-owned sample windows, then update `docs/ASSET_LICENSES.md`.
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
