# KeyTab

KeyTab is a free, open-source macOS window switcher. It brings Windows-style window switching to macOS while preserving the complete AltTab v11.10.1 feature set without paid tiers, trials, license keys, telemetry, or feature gates.

- macOS 14 or newer on Apple Silicon. Intel Macs get a universal build but are deprecated and untested.
- AppKit and Swift 5.8-compatible source
- Bundle identifier: `run.rosie.keytab`
- Source and releases: <https://github.com/BurntToasters/KeyTab>

## Verify Releases
Releases of KeyTab are codesigned by my apple developer account and also by GPG: https://tuxedo.rosie.run/GPG/KeyTAB_2963E96C_Public.asc

## Build and test

Install Xcode 26 or newer (KeyTab builds against the macOS 26 and 27 SDKs while still running on macOS 14; Xcode 26 is also the minimum for the Icon Composer app icon) and Node.js 22.12 or newer, then run:

```sh
npm run workspace:bootstrap
npm run test:all
npm run build:debug
```

`ai/build.sh` invokes the same canonical debug build. Dependencies are vendored local Swift packages, so Xcode does not resolve code from the network during a build.

## Release safety

Release commands validate the canonical repository, branch, clean and pushed commit, source/version synchronization, 24-hour preparation proof, signing identities, universal architecture, notarization, Sparkle EdDSA signatures, SHA-256 checksums, and detached GPG signatures. Publishing requires the KeyTab Sparkle and GPG keys described in [docs/RELEASING.md](docs/RELEASING.md).

Copy `.env.example` to `.env` for local signing credentials. See [docs/RELEASING.md](docs/RELEASING.md) for the release commands, credential options, channel behavior, and manual native checks.

## Brand

The icon, menubar glyphs and palette are described in [docs/BRAND.md](docs/BRAND.md). The app icon is an Icon Composer file, `resources/icons/app/AppIcon.icon`; the menubar glyphs are generated from code in `scripts/assets/`.

## License and provenance

Copyright © 2026 BurntToasters and KeyTab contributors. Portions copyright © 2019–2026 Louis Pontoise and AltTab contributors.

KeyTab is licensed under `GPL-3.0-only`; see [LICENCE.md](LICENCE.md), [NOTICE.md](NOTICE.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

KeyTab is a modified fork of AltTab v11.10.1 by Louis Pontoise and contributors; KeyTab modifications began August 2026 from AltTab v11.4.4; not affiliated with or endorsed by the upstream project.
