import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fail, root, versionInfo, writeIfChanged } from "./lib/core.mjs";

export function expectedVersionConfig(base = root) {
  const { version, buildNumber } = versionInfo(base);
  return `MARKETING_VERSION = ${version}\nCURRENT_PROJECT_VERSION = ${buildNumber}\n`;
}

export function syncVersion({ base = root, check = false } = {}) {
  const configPath = path.join(base, "config/version.xcconfig");
  const expected = expectedVersionConfig(base);
  if (check) {
    const current = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
    if (current !== expected) fail("config/version.xcconfig is stale; run npm run sync-version and commit it.");
    return false;
  }
  return writeIfChanged(configPath, expected);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const check = process.argv.includes("--check");
  try {
    const changed = syncVersion({ check });
    console.log(check ? "sync-version: committed Xcode version is current" : `sync-version: ${changed ? "updated" : "already current"}`);
  } catch (error) {
    console.error(`sync-version: FAILED: ${error.message}`);
    process.exit(1);
  }
}
