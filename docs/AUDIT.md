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
- **Pass 4**, 2026-10-27. Updated from AltTab 11.8.0 to 11.10.1, then re-audited the merged tree: paywall residue,
  dropped declarations, Xcode project integrity, localization completeness, runtime network surface.

Off-macOS limits: all passes ran on a host without Xcode, so `npm run test:all` and `ai/build.sh` were not run
there. Swift changes are validated by CI on `main`: the Xcode 26 test gate, the Debug build and, since pass 3, an
unsigned Release compile. Pass 4 also ran without Xcode, so its Swift changes are unverified until CI compiles them.
Node tests and `npm run validate` pass. Nothing below is evidence of notarization, Gatekeeper, Sparkle update installation, Space
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
| F16 | 3 | **`main` had never compiled since the AltTab 11.8.0 merge** (`6b5ff78`). CI was red on every run: `KeyRepeatTimer` called an undefined `ticksToSeconds`, its tests called functions the merge had dropped, `ShortcutOverrideSegmented` and `ShortcutOverrideRadios` were half-converted to `ShortcutOverrideBinding` (with a leftover Pro-badge refresh), `QaSurfaces` ended a list with a stray `]`, `--qa-state` read a private `TileFontIconView.text`, `SettingsWindow` reset a Pro shine-animation flag that no longer existed, `UsageStats` used an undeclared `flushDelay`, and `NSImage.tinted` had been deleted while still in use. | Restored the key-repeat parsing (malformed values fall back to macOS defaults), rewrote both bindings on the base class, fixed the syntax and access level, removed the dead flag, declared the 5 s flush debounce and restored `tinted`. A bracket-balance sweep, an undeclared-name sweep and a pre-merge versus current declaration diff found nothing else. CI went green for the first time at `ea5f282`. |
| F17 | 3 | CI built with Xcode 16.4 (macOS 15 SDK), but 11.8.0 uses macOS 26 SDK API (`NSGlassEffectView`). | CI selects the newest installed Xcode 26 and fails clearly if there is none. The README states the requirement. |
| F18 | 3 | `test:all` crashed after a green test run: `treeHash` listed `Info.plist` and `KeyTab.entitlements` as if they were directories. | `treeHash` hashes plain files too, with a test. |
| F19 | 3 | CI never compiled the Release configuration, so Debug-only gating (`#if DEBUG`) mistakes could ship. | `npm run build:release-smoke` runs an unsigned single-architecture Release compile in CI. A scan found no Debug-only symbol used by Release code. |
| F20 | 3 | Dead code from the removed feedback and crash-report features: `DebugProfile`, its `Bash` helper, a menubar Pro badge layer, and unused helpers and symbol cases. | Removed, along with their project references. |
| F21 | 3 | The menubar glyphs were AltTab's artwork (pass 1 M4). The first KeyTab app icon was a placeholder. | New brand: a row of window tiles in which the selected tile is a keycap with ⇥, on amber to ember. The app icon and all three menubar variants are generated from code (`scripts/assets/`). `docs/BRAND.md` records the concept and palette. |
| F15 | 2 | The "AltTab runtime branding" validation matched any line with a quote, so comments containing quotes failed it. | `swiftRuntimeBrandingLines` checks only Swift string-literal content outside `//` comments, with tests. |
| F22 | 4 | KeyTab was on AltTab 11.8.0, and the owner's older builds misbehave on macOS 27.2. | Merged AltTab 11.10.1 (window tracking, focus order, tabs, thumbnails, keyboard-handling and macOS 27 fixes; guided first-launch setup; vector illustrations; -Osize). Upstream wove the Pro trial into the new onboarding popover, search-discovery bubble, QA lifecycle tooling, menubar badge and launch sequence; all of it was removed and every formerly paid feature stays free. |
| F23 | 4 | The settings illustrations were HEIC screenshots containing Apple's Sonoma wallpaper and the Finder icon (M4). | Replaced by upstream's vector SVG sources compiled into `resources/native-illustrations`. The Pro comparison scenes are not shipped. |
| F24 | 4 | The Xcode project held 50 references to files that no longer exist, and nothing checked the project file without Xcode. | Removed them; `validate.mjs` now fails on dangling file references, Swift files missing from the project or from every Sources phase, undefined or duplicate object IDs, and conflict markers (`scripts/tests/project.test.mjs`). |
| F25 | 4 | Upstream's preference migrations key on AltTab version numbers. KeyTab stamps its own version (1.0.0), so they would rerun on every launch. | Not imported; KeyTab keeps stamping `preferencesVersion` only. |
| F26 | 4 | Upstream added legacy menubar icon choices backed by artwork KeyTab doesn't ship. | Not imported. |
| F27 | 4 | Test assertion messages containing "AltTab" failed the branding scan. | Reworded. |
| F28 | 4 | M9, telemetry recorded in Release. | Recording entry points are no-ops outside Debug. |
| F29 | 4 | The search hint's speech-bubble tail pointed at the removed Pro mascot. | Plain rounded bubble. |
| F30 | 4 | No upstream sync procedure (M5) and no KeyTab changelog (M6). | `docs/UPSTREAM.md`; a KeyTab 1.0.0 section at the top of `changelog.md`. |

## Open findings

### High

- **H3 — Resolved before 0.1.0.** The Sparkle key, GPG key, notary profile and Developer ID identity are in place,
  the repository is public, and `release:preflight` passes.
- **H4 — Native verification of F6 (in progress).** The published 0.1.2 bundle's `Autoupdate`, `Updater.app` and
  `Sparkle.framework` are signed by `FYJZP8B2KG` with the hardened runtime, and an installed 0.1.1 was offered 0.1.2.
  Confirm that installing the update completes and relaunches KeyTab 0.1.2.
- **H5 — Resolved before 0.1.0.** The 11.10.1 merge compiled only after removing a dead `CGDisplayStream` path, making
  `TrackingTelemetry` types available to Release, and correcting four merged tests that had never run.

### Medium

- **M4 — Resolved in 0.1.2.** The illustrations embedded two photographs (Mount Fuji, a bowl of ramen) whose provenance upstream does not document, and they shipped in 0.1.0 and 0.1.1. Every placement is now original vector art; `resources/native-illustrations/` holds no JPEGs.
- **M8 — Vendored helper re-signing at vendor time.** `vendor/scripts/update_sparkle.sh` still re-signs the
  helpers with whatever Developer ID is in the keychain. That was AltTab's maintainer last time. Since F6 re-signs
  at release, the next Sparkle update should sign them with KeyTab's identity, or leave them ad hoc.

### Low

- **L3 — The keychain password is passed in argv** to `security` on the release host. This is a limitation of the
  `security` tool, so keep the release host single-user.
- **L4 — Vendored dependencies have no update signal.** Check Sparkle releases at least every quarter and before
  each KeyTab release.
- **L5 — Resolved in 0.1.3.** CI moved to `macos-26`: on `macos-15`, `actool` crashes compiling the Icon Composer
  `AppIcon.icon`, which failed every CI run since 0.1.1. Intel is build-only support and is not tested.
- **L6 — Nine inherited `TODO`s**, including what to do when the Debug CLI port is already taken. Triage them into
  issues.
- **L8 — The branding scan does not see multi-line (`"""`) string content.** Text inside those blocks is not
  checked for "AltTab". Extend `swiftRuntimeBrandingLines` if new multi-line user-facing strings appear.
- **L9 — Resolved in 0.1.3.** 'KeyTab on GitHub' and 'Acknowledgments are unavailable.' are translated into every
  supported language.

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
