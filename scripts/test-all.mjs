import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { output, root, run } from "./lib/core.mjs";
import { clearProof, recordProof } from "./release-session.mjs";

clearProof();
run(process.execPath, ["scripts/sync-version.mjs", "--check"]);
run(process.execPath, ["scripts/validate.mjs"]);
run("python3", ["scripts/l10n/validate_localizations.py"]);
run("python3", ["scripts/assets/compile_illustrations.py", "--check"]);
run("python3", ["scripts/assets/test_compile_illustrations.py"]);
const tests = fs.readdirSync(path.join(root, "scripts/tests")).filter((file) => file.endsWith(".test.mjs")).sort().map((file) => `scripts/tests/${file}`);
run(process.execPath, ["--test", ...tests]);
const arch = os.arch() === "x64" ? "x86_64" : "arm64";
run("xcodebuild", ["-project", "KeyTab.xcodeproj", "-scheme", "Test", "-configuration", "Debug", "-derivedDataPath", "DerivedData/Tests", "-destination", `platform=macOS,arch=${arch}`, "test", "CODE_SIGNING_ALLOWED=NO"], { env: { KEYTAB_SKIP_EMBED_SIGNING: "1" } });
if (output("git", ["status", "--porcelain"])) console.log("test:all: ok (dirty worktree; no reusable release proof recorded)");
else {
  recordProof();
  console.log("test:all: ok (24-hour release proof recorded)");
}
