import { execa } from "execa"
import { log } from "./utils"
import { branchDirname, which } from "./fs-ops"
import { getBaseBranch, getRepoRoot } from "./repo"
import * as fs from "node:fs"
import * as path from "node:path"
import { WORKTREES_DIR_NAME } from "./constants"
import { projectRoot } from "./config"

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
export async function openEditor(dir: string) {
  const cursor = await which("cursor")
  const code = await which("code")
  if (cursor) return execa(cursor, ["-n", dir], { stdio: "inherit" })
  if (code) return execa(code, ["-n", dir], { stdio: "inherit" })
  // fallback: open with default OS opener
  return execa(
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open",
    process.platform === "win32" ? ["/C", "start", "", dir] : [dir],
    { stdio: "inherit" },
  )
}
export async function createWorktree(branch: string): Promise<string> {
  const projRoot = projectRoot()
  const dir = branchDirname(branch)
  log(`createWorktree: branch=${branch}, root=${projRoot}, dir=${dir}`)

  if (!fs.existsSync(path.join(process.cwd(), WORKTREES_DIR_NAME))) {
    fs.mkdirSync(path.join(process.cwd(), WORKTREES_DIR_NAME), { recursive: true })
  }

  // base from the currently checked-out branch in the root worktree
  const baseBranch = await getBaseBranch()
  log(`createWorktree: Creating new worktree for ${branch} from ${baseBranch}`)
  await execa("git", ["worktree", "add", "-B", branch, dir, baseBranch], { cwd: projRoot })
  log(`createWorktree: Worktree created successfully`)

  return dir
}
