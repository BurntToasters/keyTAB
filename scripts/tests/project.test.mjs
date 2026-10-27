import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { root } from "../lib/core.mjs";
import { checkPbxproj } from "../validate.mjs";

const projectPath = path.join(root, "KeyTab.xcodeproj/project.pbxproj");
const project = fs.readFileSync(projectPath, "utf8");
const swiftFiles = fs.readdirSync(path.join(root, "src"), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".swift"))
  .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"));

const check = (text, extra = {}) => checkPbxproj(text, { base: root, swiftFiles, ...extra });

function sourcesEntry(text, fileName) {
  const match = text.match(new RegExp(`^\\t\\t([0-9A-Z]{24}) /\\* ${fileName.replace(/\./g, "\\.")} in Sources \\*/ = `, "m"));
  return match?.[1] ?? null;
}

test("KeyTab project matches the Swift sources and file references on disk", () => {
  assert.deepEqual(check(project), []);
});

test("a file reference pointing at a missing file fails", () => {
  const broken = project.replace(/path = (\S+?)\.swift;/, "path = NoSuchFileAnywhere.swift;");
  assert.notEqual(broken, project);
  assert.ok(check(broken).some((failure) => failure.includes("missing")));
});

test("a Swift file under src without a file reference fails", () => {
  assert.ok(check(project, { swiftFiles: [...swiftFiles, "src/ghost/Unreferenced.swift"] }).some((failure) => failure.includes("no file reference: src/ghost/Unreferenced.swift")));
});

test("an undefined object ID fails", () => {
  const broken = project.replace(/fileRef = ([0-9A-Z]{24})/, "fileRef = 0000000000000000000000AA");
  assert.ok(check(broken).some((failure) => failure.includes("undefined object ID 0000000000000000000000AA")));
});

test("a duplicated object ID fails", () => {
  const match = project.match(/^\t\t[0-9A-Z]{24} \/\* [^\n]*? = \{isa = PBXFileReference;[^\n]*\n/m);
  const broken = project.replace(match[0], `${match[0]}${match[0]}`);
  assert.ok(check(broken).some((failure) => failure.includes("duplicate key")));
});

test("a Swift file dropped from every Sources build phase fails", () => {
  const id = sourcesEntry(project, "AboutTab.swift");
  assert.ok(id, "AboutTab.swift must be in a Sources phase in the real project");
  const broken = project.split("\n").filter((line) => !line.startsWith(`\t\t\t\t${id} /* AboutTab.swift in Sources */,`)).join("\n");
  assert.ok(check(broken).some((failure) => failure.includes("no Sources build phase: AboutTab.swift")));
});

test("conflict markers and unbalanced braces fail", () => {
  assert.ok(check(`${project}\n<<<<<<< ours\n`).some((failure) => failure.includes("conflict marker")));
  assert.ok(check(project.replace(/\n\}\n$/, "\n")).length > 0);
});
