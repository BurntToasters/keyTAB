# Releasing KeyTab

`package.json` owns the semantic `version` and numeric `buildNumber`. Run `npm run sync-version` and commit `config/version.xcconfig` after changing either value. Stable versions use `main`; versions ending in `-beta.n` use `beta`.

## Preparation

A release host needs Node.js 22.12 or newer, the Developer ID Application identity for team `FYJZP8B2KG`, GitHub CLI authentication, a KeyTab Sparkle key, a GPG signing key, and a notarization keychain profile. Copy `.env.example` to the gitignored `.env`, or export the same variables in the shell. Shell variables take precedence over `.env` values.

- `KEYTAB_NOTARY_PROFILE`: `notarytool` keychain profile name.
- `KEYTAB_SIGNING_IDENTITY`: optional Developer ID identity override; defaults to `Developer ID Application`.
- `KEYTAB_GPG_KEY`: GPG fingerprint, long key ID, or signing identity.
- `KEYTAB_GPG_PASSPHRASE`: optional unattended-host passphrase. Prefer `gpg-agent`; when set, KeyTab passes the value through standard input, never a command argument.
- Configure exactly one Sparkle source: `KEYTAB_SPARKLE_ACCOUNT`, `KEYTAB_SPARKLE_PRIVATE_KEY_FILE`, or `KEYTAB_SPARKLE_PRIVATE_KEY`. Wrap direct multiline key material in double quotes in `.env`; it is passed through standard input. Relative key-file paths resolve from the repository root.
- Authenticate the release host with `gh auth login`; GitHub credentials stay in the CLI credential store rather than `.env`.
- `KEYTAB_KEYCHAIN_PASSWORD` or legacy `SSH_USER_PWD`: SSH release-host login keychain password.
- `KEYTAB_KEYCHAIN_PATH`: optional SSH release-host keychain path.

Do not put the Sparkle public key in `.env`. Commit the public key as `SPARKLE_PUBLIC_KEY` in `config/base.xcconfig` so every distributed app can verify updates. Never commit `.env`, private keys, passphrases, tokens, or keychain passwords.

Node scripts remove private key material, GPG passphrases, keychain passwords, and GitHub token variables from child-process environments by default. Sparkle and GPG secrets travel only through standard input; `gh` reads authentication from its credential store.

`npm run release:mac:ssh` unlocks the login keychain, verifies the canonical public repository, clean pushed branch and credentials, runs `test:all` once, records a source and toolchain-bound 24-hour session, and continues through the signed universal build and draft upload. `release:mac:ssh:resume` reuses only a still-valid matching session.

## Publishing

The draft contains the notarized and stapled `KeyTab-<version>.zip`, its Sparkle-signed appcast, `SHA256SUMS`, and detached armored GPG signatures for all three files. Run `npm run release:publish` only after native smoke tests. Then run `npm run release:verify:published` to download and verify the public artifacts.

Stable updates use `appcast.xml`. Beta updates use `appcast-beta.xml`; publishing a beta mirrors that feed onto the latest stable release so the stable `/latest/download/` URL can serve it. Beta publishing remains blocked until public stable `v1.0.0` exists.

Every binary release must use a public tag containing the complete corresponding GPL source, build scripts, vendored sources, provenance, and dependency notices. CI has read-only repository permission and performs only validation, tests, and an unsigned compile smoke build.

Public release remains blocked until original KeyTab artwork replaces the imported placeholder, the KeyTab Sparkle public key is committed, the canonical repository is public, and signed/notarized native checks pass on supported Intel and Apple Silicon systems.
