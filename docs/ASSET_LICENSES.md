# Asset license manifest

| Paths | Origin | License | Release status |
| --- | --- | --- | --- |
| `resources/icons/app/**`, generated `app.icns` | AltTab v11.4.4 placeholder artwork | GPL-3.0-only as part of the upstream source distribution | Must be replaced with user-supplied KeyTab artwork before a public release. Release validation rejects the known placeholder hashes. |
| `resources/icons/menubar/**` | AltTab v11.4.4 | GPL-3.0-only as part of the upstream source distribution | Permitted; may be replaced by original KeyTab assets. |
| `resources/illustrations/**` | AltTab v11.4.4 | GPL-3.0-only as part of the upstream source distribution | Permitted with provenance retained. |
| SF Symbols requested with `NSImage(systemSymbolName:)` | Apple platform API; symbols are not exported or redistributed as files | Governed by the installed macOS SDK and platform terms | Runtime use only. |
| `vendor/Sparkle/Sources/Sparkle/Assets.xcassets/**` and Sparkle UI resources | Sparkle 2.9.1 | See `resources/licenses/Sparkle-LICENSE.txt` | Vendored dependency resources. |
| `vendor/ShortcutRecorder/Sources/ShortcutRecorder/Images.xcassets/**` | ShortcutRecorder contributors | CC BY 4.0; see `resources/licenses/ShortcutRecorder-LICENSE.txt` | Vendored dependency resources with attribution in `THIRD_PARTY_NOTICES.md`. |

`resources/SF-Pro-Text-Regular.otf` and the associated font-subsetting/export pipeline were removed. KeyTab does not redistribute Apple font or SF Symbols files.
