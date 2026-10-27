import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { output, readPackage, root, run, sha256File, versionInfo } from "./lib/core.mjs";
import { syncVersion } from "./sync-version.mjs";

const knownPlaceholderHashes = new Set([
  "e77c3c145e867eaee6a56e9ddd073bab44bb01ca5f4079ce4190da34a205c80a",
  "35e2a3c2f55e50b01bb818a02f0619c7c43a61a43a4c19be4c6d3cced181e7ae",
  "5cca61c9e86ce778636138355960e169bdd0a9f20d8c456de3aa4ae8233d2411",
  "614b0d740fd4a8f624be0a98f0cad5fe28b81f2806304f7e953951e2fd767dc2",
]);

export function releaseArtworkReady(base = root) {
  const icon = "resources/icons/app/AppIcon.icon";
  const assets = path.join(base, icon, "Assets");
  if (!fs.existsSync(path.join(base, icon, "icon.json")) || !fs.existsSync(assets)) return false;
  const iconFiles = [path.join(icon, "icon.json"), ...fs.readdirSync(assets).map((file) => path.join(icon, "Assets", file))];
  return artworkHashesReady(iconFiles.map((file) => sha256File(path.join(base, file))));
}

export function artworkHashesReady(hashes) {
  return hashes.length > 0 && hashes.every((hash) => !knownPlaceholderHashes.has(hash));
}

function swiftStringLiterals(line) {
  const literals = [];
  let current = null;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (current === null) {
      if (character === "/" && line[index + 1] === "/") break;
      if (character === '"') current = "";
    } else if (character === "\\") {
      current += line.slice(index, index + 2);
      index++;
    } else if (character === '"') {
      literals.push(current);
      current = null;
    } else current += character;
  }
  return literals;
}

export function swiftRuntimeBrandingLines(source) {
  return source.split("\n").flatMap((line, index) => {
    if (line.includes("modified fork of AltTab v11.10.1")) return [];
    return swiftStringLiterals(line).some((literal) => literal.includes("AltTab")) ? [index + 1] : [];
  });
}

export function isMachO(buffer) {
  if (buffer.length < 4) return false;
  const magic = buffer.readUInt32BE(0);
  return [0xcffaedfe, 0xcefaedfe, 0xfeedfacf, 0xfeedface, 0xcafebabe, 0xcafebabf].includes(magic);
}

export function signingTeamMismatches(entries, team) {
  return entries.filter((entry) => entry.team !== team).map((entry) => `${entry.file} is signed by ${entry.team ?? "no team"}`);
}

function machOFilesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return machOFilesUnder(absolute);
    const handle = fs.openSync(absolute, "r");
    try {
      const head = Buffer.alloc(4);
      return isMachO(head.subarray(0, fs.readSync(handle, head, 0, 4, 0))) ? [absolute] : [];
    } finally {
      fs.closeSync(handle);
    }
  });
}

function signingTeam(file) {
  const result = run("codesign", ["-dv", "--verbose=2", file], { capture: true, allowFailure: true });
  const team = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.match(/^TeamIdentifier=(\S+)$/m)?.[1];
  return team && team !== "not" ? team : null;
}

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  });
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function scanText(filePaths, pattern, label, failures, allowed = () => false) {
  for (const file of filePaths) {
    const contents = fs.readFileSync(file, "utf8");
    if (pattern.test(contents) && !allowed(file, contents)) failures.push(`${label}: ${path.relative(root, file)}`);
    pattern.lastIndex = 0;
  }
}

const pbxTokens = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"((?:\\.|[^"\\])*)"|([A-Za-z0-9_$./:+\-]+)|([\s\S])/g;
const pbxObjectId = /^[0-9A-Z]{24}$/;
const pbxOptionalFiles = ["config/local.xcconfig"];

