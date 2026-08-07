import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { root } from "../lib/core.mjs";
import { artworkHashesReady } from "../validate.mjs";

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

test("formerly gated settings remain ordinary persistent preferences", () => {
  const preferences = read("src/preferences/Preferences.swift");
  for (const setting of ["searchShortcut", "appearanceStyle", "appearanceSize", "appearanceTheme", "titleTruncation", "appearanceStyleOverride", "appearanceSizeOverride", "appearanceThemeOverride"]) assert.ok(preferences.includes(setting), `${setting} is missing`);
  assert.doesNotMatch(preferences, /license|trial|paywall|purchase|upgrade/i);
});

test("owned runtime has no paywall telemetry or direct networking", () => {
  const files = fs.readdirSync(path.join(root, "src"), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".swift")).map((entry) => path.join(entry.parentPath, entry.name));
  const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /AppCenter|LicenseManager|MachineFingerprint|LemonSqueezy|polar\.sh|URLSession|dataTask/i);
  assert.match(source, /appcast-beta\.xml/);
  assert.match(source, /SMAppService\.mainApp/);
});

test("release artwork gate rejects known placeholders and accepts original hashes", () => {
  assert.equal(artworkHashesReady(["e77c3c145e867eaee6a56e9ddd073bab44bb01ca5f4079ce4190da34a205c80a"]), false);
  assert.equal(artworkHashesReady(["original-keytab-artwork"]), true);
});
