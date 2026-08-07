import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ensureDirectory, expectedBranch, output, root, sha256File, treeHash, versionInfo } from "./lib/core.mjs";

export const sessionHours = 24;
export const releaseDirectory = path.join(root, ".release");
export const proofPath = path.join(releaseDirectory, "quality-gate.json");
export const sessionPath = path.join(releaseDirectory, "build-session.json");

function optionalOutput(command, args) {
  try { return output(command, args); } catch { return "unavailable"; }
}

export function currentIdentity() {
  const info = versionInfo();
  return {
    schema: 1,
    version: info.version,
    buildNumber: info.buildNumber,
    channel: info.channel,
    tag: info.tag,
    commit: output("git", ["rev-parse", "HEAD"]),
    branch: output("git", ["branch", "--show-current"]),
    origin: output("git", ["remote", "get-url", "origin"]),
    upstream: optionalOutput("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]),
    packageLockHash: sha256File(path.join(root, "package-lock.json")),
    vendorHash: treeHash(["vendor"]),
    projectHash: treeHash(["KeyTab.xcodeproj", "config", "Info.plist", "KeyTab.entitlements"]),
    platform: process.platform,
    hostArchitecture: os.arch(),
    releaseArchitecture: "arm64+x86_64",
    node: process.version,
    xcode: optionalOutput("xcodebuild", ["-version"]),
    swift: optionalOutput("swift", ["--version"]),
  };
}

export function validateRecord(record, identity, now = Date.now(), kind = "release session") {
  if (!record || record.schema !== 1) throw new Error(`${kind} is missing or unsupported.`);
  const createdAt = Date.parse(record.createdAt);
  if (!Number.isFinite(createdAt)) throw new Error(`${kind} has an invalid creation time.`);
  if (now - createdAt > sessionHours * 60 * 60 * 1000 || now < createdAt) throw new Error(`${kind} expired; run npm run release:prepare again.`);
  if (JSON.stringify(record.identity) !== JSON.stringify(identity)) throw new Error(`${kind} does not match the current source, version, commit, or toolchain.`);
  if (identity.branch !== expectedBranch(identity.version)) throw new Error(`${kind} was recorded on the wrong branch.`);
  return record;
}

export function clearProof() {
  fs.rmSync(proofPath, { force: true });
  fs.rmSync(sessionPath, { force: true });
}

export function recordProof() {
  if (output("git", ["status", "--porcelain"])) throw new Error("Quality proof requires a clean worktree.");
  ensureDirectory(releaseDirectory);
  const record = { schema: 1, createdAt: new Date().toISOString(), identity: currentIdentity(), gate: "npm run test:all" };
  fs.writeFileSync(proofPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export function createSession() {
  const identity = currentIdentity();
  const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  validateRecord(proof, identity, Date.now(), "quality proof");
  ensureDirectory(releaseDirectory);
  const record = { schema: 1, createdAt: new Date().toISOString(), identity, proofCreatedAt: proof.createdAt };
  fs.writeFileSync(sessionPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export function verifySession() {
  const record = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  return validateRecord(record, currentIdentity());
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const action = process.argv[2];
    if (action === "clear") clearProof();
    else if (action === "record-proof") recordProof();
    else if (action === "create") createSession();
    else if (action === "verify") verifySession();
    else throw new Error("Usage: release-session.mjs clear|record-proof|create|verify");
    console.log(`release-session:${action}: ok`);
  } catch (error) {
    console.error(`release-session: FAILED:\n${error.message}`);
    process.exit(1);
  }
}
