#!/usr/bin/env node
import path from "node:path"
import { execaSync } from "execa"
import { render } from "ink"
import App from "./app"
import { log } from "./utils"

// When invoked via `pnpm --dir`, cwd is the package dir, not the caller's.
// pnpm sets INIT_CWD to the original invoking directory.
if (process.env.INIT_CWD) {
  process.chdir(process.env.INIT_CWD)
}

// Guard: must be in a git repo, and not inside a worktree
try {
  const gitDir = path.resolve(execaSync("git", ["rev-parse", "--git-dir"]).stdout.trim())
  const commonDir = path.resolve(execaSync("git", ["rev-parse", "--git-common-dir"]).stdout.trim())
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
