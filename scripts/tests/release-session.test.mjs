import assert from "node:assert/strict";
import test from "node:test";
import { sessionHours, validateRecord } from "../release-session.mjs";

const identity = { version: "1.0.0", branch: "main", commit: "abc" };

test("release session accepts matching unexpired identity", () => {
  const now = Date.now();
  const record = { schema: 1, createdAt: new Date(now - 1000).toISOString(), identity };
  assert.equal(validateRecord(record, identity, now), record);
});

test("release session rejects expiry and changed identity", () => {
  const now = Date.now();
  const expired = { schema: 1, createdAt: new Date(now - (sessionHours * 60 * 60 * 1000) - 1).toISOString(), identity };
  assert.throws(() => validateRecord(expired, identity, now), /expired/);
  const current = { schema: 1, createdAt: new Date(now).toISOString(), identity };
  assert.throws(() => validateRecord(current, { ...identity, commit: "def" }, now), /does not match/);
});
