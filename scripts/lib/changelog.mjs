import fs from "node:fs";
import path from "node:path";
import { repositoryUrl, root } from "./core.mjs";

/// The body of the `## <version>` section in changelog.md, up to the next `##` or `#` heading.
export function changelogSection(version, changelog) {
  const lines = changelog.split("\n");
  const heading = new RegExp(`^## \\[?${version.replaceAll(".", "\\.")}\\]?(?:\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) throw new Error(`changelog.md has no "## ${version}" section`);
  const end = lines.findIndex((line, index) => index > start && /^#{1,2} /.test(line));
  const body = lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
  if (!body) throw new Error(`changelog.md "## ${version}" section is empty; describe the release before publishing`);
  return body;
}

export function releaseNotes(info, changelog = fs.readFileSync(path.join(root, "changelog.md"), "utf8")) {
  return `${changelogSection(info.version, changelog)}\n\n---\n\nKeyTab is free software under GPL-3.0-only, a modified fork of AltTab. ` +
    `The complete corresponding source is the [\`${info.tag}\` tag](${repositoryUrl}/tree/${info.tag}); ` +
    `the license and notices ship inside the app and in [NOTICE.md](${repositoryUrl}/blob/${info.tag}/NOTICE.md).\n`;
}
