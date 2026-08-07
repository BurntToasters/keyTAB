# KeyTab

KeyTab is a free, open-source macOS window switcher. It brings Windows-style window switching to macOS while preserving the complete AltTab v11.4.4 feature set without paid tiers, trials, license keys, telemetry, or feature gates.

- macOS 14 or newer
- AppKit and Swift 5.8-compatible source
- Bundle identifier: `run.rosie.keytab`
- Source and releases: <https://github.com/BurntToasters/KeyTab>

## Build and test

Install Node.js 22.12 or newer, then run:

```sh
npm run workspace:bootstrap
npm run test:all
npm run build:debug
```

`ai/build.sh` invokes the same canonical debug build. Dependencies are vendored local Swift packages, so Xcode does not resolve code from the network during a build.

## Release safety

Release commands validate the canonical repository, branch, clean and pushed commit, source/version synchronization, 24-hour preparation proof, signing identities, universal architecture, notarization, Sparkle EdDSA signatures, SHA-256 checksums, and detached GPG signatures. Publishing remains blocked until original KeyTab artwork and KeyTab-specific Sparkle and GPG keys are supplied.

Copy `.env.example` to `.env` for local signing credentials. See [docs/RELEASING.md](docs/RELEASING.md) for the release commands, credential options, channel behavior, and manual native checks.

## License and provenance

KeyTab is licensed under `GPL-3.0-only`; see [LICENCE.md](LICENCE.md), [NOTICE.md](NOTICE.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

KeyTab is a modified fork of AltTab v11.4.4 by Louis Pontoise and contributors; KeyTab modifications began August 2026; not affiliated with or endorsed by the upstream project.
