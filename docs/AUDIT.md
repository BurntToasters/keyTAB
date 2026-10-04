# KeyTab long-term audit

Audited 2026-10-04 against `main` at `5132287` (KeyTab 1.0.0, build 1; AltTab v11.8.0 base). Scope: release and
build scripts, CI, bundle configuration, runtime network and IPC surface, paywall residue, branding, licensing,
platform-compatibility code, and documentation drift.

Off-macOS limits: the audit host had no Xcode, so `npm run test:all` and `ai/build.sh` were not run. Node tests
(`npm run test:node`) and `npm run validate` pass. Nothing below is evidence of notarization, Gatekeeper, Sparkle
update installation, Space or multi-display behavior, Intel behavior, or macOS 26 behavior.

Status key: **fixed** (in the change that added this file), **open**, **blocked on owner** (needs credentials or
decisions only the maintainer has).

## Fixed in this change

| ID | Area | Finding | Fix |
| --- | --- | --- | --- |
| F1 | Release preflight | `validateRepositoryState` compared the origin URL case-sensitively against `BurntToasters/KeyTab`. The repository's real clone URL is `https://github.com/BurntToasters/keyTAB`, so every release preflight from a normal clone failed with "origin must be …". GitHub resolves owner and repository names case-insensitively. | `isCanonicalOrigin` matches HTTPS or SSH GitHub URLs for the canonical repository case-insensitively, with an optional `.git` or trailing slash. Forks, other owners, other hosts and suffix tricks are still rejected (tests in `preflight.test.mjs`). |
| F2 | Sparkle feeds | Beta builds read `releases/latest/download/appcast-beta.xml`. That file only existed as a mirror on the stable release that was latest when the beta was published. After the next stable release became `/latest/`, the beta feed returned 404, so beta installs saw update errors and were never offered the new stable build. | Every stable release now also uploads a GPG-signed copy of its `appcast.xml` as `appcast-beta.xml`. A later beta publish replaces the copy, as before. The copy is left out of `SHA256SUMS` because it is expected to be replaced. |
| F3 | Sparkle feeds | `release:publish` for a beta mirrored whatever `dist/appcast-beta.xml` was on disk, which F2 makes more likely to be stale. | Publish refuses a beta feed that does not name `KeyTab-<version>.zip`. |
| F4 | Release host | `mac-keychain-ssh.sh` defaulted the keychain to `$USER/Library/Keychains/login.keychain-db`. That is a relative path built from the account name, not the home directory, so without `KEYTAB_KEYCHAIN_PATH` the unlock always targeted a nonexistent file. | Uses `$HOME`. |

## Open findings

### High

- **H1 — The local CLI port is unauthenticated, and Release builds accept QA and fault-injection commands.**
  `CliEvents` listens on the CFMessagePort `run.rosie.keytab.cli`. CFMessagePort carries no sender identity, so any
  same-user process can send commands. Release builds answer:
  - `--list` and `--detailed-list`: titles, app names, bundle IDs, Spaces, frames and focus order.
  - `--qa-state`: the full switcher model.
  - `--qa-telemetry`: drains the tracking timeline.
  - `--qa-mark=`.
  - `--qa-mute-ax-destroys=`: silences window-close events for chosen pids.
  - `--qa-stall-main=`: freezes the main thread on request.

  Only the commands from `--qa-defer-repaints` through the `QaSurfaces` commands are under `#if DEBUG`
  (`CliEvents.swift` lines 104–123). KeyTab holds Accessibility and Screen Recording grants, so an unprivileged
  process can read window titles macOS would otherwise withhold from it (KeyTab becomes a TCC proxy). It can also
  freeze or degrade the switcher at will.
  Recommended:
  1. Move every `--qa-*` server branch, and the matching `CliClient.detectCommand` entries, under `#if DEBUG`.
  2. Make the remaining public commands (`--list`, `--detailed-list`, `--focus=`, `--show=`, `--hide`) an opt-in
     preference, off by default, or serve them over an XPC listener that checks the client's code-signing
     requirement.
- **H2 — Release signing uses `codesign --force --deep`** with the app's entitlements, applied over Sparkle's nested
  `Updater.app`, `Autoupdate` and framework (`scripts/build.mjs`). Apple has deprecated `--deep` for signing, and
  Sparkle documents inside-out signing of its helpers. The current entitlements only disable the sandbox, so this
  is probably harmless today, but any future entitlement would leak into the helpers. Recommended: sign the
  helpers, then the framework, then the app, each with `--options runtime --timestamp`. Before 1.0.0 ships, verify a
  real update from an older signed build.
- **H3 — Release prerequisites (blocked on owner).** `SPARKLE_PUBLIC_KEY` is empty in `config/base.xcconfig`. The
  KeyTab GPG key, notary profile and Developer ID identity for team `FYJZP8B2KG` must be supplied, and the repository
  must be public. `node scripts/validate.mjs --release` currently fails only on the Sparkle key.

### Medium

- **M1 — Paywall vestiges remain in Swift.** AGENTS.md forbids tiers and trials. Still present:
  - `SearchDiscoveryPolicy.Access` (`.trial(day:)`, `.pro`, `.locked`). The app always passes `.pro`.
  - In `QaSurfaces` (DEBUG only): a `licenses` field, a no-op `--qa-license` command, and comments about Pro
    styles and Pro prompts.
  - The `UsageStats.qaPinned` comment about "Pro prompts".
  - `EmailLineWrap.swift` and its tests. These are dead code: the `UpgradeButton` that used them was removed.

  Remove these together with their tests and project-file references, then run `npm run test:all` on macOS.
