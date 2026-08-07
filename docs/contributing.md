# Contributing to KeyTab

Use <https://github.com/BurntToasters/KeyTab/issues> for bugs and proposals.

## Requirements

- macOS 14 or newer
- Node.js 22.12 or newer
- Apple command-line developer tools capable of building Swift 5.8-compatible source

The app uses programmatic AppKit. Do not add SwiftUI, Interface Builder files, CocoaPods, remote build dependencies, paywalls, telemetry, or KeyTab-owned compatibility paths for macOS 13 and older.

## Local workflow

```sh
npm run workspace:bootstrap
npm run workspace:prepare
npm run test:all
npm run build:debug
```

The exact required compile command is exposed through `ai/build.sh`. Sparkle and ShortcutRecorder are vendored local Swift packages under `vendor/`.

## Release workflow

Release operations use the `release:*` package scripts. A public release requires original KeyTab artwork, KeyTab-specific Sparkle and GPG keys, Developer ID signing, notarization and stapling, a clean pushed commit on the correct branch, a matching public source tag, and successful published-asset verification. GitHub Actions only validates, tests, and performs unsigned compile smoke checks; it never publishes.

## Licensing

Contributions are accepted under GPL-3.0-only. Preserve upstream notices and provenance. Any added dependency or asset must be redistributable under GPL-compatible terms and recorded in `THIRD_PARTY_NOTICES.md` or `docs/ASSET_LICENSES.md` as appropriate.
