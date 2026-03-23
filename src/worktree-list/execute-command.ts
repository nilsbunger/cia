import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import chalk from "chalk"
import type { Action, AppState } from "../app-state-reducer"
import { checkDeleteIssues, checkForConflicts, ensureWorktree } from "../cmd-helpers"
import { deleteWorktree, openEditor } from "../cmd-ops"
import { getCiaTempDir } from "../config"
import { pushBranch, syncBranch } from "../git-ops"
import { isServiceRunning, runService } from "../service"
import type { Worktree } from "../types"
import { log } from "../utils"

export async function executeWorktreeCommand(
  commandKey: string,
  wt: Worktree,
  state: AppState,
  dispatch: React.Dispatch<Action>,
  refresh: () => Promise<void>,
) {
  if (commandKey === "e") {
    dispatch({ type: "set-msg", msg: `Opening ${wt.name}…` })
    const dir = await ensureWorktree(wt.name)
    await openEditor(dir, wt.name)
    dispatch({ type: "set-msg", msg: `Opened ${wt.name}` })
    return
  }

  if (commandKey === "c") {
    dispatch({ type: "set-msg", msg: `Opening commit terminal for ${wt.name}…` })
    try {
      const dir = await ensureWorktree(wt.name)
      await openCommitTerminal(wt.name, dir)
      dispatch({ type: "set-msg", msg: `Opened commit terminal for ${wt.name}` })
      // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      dispatch({ type: "set-msg", msg: chalk.red(`Failed: ${e.shortMessage || e.message}`) })
    }
    return
  }

  if (commandKey === "r") {
    if (!state.repoRoot) return
    if (!state.runCommand) {
      dispatch({
        type: "set-msg",
        msg: chalk.red("No run command configured. Use /config to set it."),
      })
      return
    }
    dispatch({ type: "set-msg", msg: `Starting service for ${wt.name}…` })
    try {
      const dir = await ensureWorktree(wt.name)
      const runDir = state.runDir ? path.join(dir, state.runDir) : dir
      await runService(wt.name, runDir, state.runCommand)
      dispatch({ type: "set-msg", msg: `Service started for ${wt.name} (new terminal)` })
      // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      dispatch({ type: "set-msg", msg: chalk.red(`Failed: ${e.shortMessage || e.message}`) })
    }
    await refresh()
    return
  }

  if (commandKey === "x") {
    if (!isServiceRunning(wt.name)) {
      dispatch({ type: "set-msg", msg: chalk.red(`No service running for ${wt.name}`) })
      return
    }
    dispatch({ type: "open-dialog", dialog: { mode: "confirm-kill-service", worktree: wt.name } })
    return
  }

  if (commandKey === "s") {
    await executeSyncCommand(wt, dispatch, refresh)
    return
  }

  if (commandKey === "p") {
    if (wt.prNumber) {
      // PR exists → push
      dispatch({ type: "dismiss", msg: `Pushing ${wt.name} to remote…` })
      try {
        await pushBranch(wt.name)
        dispatch({ type: "set-msg", msg: `Pushed ${wt.name} to remote` })
        // biome-ignore lint/suspicious/noExplicitAny: ok in catch
      } catch (e: any) {
        dispatch({ type: "set-msg", msg: chalk.red(`Push failed: ${e.shortMessage || e.message}`) })
      }
      await refresh()
    } else {
      // No PR → create one
      dispatch({ type: "dismiss", msg: `Creating PR for ${wt.name}…` })
      try {
        const { isGhCliAvailable, createPR } = await import("../github-ops")
        if (!(await isGhCliAvailable())) {
          dispatch({
            type: "set-msg",
            msg: chalk.red(
              "GitHub CLI (gh) is not installed. Install it from https://cli.github.com",
            ),
          })
          return
        }
        const pr = await createPR(wt.name)
        dispatch({ type: "set-msg", msg: `Created PR #${pr.number} for ${wt.name}: ${pr.url}` })
        await refresh()
        // biome-ignore lint/suspicious/noExplicitAny: ok in catch
      } catch (e: any) {
        dispatch({
          type: "set-msg",
          msg: chalk.red(`PR creation failed: ${e.shortMessage || e.message}`),
        })
      }
    }
    return
  }

  if (commandKey === "d") {
    log(`User chose delete for worktree: ${wt.name}`)
    dispatch({ type: "dismiss", msg: "Checking for issues…" })
    const { isClean, unmergedCommits, uncommittedFiles, worktreeIssues } = await checkDeleteIssues(
      wt.worktreeDir,
      wt.hasBranch ? wt.name : null,
    )
    log(`Delete check completed for ${wt.name}`, {
      isClean,
      unmergedCount: unmergedCommits.length,
      uncommittedCount: uncommittedFiles.length,
      worktreeIssues,
    })
    if (isClean) {
      log(`Worktree ${wt.name} is clean, proceeding with safe delete`)
      dispatch({ type: "set-msg", msg: `Deleting ${wt.name}…` })
      try {
        await deleteWorktree(wt.worktreeDir, wt.hasBranch ? wt.name : null, false)
        log(`Safe delete completed successfully for worktree: ${wt.name}`)
        dispatch({ type: "set-msg", msg: `Deleted ${wt.name}` })
        await refresh()
        dispatch({ type: "clamp-idx" })
        // biome-ignore lint/suspicious/noExplicitAny: ok in catch
      } catch (e: any) {
        log(`Safe delete failed for worktree: ${wt.name}`, {
          error: e.message,
          shortMessage: e.shortMessage,
        })
        dispatch({ type: "set-msg", msg: chalk.red(`Delete failed: ${e.shortMessage || e.message}`) })
      }
    } else {
      log(`Worktree ${wt.name} has issues, showing confirmation prompt`, {
        unmergedCount: unmergedCommits.length,
        uncommittedCount: uncommittedFiles.length,
        worktreeIssues,
      })
      dispatch({
        type: "open-dialog",
        dialog: {
          mode: "confirm-delete",
          candidate: {
            name: wt.name,
            worktreeDir: wt.worktreeDir,
            hasBranch: wt.hasBranch,
            unmergedCommits,
            uncommittedFiles,
            worktreeIssues,
          },
        },
      })
    }
    return
  }
}

