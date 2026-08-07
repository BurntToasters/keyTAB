import assert from "node:assert/strict";
import test from "node:test";
import { appcastFilename, generateAppcast } from "../lib/appcast.mjs";

test("stable and beta feeds carry exact signed release identity", () => {
  const xml = generateAppcast({ version: "1.1.0-beta.1", buildNumber: 8, channel: "beta", signature: "signed&value", length: 42, publishedAt: new Date("2026-08-07T00:00:00Z") });
  assert.equal(appcastFilename("stable"), "appcast.xml");
  assert.equal(appcastFilename("beta"), "appcast-beta.xml");
  assert.match(xml, /KeyTab-1\.1\.0-beta\.1\.zip/);
  assert.match(xml, /sparkle:version>8</);
  assert.match(xml, /sparkle:edSignature="signed&amp;value"/);
});

test("appcast generation rejects missing signatures", () => {
  assert.throws(() => generateAppcast({ version: "1.0.0", buildNumber: 1, channel: "stable", signature: "", length: 1 }), /signature/);
  assert.throws(() => generateAppcast({ version: "1.0.0", buildNumber: 1, channel: "stable", signature: "x", length: 0 }), /length/);
});
