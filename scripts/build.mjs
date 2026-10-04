import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ensureDirectory, output, root, run, teamId, versionInfo } from "./lib/core.mjs";
import { validateWorkspace as validate } from "./validate.mjs";

const project = "KeyTab.xcodeproj";

export function debugBuildArguments({ unsigned = false, derivedData = "DerivedData" } = {}) {
  const arch = os.arch() === "x64" ? "x86_64" : "arm64";
  const args = ["-project", project, "-scheme", "Debug", "-configuration", "Debug", "-derivedDataPath", derivedData, "-destination", `platform=macOS,arch=${arch}`, "build"];
  if (unsigned) args.push("CODE_SIGNING_ALLOWED=NO");
  return args;
}

export function releaseSigningTargets(app) {
  const sparkle = path.join(app, "Contents/Frameworks/Sparkle.framework");
  return [path.join(sparkle, "Versions/A/Autoupdate"), path.join(sparkle, "Versions/A/Updater.app"), sparkle, app];
}

export function releaseCodesignArguments(target, { identity, entitlements, isApp }) {
  return ["--force", "--options", "runtime", "--timestamp", "--sign", identity, ...(isApp ? ["--entitlements", entitlements] : []), target];
}

function signRelease(app, identity) {
  const entitlements = path.join(root, "KeyTab.entitlements");
  for (const target of releaseSigningTargets(app)) {
    if (!fs.existsSync(target)) throw new Error(`release signing target is missing: ${path.relative(app, target) || path.basename(app)}`);
    run("codesign", releaseCodesignArguments(target, { identity, entitlements, isApp: target === app }));
  }
}

export function buildDebug() {
  validate();
  const unsigned = process.env.KEYTAB_UNSIGNED_BUILD === "1";
  run("xcodebuild", debugBuildArguments({ unsigned }), { env: unsigned ? { KEYTAB_SKIP_EMBED_SIGNING: "1" } : {} });
  const app = path.join(root, "DerivedData/Build/Products/Debug/KeyTab.app");
  validate({ bundle: app });
  if (!unsigned) run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
  console.log(`build:debug: ok (${unsigned ? "unsigned" : "Developer ID signed"})`);
  return app;
}

export function buildRelease() {
  validate({ release: true });
  const { version } = versionInfo();
  const releaseRoot = path.join(root, "dist/release-build");
  const derivedData = path.join(releaseRoot, "DerivedData");
  const app = path.join(root, "dist", `KeyTab-${version}.app`);
  const zip = path.join(root, "dist", `KeyTab-${version}.zip`);
  fs.rmSync(releaseRoot, { recursive: true, force: true });
  fs.rmSync(app, { recursive: true, force: true });
  fs.rmSync(zip, { force: true });
  ensureDirectory(releaseRoot);
  run("xcodebuild", ["-project", project, "-scheme", "Release", "-configuration", "Release", "-derivedDataPath", derivedData, "-destination", "generic/platform=macOS", "ARCHS=arm64 x86_64", "ONLY_ACTIVE_ARCH=NO", "CODE_SIGNING_ALLOWED=NO", "clean", "build"], { env: { KEYTAB_SKIP_EMBED_SIGNING: "1" } });
  const builtApp = path.join(derivedData, "Build/Products/Release/KeyTab.app");
  run("ditto", [builtApp, app]);
  const architectures = output("lipo", ["-archs", path.join(app, "Contents/MacOS/KeyTab")]).split(/\s+/).sort();
  if (architectures.join(" ") !== "arm64 x86_64") throw new Error(`release executable is not universal: ${architectures.join(" ")}`);
  const identity = process.env.KEYTAB_SIGNING_IDENTITY || "Developer ID Application";
  signRelease(app, identity);
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
  const signing = run("codesign", ["-dv", "--verbose=4", app], { capture: true });
  const signingText = `${signing.stdout ?? ""}\n${signing.stderr ?? ""}`;
  if (!signingText.includes(`TeamIdentifier=${teamId}`)) throw new Error(`release app is not signed by team ${teamId}`);
  packageZip(app, zip);
  const profile = process.env.KEYTAB_NOTARY_PROFILE;
  if (!profile) throw new Error("KEYTAB_NOTARY_PROFILE is required for notarization.");
  run("xcrun", ["notarytool", "submit", zip, "--keychain-profile", profile, "--wait", "--timeout", "45m"]);
  run("xcrun", ["stapler", "staple", app]);
  run("xcrun", ["stapler", "validate", app]);
  run("spctl", ["--assess", "--type", "execute", "--verbose=4", app]);
  packageZip(app, zip);
  validate({ release: true, bundle: app });
  console.log(`build:release: ok (${path.basename(zip)})`);
  return { app, zip, architectures };
}

function packageZip(app, zip) {
  fs.rmSync(zip, { force: true });
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", app, zip]);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const action = process.argv[2] ?? "debug";
  if (action === "debug") buildDebug();
  else if (action === "release") buildRelease();
  else throw new Error(`Unknown build action: ${action}`);
}
