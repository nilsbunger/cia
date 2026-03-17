#!/usr/bin/env node
import path from "node:path"
import { execaSync } from "execa"
import { render } from "ink"
import App from "./app"
import { getProjectRoot } from "./config"
import { log } from "./utils"

// Guard: must be in a git repo, and not inside a worktree
// Use getProjectRoot() so this works when invoked via `pnpm --dir`
const projectRoot = getProjectRoot()
try {
  const gitDir = path.resolve(
    projectRoot,
    execaSync("git", ["rev-parse", "--git-dir"], { cwd: projectRoot }).stdout.trim(),
  )
  const commonDir = path.resolve(
    projectRoot,
    execaSync("git", ["rev-parse", "--git-common-dir"], { cwd: projectRoot }).stdout.trim(),
  )
  if (gitDir !== commonDir) {
    console.error("Error: cia must be run from the main working tree, not from inside a worktree.")
    process.exit(1)
  }
} catch {
  console.error("Error: cia must be run inside a git repository.")
  process.exit(1)
}

// Log startup
log("=== Application started ===")

const app = render(<App />)
app.waitUntilExit().then(() => process.exit(0))