- **M2 — Specs describe removed paywall behavior.** Rewrite or delete these alongside M1:
  - `SearchDiscoverySpecs.md` (trial days 2–11, "pending Pro prompt").
  - `SearchModeResolverSpecs.md` (`ProFeature.searchInSwitcher.attemptUse()`).
  - `OnActionExtensionSpecs.md` (Pro-lock wrap).
  - `EmailLineWrapSpecs.md` ("Pro activated" pill).
  - `SidebarListSpecs.md` (Pro badge).
  - `UsageStatsMessageSpecs.md` (Pro-session counts; it has no test file).
  - `PreferencesMigrationsSpecs.md`. It claims to mirror a `PreferencesMigrationsTests.swift` that does not exist,
    and describes migrations from older AltTab schemas. `PreferencesMigrations` is now a no-op stamp, as AGENTS.md
    requires.
- **M3 — Third-party help link in runtime UI.** `PermissionsWindow.swift` cites a RescueTime help article.
  AGENTS.md requires help links to point at the KeyTab repository. Replace it with a KeyTab doc or Apple's support
  page text.
- **M4 — Remaining upstream artwork.** `resources/icons/menubar/menubar-*.pdf` is AltTab's menubar glyph, and
  `resources/illustrations/**` are AltTab-era renders. Both are permitted under GPL with provenance, but the menubar
  glyph is the most visible upstream brand mark left. Replace it with a template-image glyph that matches the new
  keycap icon (`scripts/assets/generate-icon.mjs`).
- **M5 — No upstream sync procedure.** KeyTab tracks AltTab (11.4.4 → 11.8.0 so far). Nothing documents how to take
  the next upstream release without reintroducing paywall code, AltTab identifiers or AltTab defaults. Add
  `docs/UPSTREAM.md`. It should cover how to diff upstream tags and which paths are always dropped (`src/pro`,
  `src/api`, AppCenter, the license URL scheme). It should run `npm run validate` plus the residue greps, and record
  the base version in `NOTICE.md`, `README.md`, `AboutTab.swift` and `AGENTS.md` together. The version string
  "AltTab v11.8.0" is currently hard-coded in all four places plus `validate.mjs`.
- **M6 — KeyTab has no changelog of its own.** `changelog.md` is entirely upstream history (it is kept for
  provenance). Add a KeyTab section or file for KeyTab releases, and link GitHub release notes to it.
- **M7 — Upstream issue numbers are ambiguous.** Many comments cite `#5137`, `#6055` and similar numbers, which now
  read as KeyTab issues. Prefix them as `AltTab #…` or link the upstream tracker.

### Low

- **L1 — Compatibility code for macOS 13 and older remains**, which AGENTS.md asks to remove:
  - `#available(macOS 13.0, *)` in `HelperExtensions.applySearchStyle`.
  - `@available(macOS 12.3, *)` on the `SCStreamConfiguration` extension.
  - A redundant `#available(macOS 14.0, *)` in `Windows.swift`.
- **L2 — `.periphery.yml` excludes a path that no longer exists** (`src/api-wrappers/private-apis/**`). Private API
  declarations now live in `src/macos/api-wrappers/`, so Periphery will report them as unused.
- **L3 — The keychain password is passed in argv.** `security unlock-keychain -p` and `set-key-partition-list -k`
  are briefly visible in the process list on the release host. This is a `security` limitation, so keep the release
  host single-user and document it.
- **L4 — Vendored dependencies have no update signal.** Sparkle 2.9.1 and ShortcutRecorder are vendored, so nothing
  alerts on security releases. Check Sparkle releases at least every quarter and before each KeyTab release.
- **L5 — Gaps in CI coverage.** CI runs only on `macos-15` (arm64). Intel and macOS 26 behavior are never compiled or
  exercised in CI. Adding a `macos-26` job is cheap. Intel stays a manual release check.
- **L6 — Nine inherited `TODO`s**, including "should we quit or restart" when the CLI port is already taken (a second
  KeyTab instance). Triage them into issues.
- **L7 — Localization drift.** KeyTab inherits 21 localizations. New KeyTab-only strings (the search hint, the About
  provenance line) need translations via `scripts/l10n`.

## Verified clean

- Runtime networking: the only URLs in owned Swift are the KeyTab repository link (`App.repository`) and the Sparkle
  feed (`SparkleDelegate`, GitHub `releases/latest/download`). There is no `URLSession`, telemetry or crash upload.
  `SUEnableSystemProfiling` is false.
- Identity: bundle ID `run.rosie.keytab`, product `KeyTab`, macOS 14.0 minimum, hardened runtime on, no custom URL
  scheme, and library validation not disabled. `validate.mjs` asserts all of these.
- Secrets: Sparkle keys and GPG passphrases go over stdin. Child processes get secrets stripped unless they are
  explicitly allowed. `.env`, `.release/` and `dist/` are gitignored, and `.env.example` holds no values.
- CI: tests, validation and an unsigned compile only, with `contents: read` permissions, no secrets and no
  publishing.
- Licensing: `LICENCE.md`, `NOTICE.md`, `THIRD_PARTY_NOTICES.md`, `docs/ASSET_LICENSES.md` and the vendored licence
  texts are present. Upstream copyright and provenance are retained. The app icon is now original KeyTab artwork.

## Suggested order

1. H1 (the `#if DEBUG` move for the `--qa-*` commands comes first), then M1 + M2 as one Swift cleanup change,
   validated with `npm run test:all` and `ai/build.sh` on macOS.
2. H2 and a real Sparkle update test once H3's keys exist.
3. M5 before the next upstream merge; M4, M6 and M7 before the public 1.0.0 announcement.
4. Low items as time permits.
