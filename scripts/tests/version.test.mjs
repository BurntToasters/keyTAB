import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { expectedBranch, versionInfo } from "../lib/core.mjs";

test("stable and beta versions select their release branches", () => {
  assert.equal(expectedBranch("1.0.0"), "main");
  assert.equal(expectedBranch("1.1.0-beta.1"), "beta");
  assert.throws(() => expectedBranch("1.1.0-rc.1"));
});

test("version and numeric build number come from package.json", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "keytab-version-"));
  try {
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ version: "1.1.0-beta.1", buildNumber: 7 }));
    assert.deepEqual(versionInfo(directory), { version: "1.1.0-beta.1", buildNumber: 7, channel: "beta", tag: "v1.1.0-beta.1" });
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ version: "1.0.0", buildNumber: "1" }));
    assert.throws(() => versionInfo(directory), /positive integer/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