export function parsePbxproj(text) {
  const tokens = [...text.matchAll(pbxTokens)].flatMap((match) => {
    if (match[1] !== undefined) return [{ value: match[1] }];
    if (match[2] !== undefined) return [{ value: match[2] }];
    if (match[3] !== undefined) return [{ value: match[3], punctuation: true }];
    return [];
  });
  const duplicateKeys = [];
  let index = 0;
  const isPunctuation = (value) => tokens[index]?.punctuation === true && tokens[index].value === value;
  const expect = (value) => {
    if (!isPunctuation(value)) throw new Error(`pbxproj: expected "${value}" at token ${index} (${tokens[index]?.value ?? "end of file"})`);
    index++;
  };
  const parseValue = () => {
    if (isPunctuation("{")) {
      index++;
      const dictionary = {};
      while (!isPunctuation("}")) {
        if (index >= tokens.length) throw new Error("pbxproj: unterminated dictionary");
        const key = tokens[index++].value;
        expect("=");
        if (Object.hasOwn(dictionary, key)) duplicateKeys.push(key);
        dictionary[key] = parseValue();
        expect(";");
      }
      index++;
      return dictionary;
    }
    if (isPunctuation("(")) {
      index++;
      const list = [];
      while (!isPunctuation(")")) {
        if (index >= tokens.length) throw new Error("pbxproj: unterminated list");
        list.push(parseValue());
        if (isPunctuation(",")) index++;
      }
      index++;
      return list;
    }
    if (index >= tokens.length) throw new Error("pbxproj: unexpected end of file");
    return tokens[index++].value;
  };
  const document = parseValue();
  if (index !== tokens.length) throw new Error(`pbxproj: trailing content at token ${index}`);
  return { document, duplicateKeys };
}

function pbxReferencedIds(value, visit) {
  if (typeof value === "string") {
    if (pbxObjectId.test(value)) visit(value);
  } else if (Array.isArray(value)) {
    for (const item of value) pbxReferencedIds(item, visit);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) pbxReferencedIds(item, visit);
  }
}

export function checkPbxproj(text, { base = root, swiftFiles = [], optionalFiles = pbxOptionalFiles } = {}) {
  const failures = [];
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(text)) failures.push("pbxproj: conflict marker remains");
  let parsed;
  try {
    parsed = parsePbxproj(text);
  } catch (error) {
    return [...failures, error.message];
  }
  for (const key of new Set(parsed.duplicateKeys)) failures.push(`pbxproj: duplicate key ${key}`);
  const objects = parsed.document.objects ?? {};
  const relative = (absolute) => path.relative(base, absolute).split(path.sep).join("/");
  const parents = new Map();
  for (const [id, object] of Object.entries(objects)) {
    if (object.isa === "PBXGroup" || object.isa === "PBXVariantGroup") for (const child of object.children ?? []) parents.set(child, id);
  }
  const resolvePath = (id) => {
    const chain = [];
    for (let current = id; current; current = parents.get(current)) chain.unshift(objects[current]);
    let directory = base;
    for (const node of chain) {
      const tree = node.sourceTree ?? "<group>";
      const location = node.path ?? (node.isa === "PBXFileReference" ? node.name : undefined);
      if (tree === "<group>") {
        if (location !== undefined) directory = path.join(directory, location);
      } else if (tree === "SOURCE_ROOT") directory = path.join(base, location ?? "");
      else if (tree === "<absolute>") directory = location;
      else return null;
    }
    return directory;
  };
  const referencedFiles = new Set();
  for (const [id, object] of Object.entries(objects)) {
    if (object.isa !== "PBXFileReference") continue;
    const absolute = resolvePath(id);
    if (!absolute || absolute.endsWith(".framework")) continue;
    const rel = relative(absolute);
    referencedFiles.add(rel);
    if (!fs.existsSync(absolute) && !optionalFiles.includes(rel)) failures.push(`pbxproj: file reference ${id} points to missing ${rel}`);
  }
  for (const file of swiftFiles) {
    if (!referencedFiles.has(file)) failures.push(`pbxproj: Swift file has no file reference: ${file}`);
  }
  const undefinedIds = new Set();
  for (const [id, object] of Object.entries(objects)) {
    pbxReferencedIds(object, (ref) => {
      if (!Object.hasOwn(objects, ref)) undefinedIds.add(`${ref} (in ${id})`);
    });
  }
  pbxReferencedIds(parsed.document.rootObject, (ref) => {
    if (!Object.hasOwn(objects, ref)) undefinedIds.add(`${ref} (rootObject)`);
  });
  for (const ref of undefinedIds) failures.push(`pbxproj: undefined object ID ${ref}`);
  const buildFiles = new Map(Object.entries(objects).filter(([, object]) => object.isa === "PBXBuildFile").map(([id, object]) => [id, object.fileRef]));
  const sourcesRefs = new Set();
  for (const object of Object.values(objects)) {
    if (object.isa !== "PBXSourcesBuildPhase") continue;
    for (const buildFile of object.files ?? []) if (buildFiles.has(buildFile)) sourcesRefs.add(buildFiles.get(buildFile));
  }
  for (const [id, object] of Object.entries(objects)) {
    if (object.isa !== "PBXFileReference") continue;
    const name = object.path ?? object.name ?? "";
    if (name.endsWith(".swift") && !sourcesRefs.has(id)) failures.push(`pbxproj: Swift file is in no Sources build phase: ${name} (${id})`);
  }
  return failures;
}

