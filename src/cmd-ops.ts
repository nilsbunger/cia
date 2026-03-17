import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { execa } from "execa"
import { getCiaTempDir, getProjectRoot } from "./config"
import { getRepoConfig } from "./config-repo"
import { type EditorType, getUserConfig } from "./config-user"
import { branchDirname, which } from "./fs-ops"
import { getBaseBranch, getRepoRoot } from "./repo"
import { log } from "./utils"

export async function deleteWorktree(
  worktreeDir: string,
  branch: string | null,
  force: boolean = false,
) {
  log(`deleteWorktree: Starting deletion`, { worktreeDir, branch, force })
  const root = await getRepoRoot()
  log(`deleteWorktree: root=${root}, worktreeDir=${worktreeDir}`)

  // Step 1: Remove the git worktree (must happen before branch deletion)
  const dirExists = fs.existsSync(worktreeDir)
  log(`deleteWorktree: Worktree directory exists: ${dirExists}`)

  if (dirExists) {
    log(`deleteWorktree: Attempting to remove worktree at ${worktreeDir}`)
    try {
      const worktreeArgs = ["worktree", "remove"]
      if (force) worktreeArgs.push("--force")
      worktreeArgs.push(worktreeDir)
      log(`deleteWorktree: Running git command`, { args: worktreeArgs, cwd: root })
      const result = await execa("git", worktreeArgs, { cwd: root })
      log(`deleteWorktree: Worktree removal succeeded`, {
        stdout: result.stdout,
        stderr: result.stderr,
      })
      // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      const stderr = e.stderr || e.message
      log(`deleteWorktree: Worktree removal failed`, {
        error: e.message,
        stderr: e.stderr,
        stdout: e.stdout,
        exitCode: e.exitCode,
        command: e.command,
      })
      throw new Error(`Failed to remove worktree: ${stderr}`)
    }
  } else {
    // Worktree dir is gone but git may still track it — prune stale entries
    log(`deleteWorktree: Directory missing, pruning stale worktree entries`)
    await execa("git", ["worktree", "prune"], { cwd: root })
  }

  // Step 2: Delete the local branch (only if one exists)
  if (branch) {
    log(`deleteWorktree: Attempting to delete local branch ${branch}`)
    try {
      const branchArgs = ["branch", force ? "-D" : "-d", branch]
      log(`deleteWorktree: Running git command`, { args: branchArgs, cwd: root })
      const result = await execa("git", branchArgs, { cwd: root })
      log(`deleteWorktree: Local branch deletion succeeded`, {
        stdout: result.stdout,
        stderr: result.stderr,
      })
      // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      const stderr = e.stderr || e.message
      log(`deleteWorktree: Local branch deletion failed`, {
        error: e.message,
        stderr: e.stderr,
        stdout: e.stdout,
        exitCode: e.exitCode,
        command: e.command,
      })
      // Restore the worktree so we don't leave a dangling branch with no worktree
      log(`deleteWorktree: Attempting to restore worktree after branch deletion failure`)
      try {
        await execa("git", ["worktree", "add", worktreeDir, branch], { cwd: root })
        log(`deleteWorktree: Worktree restored successfully`)
        // biome-ignore lint/suspicious/noExplicitAny: ok in catch
      } catch (restoreErr: any) {
        log(`deleteWorktree: Failed to restore worktree`, { error: restoreErr.message })
      }
      throw new Error(`Failed to delete branch: ${stderr}`)
    }

    // Step 3: Delete the remote backup branch if it exists
    log(`deleteWorktree: Checking for remote backup branch ${branch}`)
    try {
      await execa("git", ["ls-remote", "--exit-code", "--heads", "origin", branch], {
        cwd: root,
      })
      log(`deleteWorktree: Remote backup branch exists, deleting...`)
      await execa("git", ["push", "origin", "--delete", branch], { cwd: root })
      log(`deleteWorktree: Remote backup branch deleted successfully`)
      // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      log(`deleteWorktree: No remote backup branch or deletion failed (this is OK)`, {
        message: e.message,
      })
    }
  }

  log(`deleteWorktree: Deletion completed successfully`, { worktreeDir, branch })
}
/** Detect which terminal the user is running in (best effort). */
function getPreferredTerminal(): "warp" | "iterm" | "terminal" {
  const term = process.env.TERM_PROGRAM ?? ""
  if (term === "WarpTerminal") return "warp"
  if (term === "iTerm.app") return "iterm"
  return "terminal"
}

