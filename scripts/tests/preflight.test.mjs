import assert from "node:assert/strict";
import test from "node:test";
import { childEnvironment } from "../lib/core.mjs";
import { betaReleaseAllowed, sparkleCredentialSources, validateRepositoryState } from "../release-preflight.mjs";
import { betaMirrorTarget, expectedDraftTarget, feedFilenames, gpgSigningInvocation, sparkleSigningInvocation } from "../release.mjs";

const clean = { version: "1.0.0", branch: "main", origin: "https://github.com/BurntToasters/KeyTab.git", status: "", head: "abc", remoteHead: "abc", upstream: "origin/main" };

test("release repository policy binds origin branch push tag and draft", () => {
  assert.deepEqual(validateRepositoryState(clean), []);
  assert.match(validateRepositoryState({ ...clean, origin: "https://github.com/BurntToasters/keyTAB-prepub.git" }).join("\n"), /origin/);
  assert.match(validateRepositoryState({ ...clean, branch: "beta", upstream: "origin/beta" }).join("\n"), /main/);
  assert.match(validateRepositoryState({ ...clean, tagHead: "other", draftTarget: "other" }).join("\n"), /tag targets another commit/);
});

test("origin matches the canonical repository the way GitHub resolves names", () => {
  for (const origin of ["https://github.com/BurntToasters/keyTAB", "https://github.com/burnttoasters/keytab.git", "git@github.com:BurntToasters/KEYTAB.git", "https://github.com/BurntToasters/KeyTab/"]) {
    assert.deepEqual(validateRepositoryState({ ...clean, origin }), [], origin);
  }
  for (const origin of ["https://github.com/BurntToasters/KeyTab-fork.git", "https://github.com/Someone/KeyTab.git", "https://gitlab.com/BurntToasters/KeyTab.git", "https://github.com/BurntToasters/KeyTab.git.evil", "", "https://github.com/BurntToasters/KeyTab/extra"]) {
    assert.match(validateRepositoryState({ ...clean, origin }).join("\n"), /origin/, origin);
  }
});

test("a stable release keeps the beta feed resolvable from the latest release", () => {
  assert.deepEqual(feedFilenames("stable"), ["appcast.xml", "appcast-beta.xml"]);
  assert.deepEqual(feedFilenames("beta"), ["appcast-beta.xml"]);
});

test("beta requires public 1.0.0 and draft target is exact", () => {
  assert.equal(betaReleaseAllowed("1.1.0-beta.1", []), false);
  assert.equal(betaReleaseAllowed("1.1.0-beta.1", ["v1.0.0"]), true);
  assert.deepEqual(expectedDraftTarget({ tag: "v1.1.0-beta.1", version: "1.1.0-beta.1", channel: "beta" }, "abc"), { tag: "v1.1.0-beta.1", target: "abc", title: "KeyTab 1.1.0-beta.1", prerelease: true });
  assert.equal(betaMirrorTarget("beta", "v1.0.0"), "v1.0.0");
  assert.equal(betaMirrorTarget("stable", "v1.0.0"), null);
  assert.throws(() => betaMirrorTarget("beta", ""), /stable release/);
});

test("release signing accepts one Sparkle source and keeps secrets out of arguments", () => {
  assert.deepEqual(sparkleCredentialSources({ KEYTAB_SPARKLE_ACCOUNT: "KeyTab" }), ["KEYTAB_SPARKLE_ACCOUNT"]);
  assert.equal(sparkleCredentialSources({ KEYTAB_SPARKLE_ACCOUNT: "KeyTab", KEYTAB_SPARKLE_PRIVATE_KEY: "secret" }).length, 2);
  const sparkle = sparkleSigningInvocation("KeyTab.zip", { printOnly: true, environment: { KEYTAB_SPARKLE_PRIVATE_KEY: "sparkle-secret" } });
  assert.deepEqual(sparkle.args, ["--ed-key-file", "-", "-p", "KeyTab.zip"]);
  assert.equal(sparkle.input, "sparkle-secret\n");
  assert.doesNotMatch(sparkle.args.join(" "), /sparkle-secret/);
  const gpg = gpgSigningInvocation("KeyTab.zip", "KeyTab.zip.asc", { KEYTAB_GPG_KEY: "ABC123", KEYTAB_GPG_PASSPHRASE: "gpg-secret" });
  assert.match(gpg.args.join(" "), /--pinentry-mode loopback --passphrase-fd 0/);
  assert.equal(gpg.input, "gpg-secret\n");
  assert.doesNotMatch(gpg.args.join(" "), /gpg-secret/);
});

test("child processes receive only explicitly allowed secrets", () => {
  const environment = { PATH: "/bin", GH_TOKEN: "github-secret", KEYTAB_SPARKLE_PRIVATE_KEY: "sparkle-secret", KEYTAB_GPG_PASSPHRASE: "gpg-secret" };
  assert.deepEqual(childEnvironment(environment), { PATH: "/bin" });
  assert.deepEqual(childEnvironment(environment, {}, ["KEYTAB_SPARKLE_PRIVATE_KEY"]), { PATH: "/bin", KEYTAB_SPARKLE_PRIVATE_KEY: "sparkle-secret" });
});