export function validateWorkspace({ release = false, bundle = null } = {}) {
  const failures = [];
  const packageJson = readPackage();
  const { version, buildNumber } = versionInfo();
  assert(packageJson.name === "keytab", "package name must be keytab", failures);
  assert(packageJson.license === "GPL-3.0-only", "package license must be GPL-3.0-only", failures);
  assert(packageJson.engines?.node === ">=22.12", "Node engine must be >=22.12", failures);
  try { syncVersion({ check: true }); } catch (error) { failures.push(error.message); }
  const baseConfig = fs.readFileSync(path.join(root, "config/base.xcconfig"), "utf8");
  assert(baseConfig.includes("PRODUCT_BUNDLE_IDENTIFIER = run.rosie.keytab"), "bundle ID mismatch", failures);
  assert(baseConfig.includes("PRODUCT_NAME = KeyTab"), "product name mismatch", failures);
  assert(baseConfig.includes("MACOSX_DEPLOYMENT_TARGET = 14.0"), "minimum macOS must be 14.0", failures);
  const info = fs.readFileSync(path.join(root, "Info.plist"), "utf8");
  assert(info.includes("<key>SUEnableSystemProfiling</key>\n\t<false/>"), "Sparkle system profiling must be disabled", failures);
  assert(!info.includes("CFBundleURLTypes"), "custom activation URL scheme remains", failures);
  const entitlements = fs.readFileSync(path.join(root, "KeyTab.entitlements"), "utf8");
  assert(!entitlements.includes("com.apple.security.cs.disable-library-validation"), "library validation must remain enabled", failures);
  assert(!ownedSwiftImportsSwiftUI(), "KeyTab-owned SwiftUI remains", failures);
  const ownedInterfaceFiles = filesUnder(path.join(root, "resources")).filter((file) => /\.(xib|storyboard)$/i.test(file));
  assert(ownedInterfaceFiles.length === 0, `KeyTab-owned Interface Builder files remain: ${ownedInterfaceFiles.map((file) => path.relative(root, file)).join(", ")}`, failures);
  const forbiddenPaths = ["src/pro", "src/api", "vendor/AppCenter", "resources/SF-Pro-Text-Regular.otf"];
  for (const file of forbiddenPaths) {
    const absolute = path.join(root, file);
    assert(!fs.existsSync(absolute) || (fs.statSync(absolute).isDirectory() && filesUnder(absolute).length === 0), `forbidden path remains: ${file}`, failures);
  }
  const ownedFiles = [
    ...filesUnder(path.join(root, "src")).filter((file) => file.endsWith(".swift")),
    ...filesUnder(path.join(root, "resources/l10n")).filter((file) => file.endsWith(".strings")),
    path.join(root, "Info.plist"),
    path.join(root, "KeyTab.xcodeproj/project.pbxproj"),
  ];
  scanText(ownedFiles, /AppCenter|ProGated|LicenseManager|LicenseState|LicenseAPI|LicenseCookie|MachineFingerprint|UpgradeTab|FeedbackWindow|14-day[^\n]*trial|LemonSqueezy|polar\.sh|checkout/i, "paywall or telemetry residue", failures);
  scanText(ownedFiles, /com\.lwouis\.alt-tab-macos|com\.lwouis\.alttab|alt_tab_macos/i, "old runtime identifier", failures);
  scanText(ownedFiles, /xattr[^\n]*com\.apple\.quarantine/i, "Gatekeeper quarantine bypass", failures);
  scanText(filesUnder(path.join(root, "scripts")), /readOnlyToken\s*=\s*["'][^"'$]{16,}["']/i, "hardcoded external-service token", failures);
  const restricted = [path.join(root, "src"), path.join(root, "resources")].flatMap(filesUnder).filter((file) => !file.includes(`${path.sep}vendor${path.sep}`) && /\.(otf|ttf)$/i.test(file));
  assert(restricted.length === 0, `restricted bundled fonts remain: ${restricted.map((file) => path.relative(root, file)).join(", ")}`, failures);
  for (const file of filesUnder(path.join(root, "src")).filter((entry) => entry.endsWith(".swift"))) {
    for (const line of swiftRuntimeBrandingLines(fs.readFileSync(file, "utf8"))) failures.push(`AltTab runtime branding: ${path.relative(root, file)}:${line}`);
  }
  for (const required of [".env.example", "LICENCE.md", "NOTICE.md", "THIRD_PARTY_NOTICES.md", "resources/licenses/Sparkle-LICENSE.txt", "resources/licenses/ShortcutRecorder-LICENSE.txt", "docs/ASSET_LICENSES.md"]) {
    assert(fs.existsSync(path.join(root, required)), `missing compliance file: ${required}`, failures);
  }
  const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  const envKeys = ["KEYTAB_SIGNING_IDENTITY", "KEYTAB_NOTARY_PROFILE", "KEYTAB_SPARKLE_ACCOUNT", "KEYTAB_SPARKLE_PRIVATE_KEY_FILE", "KEYTAB_SPARKLE_PRIVATE_KEY", "KEYTAB_GPG_KEY", "KEYTAB_GPG_PASSPHRASE", "KEYTAB_KEYCHAIN_PASSWORD", "SSH_USER_PWD", "KEYTAB_KEYCHAIN_PATH"];
  for (const key of envKeys) assert(new RegExp(`^${key}=`, "m").test(envExample), `.env.example is missing ${key}`, failures);
  for (const key of ["KEYTAB_SPARKLE_PRIVATE_KEY", "KEYTAB_GPG_PASSPHRASE", "KEYTAB_KEYCHAIN_PASSWORD", "SSH_USER_PWD"]) assert(new RegExp(`^${key}=$`, "m").test(envExample), `.env.example must not contain ${key}`, failures);
  assert(!/^GH_TOKEN=/m.test(envExample), ".env.example must use GitHub CLI authentication", failures);
  if (release) {
    const sparkleLine = baseConfig.split("\n").find((line) => line.startsWith("SPARKLE_PUBLIC_KEY =")) ?? "";
    assert(sparkleLine.replace("SPARKLE_PUBLIC_KEY =", "").trim().length > 0, "new KeyTab Sparkle public key is not configured", failures);
    assert(releaseArtworkReady(), "upstream placeholder app artwork remains", failures);
  }
  const projectFailures = checkPbxproj(fs.readFileSync(path.join(root, "KeyTab.xcodeproj/project.pbxproj"), "utf8"), {
    swiftFiles: filesUnder(path.join(root, "src")).filter((file) => file.endsWith(".swift")).map((file) => path.relative(root, file).split(path.sep).join("/")),
  });
  failures.push(...projectFailures);
  if (bundle) validateBundle(path.resolve(bundle), { version, buildNumber, release }, failures);
  if (failures.length) throw new Error(failures.join("\n"));
  return { version, buildNumber };
}

