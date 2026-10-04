import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { treeHash } from "../lib/core.mjs";

test("tree hash covers plain files and directories and tracks their content", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "keytab-tree-"));
  try {
    fs.mkdirSync(path.join(base, "config"));
    fs.writeFileSync(path.join(base, "config/base.xcconfig"), "A = 1\n");
    fs.writeFileSync(path.join(base, "Info.plist"), "<plist/>\n");
    const paths = ["config", "Info.plist", "missing.entitlements"];
    const first = treeHash(paths, base);
    assert.equal(treeHash(paths, base), first);
    fs.writeFileSync(path.join(base, "Info.plist"), "<plist>changed</plist>\n");
    const second = treeHash(paths, base);
    assert.notEqual(second, first);
    fs.writeFileSync(path.join(base, "config/base.xcconfig"), "A = 2\n");
    assert.notEqual(treeHash(paths, base), second);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
