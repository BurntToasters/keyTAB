import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildRelease } from "./build.mjs";
import { appcastFilename, writeAppcast } from "./lib/appcast.mjs";
import { releaseNotes } from "./lib/changelog.mjs";
import { ensureDirectory, output, repository, repositoryUrl, root, run, sha256File, versionInfo } from "./lib/core.mjs";
import { runPreflight, sparkleCredentialSources } from "./release-preflight.mjs";
import { createSession, verifySession } from "./release-session.mjs";

function ghResult(args) {
  return run("gh", args, { capture: true, allowFailure: true });
}

function ghRun(args) {
  return run("gh", args);
}

function ghOutput(args) {
  return output("gh", args);
}

export function expectedDraftTarget(info, commit) {
  return { tag: info.tag, target: commit, title: `KeyTab ${info.version}`, prerelease: info.channel === "beta" };
}

export function betaMirrorTarget(channel, latestStableTag) {
  if (channel !== "beta") return null;
  if (!latestStableTag) throw new Error("beta feed mirroring requires a public stable release");
  return latestStableTag;
}

export function feedFilenames(channel) {
  return channel === "beta" ? [appcastFilename("beta")] : [appcastFilename("stable"), appcastFilename("beta")];
}

function ensureDraft(info, commit) {
  const result = ghResult(["release", "view", info.tag, "--repo", repository, "--json", "isDraft,targetCommitish"]);
  if (result.status === 0) {
    const release = JSON.parse(result.stdout);
    if (!release.isDraft) throw new Error(`${info.tag} is already published.`);
    if (![commit, info.channel === "beta" ? "beta" : "main"].includes(release.targetCommitish)) throw new Error(`${info.tag} draft targets ${release.targetCommitish}, not this release commit.`);
    return;
  }
  const draft = expectedDraftTarget(info, commit);
  const args = ["release", "create", draft.tag, "--repo", repository, "--draft", "--target", draft.target, "--title", draft.title, "--notes", `KeyTab ${info.version} release. See the tagged source and bundled notices for corresponding GPL source and licensing information.`];
  if (draft.prerelease) args.push("--prerelease");
  ghRun(args);
}

export function sparkleSigningInvocation(file, { printOnly = false, verify = false, signature = null, environment = process.env } = {}) {
  const sources = sparkleCredentialSources(environment);
  if (sources.length !== 1) throw new Error("Sparkle signing requires exactly one configured credential source.");
  const args = [];
  if (verify) args.push("--verify");
  let input;
  if (environment.KEYTAB_SPARKLE_PRIVATE_KEY) {
    args.push("--ed-key-file", "-");
    input = environment.KEYTAB_SPARKLE_PRIVATE_KEY.endsWith("\n") ? environment.KEYTAB_SPARKLE_PRIVATE_KEY : `${environment.KEYTAB_SPARKLE_PRIVATE_KEY}\n`;
  } else if (environment.KEYTAB_SPARKLE_PRIVATE_KEY_FILE) args.push("--ed-key-file", path.resolve(root, environment.KEYTAB_SPARKLE_PRIVATE_KEY_FILE));
  else args.push("--account", environment.KEYTAB_SPARKLE_ACCOUNT);
  if (printOnly) args.push("-p");
  args.push(file);
  if (signature) args.push(signature);
  return { args, input };
}

function signSparkle(file, printOnly = false) {
  const invocation = sparkleSigningInvocation(file, { printOnly });
  return output(path.join(root, "vendor/Sparkle/bin/sign_update"), invocation.args, { input: invocation.input }).trim();
}

function verifySparkle(file) {
  const invocation = sparkleSigningInvocation(file, { verify: true });
  run(path.join(root, "vendor/Sparkle/bin/sign_update"), invocation.args, { input: invocation.input });
}

function verifySparkleArchive(file, signature) {
  const invocation = sparkleSigningInvocation(file, { verify: true, signature });
  run(path.join(root, "vendor/Sparkle/bin/sign_update"), invocation.args, { input: invocation.input });
}

export function gpgSigningInvocation(file, signature, environment = process.env) {
  const args = ["--batch", "--yes"];
  let input;
  if (environment.KEYTAB_GPG_PASSPHRASE) {
    args.push("--pinentry-mode", "loopback", "--passphrase-fd", "0");
    input = environment.KEYTAB_GPG_PASSPHRASE.endsWith("\n") ? environment.KEYTAB_GPG_PASSPHRASE : `${environment.KEYTAB_GPG_PASSPHRASE}\n`;
  }
  args.push("--armor", "--detach-sign", "--local-user", environment.KEYTAB_GPG_KEY, "--output", signature, file);
  return { args, input };
}

function signGpg(file) {
  const signature = `${file}.asc`;
  fs.rmSync(signature, { force: true });
  const invocation = gpgSigningInvocation(file, signature);
  run("gpg", invocation.args, { input: invocation.input });
  return signature;
}

function writeChecksums(files, destination) {
  const contents = files.map((file) => `${sha256File(file)}  ${path.basename(file)}`).join("\n");
  fs.writeFileSync(destination, `${contents}\n`);
  return destination;
}

