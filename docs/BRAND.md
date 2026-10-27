# KeyTab brand

KeyTab's identity is its own. It shares no artwork, colors or naming with AltTab beyond the provenance notices
that GPL-3.0 requires.

## Concept

**The selected tile is a key.** The mark is a row of window tiles, as in the switcher, in which the selected tile
is a keycap carrying the tab glyph (⇥). Tap a key, step through your windows. The tiles beside it recede, the same
way unselected tiles do in the switcher.

## Palette

| Token | Hex | Use |
| --- | --- | --- |
| Amber | `#FFB547` | Top of the icon gradient, side tiles in the colored menubar glyph |
| Ember | `#E8562A` | Bottom of the icon gradient, keycap in the colored menubar glyph |
| Cream | `#FFF4E4` | Selection ring, window tiles, glyph on Ember |
| Night | `#29223F` → `#3D3359` | Keycap face |
| Glyph | `#FFC266` | Tab glyph on the dark keycap |

## Assets

The app icon is authored in Icon Composer; the menubar icons are generated from code, so they can be reviewed in
diffs and regenerated exactly:

- `resources/icons/app/AppIcon.icon` is an Icon Composer file. Edit it in Icon Composer; the build compiles it into
  `Assets.car` (Liquid Glass on macOS 26 and newer) and a flattened `AppIcon.icns` for macOS 14 and 15.
- `node scripts/assets/generate-menubar-icons.mjs` writes `resources/icons/menubar/menubar-{0,1,2}.pdf`:
  outlined and filled template glyphs, which macOS tints for light and dark menubars, and the colored glyph.

When changing either, render a preview at 16, 32 and 128 px and at actual menubar size (44 px for 22 pt) before
committing. The mark must stay legible at 16 px.