function launchTerminal(scriptPath: string): void {
  const osaScript = `tell application "Terminal" to do script "bash " & quoted form of ${JSON.stringify(scriptPath)}`
  spawn("osascript", ["-e", osaScript], { detached: true, stdio: "ignore" })
}

function launchITerm(scriptPath: string, windowTitle: string): void {
  const osaScript = `tell application "iTerm" to tell (create window with default profile command "bash " & quoted form of ${JSON.stringify(scriptPath)}) to tell current session of current tab to set name to ${JSON.stringify(windowTitle)}`
  spawn("osascript", ["-e", osaScript], { detached: true, stdio: "ignore" })
}

async function launchWarp(
  scriptPath: string,
  worktreeDir: string,
  windowTitle: string,
): Promise<void> {
  const warpConfigDir = path.join(os.homedir(), ".warp", "launch_configurations")
  if (!fs.existsSync(warpConfigDir)) {
    fs.mkdirSync(warpConfigDir, { recursive: true })
  }
  const configPath = path.join(warpConfigDir, "cia-editor.yaml")
  const config = `---
name: cia-editor
windows:
  - tabs:
      - title: ${JSON.stringify(windowTitle)}
        layout:
          cwd: ${JSON.stringify(worktreeDir)}
          commands:
            - exec: ${JSON.stringify(`exec bash ${scriptPath}`)}
`
  fs.writeFileSync(configPath, config, "utf-8")
  const url = "warp://launch/cia-editor"
  spawn("open", [url], { detached: true, stdio: "ignore" })
}

async function openClaudeCode(dir: string, worktreeName: string, claudeCmd: string): Promise<void> {
  const scriptPath = path.join(getCiaTempDir(), "open-claude-code.sh")
  const windowTitle = `WT ${worktreeName}`

  // Create a script that launches Claude Code in the directory
  const script = `#!/bin/bash
# CIA editor launcher for worktree: ${worktreeName}

# Set terminal window title
echo -ne "\\033]0;${windowTitle}\\007"

# Change to the worktree directory
cd ${JSON.stringify(dir)} || { echo "ERROR: failed to cd to worktree dir"; exit 1; }

# Launch Claude Code
echo "Launching Claude Code in ${JSON.stringify(dir)}..."
${claudeCmd}
`

  fs.writeFileSync(scriptPath, script, "utf-8")
  fs.chmodSync(scriptPath, 0o755)

  const preferred = getPreferredTerminal()
  try {
    if (preferred === "warp") {
      await launchWarp(scriptPath, dir, windowTitle)
    } else if (preferred === "iterm") {
      launchITerm(scriptPath, windowTitle)
    } else {
      launchTerminal(scriptPath)
    }
  } catch (e) {
    // Fallback to Terminal.app if preferred terminal fails
    log(`Preferred terminal (${preferred}) failed, falling back to Terminal`, {
      error: (e as Error).message,
    })
    launchTerminal(scriptPath)
  }
}

async function autoDetectEditor(): Promise<EditorType> {
  const cursor = await which("cursor")
  if (cursor) return "cursor"
  const code = await which("code")
  if (code) return "vscode"
  const claude = await which("claude")
  if (claude) return "claude"
  log("No editor found in autodetection.")
  return "auto"
}