function prepare() {
  runPreflight({ release: true });
  run("npm", ["run", "test:all"]);
  createSession();
  console.log("release:prepare: ok (24-hour session recorded)");
}

function continueRelease() {
  const session = verifySession();
  runPreflight({ release: true });
  const info = versionInfo();
  ensureDraft(info, session.identity.commit);
  const { zip } = buildRelease();
  const signature = signSparkle(zip, true);
  const appcast = writeAppcast(path.dirname(zip), { ...info, signature, length: fs.statSync(zip).size });
  signSparkle(appcast);
  const feeds = feedFilenames(info.channel).map((name) => path.join(path.dirname(zip), name));
  for (const feed of feeds.filter((feed) => feed !== appcast)) fs.copyFileSync(appcast, feed);
  const checksums = writeChecksums([zip, appcast], path.join(path.dirname(zip), "SHA256SUMS"));
  const assets = [zip, ...feeds, checksums];
  assets.push(...assets.map(signGpg));
  ghRun(["release", "upload", info.tag, "--repo", repository, "--clobber", ...assets]);
  const notes = path.join(path.dirname(zip), "RELEASE_NOTES.md");
  fs.writeFileSync(notes, releaseNotes(info));
  ghRun(["release", "edit", info.tag, "--repo", repository, "--notes-file", notes]);
  console.log(`release:mac:continue: draft uploaded (${assets.map((asset) => path.basename(asset)).join(", ")})`);
}

function publish() {
  verifySession();
  const info = runPreflight({ release: true });
  ghRun(["release", "edit", info.tag, "--repo", repository, "--draft=false", ...(info.channel === "beta" ? ["--prerelease"] : ["--latest"])]);
  if (info.channel === "beta") {
    const feed = path.join(root, "dist", appcastFilename("beta"));
    if (!fs.existsSync(feed)) throw new Error("beta appcast is missing from the prepared release assets.");
    if (!fs.readFileSync(feed, "utf8").includes(`KeyTab-${info.version}.zip`)) throw new Error(`prepared beta appcast does not describe ${info.tag}.`);
    const stableTag = betaMirrorTarget(info.channel, ghOutput(["release", "view", "--repo", repository, "--json", "tagName", "--jq", ".tagName"]));
    ghRun(["release", "upload", stableTag, "--repo", repository, "--clobber", feed, signGpg(feed)]);
  }
  console.log(`release:publish: ok (${info.tag})`);
}

async function verifyPublished() {
  const info = versionInfo();
  const release = JSON.parse(ghOutput(["release", "view", info.tag, "--repo", repository, "--json", "isDraft,isPrerelease"]));
  if (release.isDraft) throw new Error(`${info.tag} is still a draft`);
  if (release.isPrerelease !== (info.channel === "beta")) throw new Error(`${info.tag} prerelease flag does not match the ${info.channel} channel`);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "keytab-release-"));
  try {
    ghRun(["release", "download", info.tag, "--repo", repository, "--dir", temp]);
    const zip = path.join(temp, `KeyTab-${info.version}.zip`);
    const appcast = path.join(temp, appcastFilename(info.channel));
    const checksums = path.join(temp, "SHA256SUMS");
    for (const file of [zip, appcast, checksums]) {
      if (!fs.existsSync(file) || !fs.existsSync(`${file}.asc`)) throw new Error(`published asset or GPG signature missing: ${path.basename(file)}`);
      run("gpg", ["--verify", `${file}.asc`, file]);
    }
    const expected = new Map(fs.readFileSync(checksums, "utf8").trim().split("\n").map((line) => {
      const [hash, filename] = line.split(/\s+/, 2);
      return [filename, hash];
    }));
    for (const file of [zip, appcast]) if (expected.get(path.basename(file)) !== sha256File(file)) throw new Error(`published checksum mismatch: ${path.basename(file)}`);
    verifySparkle(appcast);
    const xml = fs.readFileSync(appcast, "utf8");
    if (!xml.includes(`KeyTab-${info.version}.zip`) || !xml.includes(`sparkle:version>${info.buildNumber}<`)) throw new Error("published appcast identity mismatch");
    const signature = xml.match(/sparkle:edSignature="([^"]+)"/)?.[1];
    if (!signature) throw new Error("published appcast has no archive signature");
    verifySparkleArchive(zip, signature);
    await verifyLiveFeed(info);
    console.log(`release:verify:published: ok (${info.tag})`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/// Fetches the feed URL installed copies poll (SparkleDelegate.feedURLString) and waits for GitHub to serve this build.
async function verifyLiveFeed(info, attempts = 6) {
  const url = `${repositoryUrl}/releases/latest/download/${appcastFilename(info.channel)}`;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, { cache: "no-store" });
    if (response.ok && (await response.text()).includes(`sparkle:version>${info.buildNumber}<`)) return;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`${url} does not offer build ${info.buildNumber} yet; installed copies will not see ${info.tag}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const action = process.argv[2];
    if (action === "prepare") prepare();
    else if (action === "continue") continueRelease();
    else if (action === "publish") publish();
    else if (action === "verify-published") await verifyPublished();
    else throw new Error("Usage: release.mjs prepare|continue|publish|verify-published");
  } catch (error) {
    console.error(`release: FAILED:\n${error.message}`);
    process.exit(1);
  }
}
