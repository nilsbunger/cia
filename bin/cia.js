#!/usr/bin/env node
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {createRequire} from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to THIS package, not the user's CWD
const pkgRoot = path.resolve(__dirname, "..");
const requireFromHere = createRequire(path.join(pkgRoot, "package.json"));

let tsxLoader;
try {
  // Absolute path to the tsx loader entry, e.g. /.../node_modules/tsx/dist/loader.mjs
  tsxLoader = requireFromHere.resolve("tsx");
} catch (e) {
  console.error(
    "[cia] Could not resolve 'tsx'. Make sure it's listed in this package's dependencies:\n" +
    "  pnpm add -D tsx\n" +
    "and re-link: pnpm link --global"
  );
  process.exit(1);
}

const target = path.resolve(pkgRoot, "src/agents-tui.tsx");

// Node >=20.6 recommended; check & warn
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 6)) {
  console.warn("[cia] Node 20.6+ is recommended. Detected:", process.versions.node);
}

// Inherit env & stdio; pass through all CLI args
const child = spawn(process.execPath, ["--import", tsxLoader, target, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env, // keep user env intact
});

child.on("exit", code => process.exit(code ?? 0));
child.on("error", err => {
  console.error("[cia] Failed to start:", err);
  process.exit(1);
});