export async function openEditor(dir: string, branchName?: string) {
  const userConfig = await getUserConfig(getProjectRoot())
  let editorType = userConfig.editor

  log(`openEditor: Opening directory ${dir} with editor type: ${editorType}`)

  // If auto, detect what's available
  if (editorType === "auto") {
    editorType = await autoDetectEditor()
    log(`openEditor: Auto-detected editor type: ${editorType}`)
  }

  // Use full branch name if provided, otherwise fall back to directory basename
  const worktreeName = branchName ?? path.basename(dir)

  if (editorType === "cursor") {
    const cursor = await which("cursor")
    if (cursor) {
      log(`openEditor: Launching Cursor at ${dir}`)
      return execa(cursor, ["-n", dir], { stdio: "inherit" })
    }
    log("Cursor not found, falling back to VS Code")
  } else if (editorType === "vscode") {
    const code = await which("code")
    if (code) {
      log(`openEditor: Launching VS Code at ${dir}`)
      return execa(code, ["-n", dir], { stdio: "inherit" })
    }
    log("VS Code not found, falling back to Claude Code")
  } else if (editorType === "claude") {
    const claude = await which("claude")
    if (claude) {
      log(`openEditor: Launching Claude Code at ${dir}`)
      return openClaudeCode(dir, worktreeName, claude)
    }
    log("Claude Code not found")
  }

  // No editor found
  log(`openEditor: No editor found. Please install Cursor, VS Code, or Claude Code.`)
  throw new Error(
    "No editor found. Please install Cursor, VS Code, or Claude Code, or configure editor in .cia/cia-user.jsonc",
  )
}
export interface CreateWorktreeResult {
  dir: string
  /** Output from onCreateScript, if one was configured and ran successfully */
  scriptOutput?: { stdout: string; stderr: string }
  /** Error from onCreateScript, if it failed */
  scriptError?: string
}

export async function cleanupFailedCreate(
  branch: string,
  existingBranch: boolean,
): Promise<void> {
  const dir = await branchDirname(branch)
  const root = getProjectRoot()
  log(`cleanupFailedCreate: branch=${branch}, dir=${dir}, existingBranch=${existingBranch}`)

  // Remove worktree directory if it exists
  if (fs.existsSync(dir)) {
    try {
      await execa("git", ["worktree", "remove", "--force", dir], { cwd: root })
      log(`cleanupFailedCreate: Worktree removed`)
    // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      log(`cleanupFailedCreate: Failed to remove worktree: ${e.message}`)
    }
  }

  // Prune stale worktree entries
  await execa("git", ["worktree", "prune"], { cwd: root })

  // Delete the branch only if it was newly created (not an existing branch)
  if (!existingBranch) {
    try {
      await execa("git", ["branch", "-D", branch], { cwd: root })
      log(`cleanupFailedCreate: Branch deleted`)
    // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      log(`cleanupFailedCreate: Failed to delete branch: ${e.message}`)
    }
  }
}

export async function createWorktree(
  branch: string,
  existingBranch?: boolean,
): Promise<CreateWorktreeResult> {
  const dir = await branchDirname(branch)
  log(`createWorktree: branch=${branch}, root=${getProjectRoot()}, dir=${dir}, existing=${!!existingBranch}`)

  // Ensure the parent worktree directory exists
  const worktreeParentDir = path.dirname(dir)
  if (!fs.existsSync(worktreeParentDir)) {
    fs.mkdirSync(worktreeParentDir, { recursive: true })
  }

  if (existingBranch) {
    log(`createWorktree: Creating worktree for existing branch ${branch}`)
    await execa("git", ["worktree", "add", dir, branch], { cwd: getProjectRoot() })
  } else {
    // base from the currently checked-out branch in the root worktree
    const baseBranch = await getBaseBranch()
    log(`createWorktree: Creating new worktree for ${branch} from ${baseBranch}`)
    await execa("git", ["worktree", "add", "-B", branch, dir, baseBranch], { cwd: getProjectRoot() })
  }
  log(`createWorktree: Worktree created successfully`)

  // Run onCreateScript if configured
  const repoConfig = await getRepoConfig(getProjectRoot())
  if (repoConfig.onCreateScript) {
    log(`createWorktree: Running onCreateScript: ${repoConfig.onCreateScript}`)
    try {
      const scriptPath = path.resolve(getProjectRoot(), repoConfig.onCreateScript)
      const result = await execa("sh", ["-c", `source "${scriptPath}"`], {
        cwd: dir,
      })
      log(`createWorktree: onCreateScript completed`)
      return { dir, scriptOutput: { stdout: result.stdout, stderr: result.stderr } }
      // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      const stderr = e.stderr || ""
      const stdout = e.stdout || ""
      const msg = [stdout, stderr, e.shortMessage || e.message].filter(Boolean).join("\n")
      log(`createWorktree: onCreateScript failed: ${msg}`)

      return { dir, scriptError: msg }
    }
  }

  return { dir }
}
