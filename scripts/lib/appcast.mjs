import fs from "node:fs";
import path from "node:path";
import { repository, xmlEscape } from "./core.mjs";

export function appcastFilename(channel) {
  return channel === "beta" ? "appcast-beta.xml" : "appcast.xml";
}

export function generateAppcast({ version, buildNumber, channel, signature, length, publishedAt = new Date(), filename = `KeyTab-${version}.zip` }) {
  if (!signature?.trim()) throw new Error("Sparkle EdDSA signature is required.");
  if (!Number.isSafeInteger(Number(length)) || Number(length) < 1) throw new Error("Archive length must be a positive integer.");
  const tag = `v${version}`;
  const download = `https://github.com/${repository}/releases/download/${tag}/${filename}`;
  const release = `https://github.com/${repository}/releases/tag/${tag}`;
  return `<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">\n  <channel>\n    <title>KeyTab ${channel === "beta" ? "Beta " : ""}Updates</title>\n    <link>${xmlEscape(release)}</link>\n    <description>KeyTab updates</description>\n    <item>\n      <title>KeyTab ${xmlEscape(version)}</title>\n      <pubDate>${publishedAt.toUTCString()}</pubDate>\n      <sparkle:version>${xmlEscape(buildNumber)}</sparkle:version>\n      <sparkle:shortVersionString>${xmlEscape(version)}</sparkle:shortVersionString>\n      <sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>\n      <sparkle:releaseNotesLink>${xmlEscape(release)}</sparkle:releaseNotesLink>\n      <enclosure url="${xmlEscape(download)}" length="${xmlEscape(length)}" type="application/octet-stream" sparkle:edSignature="${xmlEscape(signature.trim())}"/>\n    </item>\n  </channel>\n</rss>\n`;
}

export function writeAppcast(directory, options) {
  const file = path.join(directory, appcastFilename(options.channel));
  fs.writeFileSync(file, generateAppcast(options));
  return file;
}
