# Releasing KeyTab

`package.json` owns the semantic `version` and numeric `buildNumber`. Run `npm run sync-version` and commit `config/version.xcconfig` after changing either value. Stable versions use `main`; versions ending in `-beta.n` use `beta`.

## One-time Sparkle setup

Sparkle is the open-source (MIT-licensed) update framework KeyTab ships with. It costs nothing and needs no
account or service. Updates are an `appcast.xml` feed plus a zip, both hosted on this repository's GitHub
Releases. Its security rests on one EdDSA key pair: the public key is built into every copy of KeyTab, and an
update is installed only if the private key signed it. The only paid prerequisite in the release process is
Apple's Developer Program (the Developer ID certificate and notarization), not Sparkle.

1. On the Mac that will sign releases, download the Sparkle release matching `vendor/Sparkle/UPSTREAM` (currently
   2.9.1) from <https://github.com/sparkle-project/Sparkle/releases> and unpack it. The vendored copy omits
   `generate_keys`.
2. Run `./bin/generate_keys`. It creates the private key in your login keychain (account `ed25519`) and prints
   the public key. Run it again later with `-p` to print the public key.
3. **Back up the private key.** Run `./bin/generate_keys -x keytab-sparkle-private-key.txt`, store the file in a
   password manager, and delete it. If the key is lost, installed copies of KeyTab can never verify another update.
   If it leaks, anyone can sign updates your users will install.
4. Put the public key in `config/base.xcconfig` as `SPARKLE_PUBLIC_KEY = <key>` and commit it. It is public by
   design.
5. Set `KEYTAB_SPARKLE_ACCOUNT=ed25519` in `.env`. On another release Mac, import the backup with
   `./bin/generate_keys -f keytab-sparkle-private-key.txt` first.
6. Check with `node scripts/validate.mjs --release`. Once the key is in place, the Sparkle check passes.

The release commands then sign the zip and the appcast with `vendor/Sparkle/bin/sign_update` and upload both.
Users choose their update policy in General settings: manual, periodic checks, or automatic install.

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

Release signing is inside-out and never uses `--deep`: Sparkle's `Autoupdate` and `Updater.app`, then `Sparkle.framework`, then `KeyTab.app` (the only target that receives `KeyTab.entitlements`). Release validation rejects any Mach-O in the bundle that is not signed by team `FYJZP8B2KG`, including the vendored helpers, which are committed with upstream's signature.

The draft contains the notarized and stapled `KeyTab-<version>.zip`, its Sparkle-signed appcast (plus the `appcast-beta.xml` copy on stable releases), `SHA256SUMS`, and detached armored GPG signatures for each file. Run `npm run release:publish` only after native smoke tests. Then run `npm run release:verify:published` to download and verify the public artifacts.

Stable updates use `appcast.xml`. Beta updates use `appcast-beta.xml`; publishing a beta mirrors that feed onto the latest stable release so the stable `/latest/download/` URL can serve it. Every stable release also ships a GPG-signed copy of its `appcast.xml` as `appcast-beta.xml`, so beta installs keep resolving a feed (and are offered the stable build) after a new stable release becomes `/latest/`. That copy is not listed in `SHA256SUMS` because a later beta publish replaces it. Beta publishing remains blocked until public stable `v1.0.0` exists.

Every binary release must use a public tag containing the complete corresponding GPL source, build scripts, vendored sources, provenance, and dependency notices. CI has read-only repository permission and performs only validation, tests, and an unsigned compile smoke build.

Public release remains blocked until the KeyTab Sparkle public key is committed, the canonical repository is public, and signed/notarized native checks pass on supported Intel and Apple Silicon systems.
