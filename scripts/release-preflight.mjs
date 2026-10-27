import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expectedBranch, output, repository, repositoryUrl, root, run, teamId, versionInfo } from "./lib/core.mjs";
import { validateWorkspace } from "./validate.mjs";

const escapedRepository = repository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const canonicalOrigin = new RegExp(`^(?:https://github\\.com/|git@github\\.com:)${escapedRepository}(?:\\.git)?/?$`, "i");

export function isCanonicalOrigin(origin) {
  return canonicalOrigin.test(origin ?? "");
}

export function validateRepositoryState({ version, branch, origin, status, head, remoteHead, upstream, tagHead = null, draftTarget = null }) {
  const failures = [];
  const requiredBranch = expectedBranch(version);
  if (!isCanonicalOrigin(origin)) failures.push(`origin must be ${repositoryUrl}`);
  if (branch !== requiredBranch) failures.push(`${version} releases must run from ${requiredBranch}`);
  if (status) failures.push("release worktree must be clean");
  if (upstream !== `origin/${branch}`) failures.push(`branch must track origin/${branch}`);
  if (head !== remoteHead) failures.push("HEAD is not pushed to its canonical origin branch");
  if (tagHead && tagHead !== head) failures.push(`existing v${version} tag targets another commit`);
  if (draftTarget && ![head, branch].includes(draftTarget)) failures.push(`existing v${version} draft targets another commit`);
  return failures;
}

function optional(command, args) {
  const result = run(command, args, { capture: true, allowFailure: true });
  return result.status === 0 ? String(result.stdout).trim() : null;
}

export function betaReleaseAllowed(version, stableTags) {
  return !version.includes("-beta.") || stableTags.some((tag) => !tag.includes("-beta."));
}

export function sparkleCredentialSources(environment = process.env) {
  return ["KEYTAB_SPARKLE_ACCOUNT", "KEYTAB_SPARKLE_PRIVATE_KEY_FILE", "KEYTAB_SPARKLE_PRIVATE_KEY"].filter((name) => environment[name]);
}

export function runPreflight({ release = false } = {}) {
  if (process.platform !== "darwin") throw new Error("KeyTab releases require macOS.");
  const failures = [];
  try { validateWorkspace({ release }); } catch (error) { failures.push(error.message); }
  const info = versionInfo();
  output("git", ["fetch", "origin", "--tags", "--prune"]);
  const branch = output("git", ["branch", "--show-current"]);
  const origin = output("git", ["remote", "get-url", "origin"]);
  const state = {
    version: info.version,
    branch,
    origin,
    status: output("git", ["status", "--porcelain"]),
    head: output("git", ["rev-parse", "HEAD"]),
    remoteHead: optional("git", ["rev-parse", `origin/${branch}`]),
    upstream: optional("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]),
    tagHead: optional("git", ["rev-list", "-n", "1", info.tag]),
    draftTarget: optional("gh", ["api", `repos/${repository}/releases/tags/${info.tag}`, "--jq", ".target_commitish"]),
  };
  failures.push(...validateRepositoryState(state));
  const stableTags = optional("gh", ["release", "list", "--repo", repository, "--json", "tagName,isDraft", "--jq", ".[] | select(.isDraft == false) | .tagName"])?.split(/\s+/).filter(Boolean) ?? [];
  if (!betaReleaseAllowed(info.version, stableTags)) failures.push("beta publishing is blocked until a stable release is public");
  if (release) {
    if (!process.env.KEYTAB_NOTARY_PROFILE) failures.push("KEYTAB_NOTARY_PROFILE is required");
    if (!process.env.KEYTAB_GPG_KEY) failures.push("KEYTAB_GPG_KEY is required");
    const sparkleSources = sparkleCredentialSources();
    if (sparkleSources.length !== 1) failures.push("configure exactly one of KEYTAB_SPARKLE_ACCOUNT, KEYTAB_SPARKLE_PRIVATE_KEY_FILE, or KEYTAB_SPARKLE_PRIVATE_KEY");
    if (process.env.KEYTAB_SPARKLE_PRIVATE_KEY_FILE && !fs.existsSync(path.resolve(root, process.env.KEYTAB_SPARKLE_PRIVATE_KEY_FILE))) failures.push("KEYTAB_SPARKLE_PRIVATE_KEY_FILE does not exist");
    if (optional("security", ["find-identity", "-v", "-p", "codesigning"])?.includes(teamId) !== true) failures.push(`Developer ID identity for team ${teamId} is unavailable`);
    if (optional("gh", ["auth", "status", "--hostname", "github.com"]) === null) failures.push("GitHub CLI authentication is required");
    if (optional("gh", ["repo", "view", repository, "--json", "visibility", "--jq", ".visibility"]) !== "PUBLIC") failures.push("canonical KeyTab repository must be public");
  }
  if (failures.length) throw new Error(failures.join("\n"));
  return { ...info, branch, head: state.head };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = runPreflight({ release: process.argv.includes("--release") });
    console.log(`release-preflight: ok (${result.tag})`);
  } catch (error) {
    console.error(`release-preflight: FAILED:\n${error.message}`);
    process.exit(1);
  }
}
