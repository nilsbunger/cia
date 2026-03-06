#!/usr/bin/env node
import React from "react"
import { render } from "ink"
import { log } from "./utils"
import App from "./app"

// When invoked via `pnpm --dir`, cwd is the package dir, not the caller's.
// pnpm sets INIT_CWD to the original invoking directory.
if (process.env.INIT_CWD) {
  process.chdir(process.env.INIT_CWD)
}

// Log startup
log("=== Application started ===")

render(<App />)
