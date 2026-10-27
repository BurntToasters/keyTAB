# Syncing with upstream AltTab

KeyTab is a fork of [AltTab](https://github.com/lwouis/alt-tab-macos). This page is the procedure for taking a new upstream release (`vNEW`) on top of the release KeyTab is based on (`vOLD`). Upstream changes are applied as a filtered patch, then resolved by hand against KeyTab's rules in `AGENTS.md`.

Rules that every resolved hunk must follow:

- The paywall never returns. Licensing, trials, purchase and upgrade UI, Pro-only gates, telemetry, AppCenter, feedback and `src/api` stay out. Formerly paid features stay enabled for everyone.
- KeyTab identity wins: the name `KeyTab`, bundle identifier `run.rosie.keytab`, repository `BurntToasters/KeyTab`, KeyTab's app icon (`resources/icons/app/AppIcon.icon`) and its three menubar icons (`menubar-0/1/2.pdf`). Upstream issue references are written `AltTab #NNNN`.
- The CLI and QA code (`CliEvents`, `CliServer`, `CliClient`, `Qa*`) stays inside `#if DEBUG`.
- Do not import upstream migrations that assume AltTab version numbers in `preferencesVersion`. KeyTab preferences are separate from AltTab.

## 1. Fetch the tags

```sh
git fetch --no-tags https://github.com/lwouis/alt-tab-macos 'refs/tags/vOLD:refs/upstream/vOLD' 'refs/tags/vNEW:refs/upstream/vNEW'
```

## 2. Build the filtered patch

```sh
git diff --binary refs/upstream/vOLD refs/upstream/vNEW -- . \
  :!src/pro :!src/api :!.claude :!.github :!appcast.xml :!docs/readme :!scripts/build_readme_svg.py :!scripts/codesign \
  :!src/preferences/settings-window/tabs/UpgradeTab.swift :!src/debug/QaTrial.swift :!src/_test-support/ProPromptTestSupport.swift \
  :!src/util/UsageStatsMessageSpecs.md :!src/util/UsageStatsMessageTests.swift :!src/util/UsageStatsTestable.swift \
  :!src/secondary-windows/FeedbackWindow.swift :!resources/icons :!resources/pro-rabbit.png :!changelog.md :!docs/contributors.md \
  :!config/release.xcconfig :!Info.plist :!resources/illustrations :!resources/native-illustrations :!resources/svg-illustrations \
  :!scripts/assets :!ai :!src/preferences/PreferencesMigrationsTests.swift \
  | sed 's#alt-tab-macos\.xcodeproj/#KeyTab.xcodeproj/#g' > /path/outside/repo/upstream-vOLD-vNEW.patch
```

Write the patch outside the repository. If `git apply` reports a file as missing from the index, add that file to the patch by hand from `refs/upstream/vNEW`.

## 3. Apply and resolve

```sh
git apply --3way /path/outside/repo/upstream-vOLD-vNEW.patch
```

Resolve each conflict by the rules above. Keep KeyTab's build settings, target and product names, bundle identifier and config file references. Take upstream's non-paywall build-setting and build-phase changes when they do not conflict. Remove references to files that the sync deleted, and add references to new files in `KeyTab.xcodeproj/project.pbxproj`. `node scripts/validate.mjs` checks that every Swift file has a reference and that no reference points to a missing file.

## 4. Illustrations

Copy new or changed `settings-*` and `permission-*` SVGs from `refs/upstream/vNEW:resources/svg-illustrations/` into `resources/svg-illustrations/`. Never copy `*-comparison.svg`; the Pro comparison scenes are not shipped. Then compile and check:

```sh
python3 scripts/assets/compile_illustrations.py
python3 scripts/assets/compile_illustrations.py --check
```

## 5. Sweeps before committing

1. No conflict markers: `grep -rnE '^(<<<<<<<|=======|>>>>>>>)' src resources scripts config docs KeyTab.xcodeproj`.
2. Paywall residue. Run this and fix every hit that is not historical or provenance text:

   ```sh
   grep -rnE 'Pro[A-Z]|License|Trial|trial|Day[0-9]|UpgradeTab|Endpoints|Feedback|feedback|"AltTab|AltTab "' src scripts config resources/l10n
   ```

3. Declarations dropped by the merge but still referenced: build the list of identifiers the patch removed and grep for their uses.
4. `npm run validate` and `node --test scripts/tests/*.test.mjs`.
5. CI on macOS for the Swift build and the unit tests. Linux hosts cannot compile the app.

## 6. Bump the base version

Update the base version in `NOTICE.md`, `README.md`, `src/preferences/settings-window/tabs/AboutTab.swift`, `AGENTS.md`, `scripts/validate.mjs` (the `modified fork of AltTab` exemption) and `scripts/tests/depaywall.test.mjs`, and in `docs/acknowledgments.md` and `docs/contributors.md` if they state it. Do not change historical statements such as "modifications began from AltTab v11.4.4". Add the upstream changelog entries for the versions between `vOLD` and `vNEW` at the top of the upstream history in `changelog.md`, in the same format.
