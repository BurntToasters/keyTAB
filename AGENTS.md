# KeyTab repository guidance

## Project identity

- KeyTab is a free, GPL-3.0-only fork of AltTab v11.8.0. KeyTab modifications began August 2026 from AltTab v11.4.4. The product name is `KeyTab`, the bundle identifier is `run.rosie.keytab`, and the canonical repository is `BurntToasters/KeyTab`.
- Keep KeyTab preferences, login-item registration, TCC permissions, and Sparkle state separate from AltTab. Never read or migrate AltTab defaults.
- Keep all formerly paid AltTab functionality free and persistent. Do not add license keys, trials, tiers, purchase UI, feature gates, downgrade behavior, telemetry, AppCenter, feedback APIs, or sponsor branding.
- Runtime networking is limited to Sparkle update checks. Help, feedback, source, issue, and release links must point to the KeyTab GitHub repository.
- Preserve AltTab names only where required for copyright, license, provenance, changelog, or upstream references.

## macOS development

- Do not use the Xcode GUI for development. Use repository scripts and command-line builds.
- Write Swift 5.8-compatible code targeting macOS 14 or newer.
- Use programmatic AppKit. Do not add KeyTab-owned SwiftUI, Interface Builder, XIB, or storyboard files.
- Keep the audited Objective-C exception bridge and vendored framework resources only where required by upstream crash handling or dependencies.
- Prefer current macOS APIs and remove KeyTab-owned compatibility paths for macOS 13 and older. Preserve required vendor-internal compatibility code and macOS 26 adaptations.
- Use `guard` exits to keep the happy path clear.
- Keep methods compact. Extract coherent sub-methods instead of separating statement groups with blank lines. Do not add inline comments for obvious code.
- Organize source into feature folders that group files changing together.
- Favor low latency and responsiveness. Reuse objects and avoid unnecessary allocation, I/O, work on the main thread, or repeated system queries.
- Use SF Symbols through `NSImage(systemSymbolName:)` as template images. Do not bundle Apple font files or export SF Symbols as assets.

## Dependencies and licensing

- Use vendored local Swift packages. Do not restore CocoaPods, workspace-based builds, AppCenter, or network dependency resolution during builds.
- Keep Sparkle and ShortcutRecorder license files, `LICENCE.md`, `NOTICE.md`, `THIRD_PARTY_NOTICES.md`, and `docs/ASSET_LICENSES.md` accurate and distributed with releases.
- Do not remove upstream copyright or modification provenance. Every binary release must have a matching public source tag containing the complete corresponding source, vendored dependencies, build scripts, and notices.
- Treat `GPL-3.0-only` compliance as a release gate, not optional documentation.

## Node scripts and configuration

- Use Node.js 22.12 or newer and ESM for build, validation, versioning, packaging, and release automation.
- `package.json` is authoritative for semantic `version` and numeric `buildNumber`. After changing either, run `npm run sync-version` and commit `config/version.xcconfig`.
- Keep `.env` gitignored. Add new supported variables to `.env.example`, validation, tests, and `docs/RELEASING.md` together.
- Shell environment variables override `.env`. Never commit credentials, private keys, tokens, passphrases, or keychain passwords.
- Keep sensitive values out of command arguments and unrelated child-process environments. Sparkle private keys and GPG passphrases must use standard input. GitHub tokens may be forwarded only to `gh` commands.
- Configure exactly one Sparkle signing source: `KEYTAB_SPARKLE_ACCOUNT`, `KEYTAB_SPARKLE_PRIVATE_KEY_FILE`, or `KEYTAB_SPARKLE_PRIVATE_KEY`.
- Keep the Sparkle public key committed as `SPARKLE_PUBLIC_KEY` in `config/base.xcconfig`; it is not a `.env` secret.
- Retain shell only where macOS keychain credential handling requires it.

## Validation workflow

- Preserve unrelated user changes in the dirty worktree. Never reset or overwrite work outside the requested scope.
- Run focused tests while developing, then run `npm run test:all` for the full local gate.
- After implementing a change, inspect `ai/build.sh`, copy its commands exactly, and run them. `ai/build.sh` currently uses the canonical `npm run build:debug` command.
- Do not treat automated tests as proof of notarization, stapling, Gatekeeper acceptance, update installation, multi-display or Space behavior, Intel behavior, or macOS 26 behavior. Report those checks separately.
- CI must remain tests, validation, and unsigned compile smoke only on `main` and `beta`. Do not add signing secrets, publishing, release creation, or repository writeback.

## Release safety

- Follow `docs/RELEASING.md` and the public `package.json` release commands. Do not bypass preflight, validation, or release-session proof.
- Stable releases come from `main`; `-beta.n` releases come from `beta`. Beta publishing remains blocked until stable `v1.0.0` is public.
- A resume command may reuse only an unexpired 24-hour session matching version, build, commit, source and project hashes, architecture, toolchain, clean pushed branch, and successful `test:all` proof.
- Releases require Developer ID signing for team `FYJZP8B2KG`, universal `arm64 x86_64` output, hardened runtime, notarization, stapling, Gatekeeper assessment, Sparkle EdDSA signatures, SHA-256 checksums, and detached GPG signatures.
- Never publish or mutate a GitHub release unless the user explicitly requests that external action.
- Keep public release blocked until a KeyTab Sparkle key, a GPG key, the canonical public repository, matching public source tag, and signed native verification are all available.

## Testing

- NEVER write unit tests after you write code.
- Highly prefer E2E tests as the sole testing mechanism. Use them to verify complex features work. At the end of E2E tests, produce a verifiable and repeatable artifact.
- If you must test a system in isolation, FIRST write all the ways it could fail, THEN write the code.
