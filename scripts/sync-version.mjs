import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fail, root, versionInfo, writeIfChanged } from "./lib/core.mjs";

const changelogTitle = "# KeyTab changelog\n\n";

export function expectedVersionConfig(base = root) {
  const { version, buildNumber } = versionInfo(base);
  return `MARKETING_VERSION = ${version}\nCURRENT_PROJECT_VERSION = ${buildNumber}\n`;
}

export function expectedPackageLock(current, version) {
  const lock = JSON.parse(current);
  lock.version = version;
  if (lock.packages?.[""]) lock.packages[""].version = version;
  return `${JSON.stringify(lock, null, 2)}\n`;
}

export function expectedChangelog(current, version) {
  if (new RegExp(`^## \\[?${version.replaceAll(".", "\\.")}\\b`, "m").test(current)) return current;
  if (!current.startsWith(changelogTitle)) fail(`changelog.md must start with "${changelogTitle.trim()}".`);
  return `${changelogTitle}## ${version} (unreleased)\n\n${current.slice(changelogTitle.length)}`;
}

function versionTargets(base) {
  const { version } = versionInfo(base);
  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
  const config = path.join(base, "config/version.xcconfig");
  const lock = path.join(base, "package-lock.json");
  const changelog = path.join(base, "changelog.md");
  return [
    { file: config, current: read(config), expected: expectedVersionConfig(base) },
    ...(fs.existsSync(lock) ? [{ file: lock, current: read(lock), expected: expectedPackageLock(read(lock), version) }] : []),
    ...(fs.existsSync(changelog) ? [{ file: changelog, current: read(changelog), expected: expectedChangelog(read(changelog), version) }] : []),
  ];
}

export function syncVersion({ base = root, check = false } = {}) {
  const targets = versionTargets(base);
  if (check) {
    const stale = targets.filter(({ current, expected }) => current !== expected).map(({ file }) => path.relative(base, file));
    if (stale.length) fail(`${stale.join(", ")} ${stale.length === 1 ? "is" : "are"} stale; run npm run sync-version and commit the result.`);
    return false;
  }
  return targets.map(({ file, expected }) => writeIfChanged(file, expected)).some(Boolean);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const check = process.argv.includes("--check");
  try {
    const changed = syncVersion({ check });
    console.log(check ? "sync-version: committed versions are current" : `sync-version: ${changed ? "updated" : "already current"}`);
  } catch (error) {
    console.error(`sync-version: FAILED: ${error.message}`);
    process.exit(1);
  }
}
