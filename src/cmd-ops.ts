import { execa } from "execa"
import { log } from "./utils"
import { branchDirname, which } from "./fs-ops"
import { getRepoRoot } from "./git-ops"
import * as fs from "node:fs"
import * as path from "path"
import { WORKTREES_DIR_NAME } from "./constants"

export async function deleteBranchAndWorktree(branch: string, force: boolean = false) {
  log(`deleteBranchAndWorktree: Starting deletion`, { branch, force })
  const root = await getRepoRoot()
  const dir = branchDirname(root, branch)
  log(`deleteBranchAndWorktree: root=${root}, dir=${dir}`)

  // Remove worktree first if it exists (can't delete a branch that's checked out in a worktree)
  const dirExists = fs.existsSync(dir)
  log(`deleteBranchAndWorktree: Worktree directory exists: ${dirExists}`)

  if (dirExists) {
    log(`deleteBranchAndWorktree: Attempting to remove worktree at ${dir}`)
    try {
      const worktreeArgs = ["worktree", "remove"]
      if (force) worktreeArgs.push("--force")
      worktreeArgs.push(dir)
      log(`deleteBranchAndWorktree: Running git command`, { args: worktreeArgs, cwd: root })
      const result = await execa("git", worktreeArgs, { cwd: root })
      log(`deleteBranchAndWorktree: Worktree removal succeeded`, {
        stdout: result.stdout,
        stderr: result.stderr,
      })
    } catch (e: any) {
      const stderr = e.stderr || e.message
      log(`deleteBranchAndWorktree: Worktree removal failed`, {
        error: e.message,
        stderr: e.stderr,
        stdout: e.stdout,
        exitCode: e.exitCode,
        command: e.command,
      })
      throw new Error(`Failed to remove worktree: ${stderr}`)
    }
  }

  // Then delete the local branch (always, even if worktree didn't exist)
  log(`deleteBranchAndWorktree: Attempting to delete local branch ${branch}`)
  try {
    const branchArgs = ["branch", force ? "-D" : "-d", branch]
    log(`deleteBranchAndWorktree: Running git command`, { args: branchArgs, cwd: root })
    const result = await execa("git", branchArgs, { cwd: root })
    log(`deleteBranchAndWorktree: Local branch deletion succeeded`, {
      stdout: result.stdout,
      stderr: result.stderr,
    })
  } catch (e: any) {
    const stderr = e.stderr || e.message
    log(`deleteBranchAndWorktree: Local branch deletion failed`, {
      error: e.message,
      stderr: e.stderr,
      stdout: e.stdout,
      exitCode: e.exitCode,
      command: e.command,
    })
    throw new Error(`Failed to delete branch: ${stderr}`)
  }

  // Also delete the remote backup branch if it exists
  log(`deleteBranchAndWorktree: Checking for remote backup branch ${branch}`)
  try {
    // Check if remote branch exists
    await execa("git", ["ls-remote", "--exit-code", "--heads", "origin", branch], {
      cwd: root,
    })
    // If we get here, the remote branch exists - delete it
    log(`deleteBranchAndWorktree: Remote backup branch exists, deleting...`)
    await execa("git", ["push", "origin", "--delete", branch], { cwd: root })
    log(`deleteBranchAndWorktree: Remote backup branch deleted successfully`)
  } catch (e: any) {
    // Remote branch doesn't exist or delete failed - that's fine
    log(`deleteBranchAndWorktree: No remote backup branch or deletion failed (this is OK)`, {
      message: e.message,
    })
  }

  log(`deleteBranchAndWorktree: Deletion completed successfully for ${branch}`)
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
  const root = await getRepoRoot()
  const dir = branchDirname(root, branch)
  log(`createWorktree: branch=${branch}, root=${root}, dir=${dir}`)

  if (!fs.existsSync(path.join(root, WORKTREES_DIR_NAME))) {
    fs.mkdirSync(path.join(root, WORKTREES_DIR_NAME), { recursive: true })
  }

  // base from local main
  log(`createWorktree: Creating new worktree for ${branch}`)
  await execa("git", ["worktree", "add", "-B", branch, dir, "main"], { cwd: root })
  log(`createWorktree: Worktree created successfully`)

  return dir
}