async function executeSyncCommand(
  wt: Worktree,
  dispatch: React.Dispatch<Action>,
  refresh: () => Promise<void>,
) {
  dispatch({ type: "dismiss", msg: "Checking for conflicts…" })
  try {
    const { hasConflicts, conflictingFiles } = await checkForConflicts(wt.name, "rebase")
    if (hasConflicts) {
      log(`Conflicts predicted for sync of ${wt.name}`, { conflictingFiles })
      dispatch({
        type: "open-dialog",
        dialog: {
          mode: "confirm-sync",
          candidate: { name: wt.name, operation: "sync", conflictingFiles },
        },
      })
    } else {
      dispatch({ type: "set-msg", msg: `Syncing ${wt.name}…` })
      await syncBranch(wt.name)
      dispatch({ type: "set-msg", msg: `Synced ${wt.name}` })
      await refresh()
    }
    // biome-ignore lint/suspicious/noExplicitAny: ok in catch
  } catch (e: any) {
    const errorMsg = e.shortMessage || e.message
    if (errorMsg.toLowerCase().includes("conflict")) {
      dispatch({
        type: "set-msg",
        msg: chalk.red(
          `Rebase conflict in ${wt.name}. Resolve in editor, status will update.`,
        ),
      })
    } else {
      dispatch({
        type: "set-msg",
        msg: chalk.red(`Rebase failed: ${errorMsg}`),
      })
    }
    await refresh()
  }
}

/** Detect which terminal the user is running in (best effort). */
function getPreferredTerminal(): "warp" | "iterm" | "terminal" {
  const term = process.env.TERM_PROGRAM ?? ""
  if (term === "WarpTerminal") return "warp"
  if (term === "iTerm.app") return "iterm"
  return "terminal"
}

async function openCommitTerminal(worktreeName: string, dir: string): Promise<void> {
  const tempDir = getCiaTempDir()
  const scriptPath = path.join(tempDir, "commit.sh")
  const windowTitle = `commit: ${worktreeName}`

  const script = `#!/bin/bash
# CIA commit helper for worktree: ${worktreeName}

echo -ne "\\033]0;${windowTitle}\\007"

cd ${JSON.stringify(dir)} || { echo "ERROR: failed to cd to worktree dir"; exit 1; }

echo "Worktree: ${worktreeName}"
echo "Directory: ${dir}"
echo ""

# Show status
git status --short
echo ""

# Check if there's anything to commit
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "Nothing to commit — working tree clean."
  echo ""
  echo "Press any key to close."
  read -n1
  exit 0
fi

# Stage all and commit interactively
git add -A
git commit

echo ""
echo "Press any key to close."
read -n1
`

  fs.writeFileSync(scriptPath, script, "utf-8")
  fs.chmodSync(scriptPath, 0o755)

  const preferred = getPreferredTerminal()
  try {
    if (preferred === "warp") {
      await launchWarpCommit(scriptPath, dir, windowTitle)
    } else if (preferred === "iterm") {
      launchITermCommit(scriptPath, windowTitle)
    } else {
      launchTerminalCommit(scriptPath)
    }
  } catch (e) {
    log(`Preferred terminal (${preferred}) failed, falling back to Terminal`, {
      error: (e as Error).message,
    })
    launchTerminalCommit(scriptPath)
  }
}

function launchTerminalCommit(scriptPath: string): void {
  const osaScript = `tell application "Terminal" to do script "bash " & quoted form of ${JSON.stringify(scriptPath)}`
  spawn("osascript", ["-e", osaScript], { detached: true, stdio: "ignore" })
}

function launchITermCommit(scriptPath: string, windowTitle: string): void {
  const osaScript = `tell application "iTerm" to tell (create window with default profile command "bash " & quoted form of ${JSON.stringify(scriptPath)}) to tell current session of current tab to set name to ${JSON.stringify(windowTitle)}`
  spawn("osascript", ["-e", osaScript], { detached: true, stdio: "ignore" })
}

async function launchWarpCommit(
  scriptPath: string,
  worktreeDir: string,
  windowTitle: string,
): Promise<void> {
  const warpConfigDir = path.join(os.homedir(), ".warp", "launch_configurations")
  if (!fs.existsSync(warpConfigDir)) {
    fs.mkdirSync(warpConfigDir, { recursive: true })
  }
  const configPath = path.join(warpConfigDir, "cia-commit.yaml")
  const config = `---
name: cia-commit
windows:
  - tabs:
      - title: ${JSON.stringify(windowTitle)}
        layout:
          cwd: ${JSON.stringify(worktreeDir)}
          commands:
            - exec: ${JSON.stringify(`exec bash ${scriptPath}`)}
`
  fs.writeFileSync(configPath, config, "utf-8")
  spawn("open", ["warp://launch/cia-commit"], { detached: true, stdio: "ignore" })
}