function ownedSwiftImportsSwiftUI() {
  return filesUnder(path.join(root, "src")).filter((file) => file.endsWith(".swift")).some((file) => /^import SwiftUI$/m.test(fs.readFileSync(file, "utf8")));
}

function validateBundle(bundle, expected, failures) {
  assert(fs.existsSync(bundle), `built bundle not found: ${bundle}`, failures);
  if (!fs.existsSync(bundle)) return;
  const plist = path.join(bundle, "Contents/Info.plist");
  const identifier = output("plutil", ["-extract", "CFBundleIdentifier", "raw", plist]);
  const version = output("plutil", ["-extract", "CFBundleShortVersionString", "raw", plist]);
  const build = output("plutil", ["-extract", "CFBundleVersion", "raw", plist]);
  const minimumSystem = output("plutil", ["-extract", "LSMinimumSystemVersion", "raw", plist]);
  assert(identifier === "run.rosie.keytab", `built bundle ID is ${identifier}`, failures);
  assert(version === expected.version, `built version is ${version}`, failures);
  assert(build === String(expected.buildNumber), `built build number is ${build}`, failures);
  assert(minimumSystem === "14.0", `built minimum macOS is ${minimumSystem}`, failures);
  const binary = path.join(bundle, "Contents/MacOS/KeyTab");
  const buildVersions = output("vtool", ["-show-build", binary]);
  assert(/minos 14\.0(?:\D|$)/.test(buildVersions), "built executable minimum macOS is not 14.0", failures);
  if (expected.release) {
    const architectures = output("lipo", ["-archs", binary]).split(/\s+/).sort().join(" ");
    assert(architectures === "arm64 x86_64", `release architectures are ${architectures}`, failures);
    const signing = run("codesign", ["-dv", "--verbose=4", bundle], { capture: true });
    const signingText = `${signing.stdout ?? ""}\n${signing.stderr ?? ""}`;
    assert(signingText.includes("TeamIdentifier=FYJZP8B2KG"), "release Team ID mismatch", failures);
    const nested = machOFilesUnder(bundle).map((file) => ({ file: path.relative(bundle, file), team: signingTeam(file) }));
    failures.push(...signingTeamMismatches(nested, "FYJZP8B2KG").map((mismatch) => `release nested signature: ${mismatch}`));
    assert(/flags=.*runtime/.test(signingText), "release hardened runtime is missing", failures);
    const entitlements = run("codesign", ["-d", "--entitlements", ":-", bundle], { capture: true });
    const entitlementText = `${entitlements.stdout ?? ""}\n${entitlements.stderr ?? ""}`;
    assert(!/com\.apple\.security\.get-task-allow[\s\S]{0,80}<true\/>/.test(entitlementText), "release contains get-task-allow", failures);
  }
  const strings = output("strings", ["-a", binary]);
  if (/AppCenter|ProGated|LicenseManager|14-day Pro trial|com\.lwouis\.alt-tab-macos/.test(strings)) failures.push("built executable contains paywall, telemetry, or old identifier residue");
  const resourceText = filesUnder(path.join(bundle, "Contents/Resources")).filter((file) => /\.(strings|plist|xml)$/i.test(file));
  scanText(resourceText, /14-day Pro trial|Activate your Pro license|AppCenter|com\.lwouis\.alt-tab-macos/i, "built resource residue", failures);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const release = process.argv.includes("--release");
    const bundleIndex = process.argv.indexOf("--bundle");
    const bundle = bundleIndex >= 0 ? process.argv[bundleIndex + 1] : null;
    const result = validateWorkspace({ release, bundle });
    console.log(`validate: ok (${result.version}, build ${result.buildNumber})`);
  } catch (error) {
    console.error(`validate: FAILED:\n${error.message}`);
    process.exit(1);
  }
}
