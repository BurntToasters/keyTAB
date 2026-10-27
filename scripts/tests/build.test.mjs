import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { debugBuildArguments, releaseCodesignArguments, releaseSigningTargets, releaseSmokeArguments } from "../build.mjs";
import { root } from "../lib/core.mjs";
import { isMachO, signingTeamMismatches } from "../validate.mjs";

test("unsigned smoke disables signing without injecting an identity", () => {
  assert.ok(debugBuildArguments({ unsigned: true }).includes("CODE_SIGNING_ALLOWED=NO"));
  assert.ok(!debugBuildArguments().some((argument) => argument.startsWith("CODE_SIGN_IDENTITY=")));
  assert.doesNotMatch(fs.readFileSync(`${root}/scripts/build.mjs`, "utf8"), /xcodebuild[^\n]*CODE_SIGN_IDENTITY/);
});

test("release signing covers every Sparkle helper and signs inside-out", () => {
  const app = "/dist/KeyTab.app";
  const targets = releaseSigningTargets(app);
  const sparkle = path.join(app, "Contents/Frameworks/Sparkle.framework");
  for (const nested of ["Versions/A/Autoupdate", "Versions/A/Updater.app"]) assert.ok(targets.includes(path.join(sparkle, nested)), nested);
  assert.ok(targets.includes(sparkle));
  assert.equal(targets.at(-1), app);
  targets.forEach((outer, index) => {
    for (const inner of targets.slice(index + 1)) assert.ok(!inner.startsWith(`${outer}/`), `${inner} is signed after its container ${outer}`);
  });
});

test("release codesign never uses --deep and gives entitlements only to the app", () => {
  const app = releaseCodesignArguments("/x/KeyTab.app", { identity: "Developer ID Application", entitlements: "/x/KeyTab.entitlements", isApp: true });
  const helper = releaseCodesignArguments("/x/Autoupdate", { identity: "Developer ID Application", entitlements: "/x/KeyTab.entitlements", isApp: false });
  for (const args of [app, helper]) {
    assert.ok(!args.includes("--deep"));
    assert.deepEqual(args.slice(0, 6), ["--force", "--options", "runtime", "--timestamp", "--sign", "Developer ID Application"]);
  }
  assert.ok(app.includes("--entitlements"));
  assert.ok(!helper.includes("--entitlements"));
  assert.equal(app.at(-1), "/x/KeyTab.app");
});

test("Mach-O detection finds thin and universal binaries only", () => {
  assert.ok(isMachO(Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0, 0])));
  assert.ok(isMachO(Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0, 0])));
  assert.ok(isMachO(Buffer.from([0xce, 0xfa, 0xed, 0xfe])));
  assert.ok(!isMachO(Buffer.from("#!/bin/sh\n")));
  assert.ok(!isMachO(Buffer.from([0xcf, 0xfa])));
  assert.ok(!isMachO(Buffer.alloc(0)));
});

test("release bundles reject nested code signed by another team or ad hoc", () => {
  const entries = [
    { file: "Contents/MacOS/KeyTab", team: "FYJZP8B2KG" },
    { file: "Sparkle.framework/Versions/A/Autoupdate", team: "QXD7GW8FHY" },
    { file: "Sparkle.framework/Versions/A/Updater.app/Contents/MacOS/Updater", team: null },
  ];
  assert.deepEqual(signingTeamMismatches(entries, "FYJZP8B2KG"), [
    "Sparkle.framework/Versions/A/Autoupdate is signed by QXD7GW8FHY",
    "Sparkle.framework/Versions/A/Updater.app/Contents/MacOS/Updater is signed by no team",
  ]);
  assert.deepEqual(signingTeamMismatches(entries.slice(0, 1), "FYJZP8B2KG"), []);
});

test("release compile smoke builds the Release configuration unsigned and without an identity", () => {
  const args = releaseSmokeArguments();
  assert.deepEqual(args.slice(args.indexOf("-configuration"), args.indexOf("-configuration") + 2), ["-configuration", "Release"]);
  assert.ok(args.includes("CODE_SIGNING_ALLOWED=NO"));
  assert.ok(args.at(-1) === "build" || args.includes("build"));
  assert.ok(!args.some((argument) => argument.startsWith("CODE_SIGN_IDENTITY=")));
  assert.ok(!args.includes("ARCHS=arm64 x86_64"), "the smoke compile stays single-architecture");
});
