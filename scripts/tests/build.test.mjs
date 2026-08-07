import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { debugBuildArguments } from "../build.mjs";
import { root } from "../lib/core.mjs";

test("unsigned smoke disables signing without injecting an identity", () => {
  assert.ok(debugBuildArguments({ unsigned: true }).includes("CODE_SIGNING_ALLOWED=NO"));
  assert.ok(!debugBuildArguments().some((argument) => argument.startsWith("CODE_SIGN_IDENTITY=")));
  assert.doesNotMatch(fs.readFileSync(`${root}/scripts/build.mjs`, "utf8"), /xcodebuild[^\n]*CODE_SIGN_IDENTITY/);
});
