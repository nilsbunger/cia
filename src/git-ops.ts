import { execa } from "execa"
import * as path from "path"
import { BRANCH_PREFIX } from "./constants"
import { log } from "./utils"
import * as fs from "node:fs"
import { branchDirname } from "./fs-ops"

export async function listAgentBranches(): Promise<string[]> {
  const root = await getRepoRoot()
  const { stdout } = await execa("git", ["branch", "-a", "--format=%(refname:short)"], {
    cwd: root,
  })
  const allBranches = stdout.split("\n").filter(Boolean) // remove empty lines

  log(`listAgentBranches: All branches from ${root}:`, allBranches)

  const filtered = allBranches
    .filter((name) => !name.startsWith("remotes/"))
    .filter((name) => name.startsWith(BRANCH_PREFIX))
    .sort((a, b) => a.localeCompare(b))

  log(`listAgentBranches: Filtered agent branches:`, filtered)

  return filtered
}

export async function getRepoRoot(): Promise<string> {
  // When run from a worktree, --show-toplevel returns the worktree path.
  // Use --git-common-dir to find the main .git directory, then get its parent.
  const { stdout } = await execa("git", ["rev-parse", "--git-common-dir"])
  const commonDir = stdout.trim()
  // commonDir is either absolute path or relative path like ".git"
  const absoluteCommonDir = path.isAbsolute(commonDir) ? commonDir : path.resolve(commonDir)
  // The repo root is the parent of the .git directory
  return path.dirname(absoluteCommonDir)
}

export async function mergeIntoMain(branch: string) {
  // Step 1: Validate worktree exists and is in correct state
  const dir = await validateWorktree(branch)
  const root = await getRepoRoot()

  // Step 2: Merge main into the agent branch in the worktree
  // This is where any conflicts will be resolved
  // Allow fast-forward if possible (cleaner history)
  await execa("git", ["checkout", branch], { cwd: dir })
  await execa("git", ["merge", "main"], { cwd: dir })

  // Step 3: Now merge the agent branch into main (guaranteed clean fast-forward)
  // Switch to main in root repo and merge the agent branch
  await execa("git", ["checkout", "main"], { cwd: root })
  await execa("git", ["merge", branch, "--ff-only"], { cwd: root })
}

export async function pushBranch(branch: string) {
  // Validate worktree exists and is in correct state
  await validateWorktree(branch)
  await execa("git", ["push", "-u", "origin", branch])
}
export async function syncBranch(branch: string) {
  // Validate worktree exists and is in correct state
  const dir = await validateWorktree(branch)
  await execa("git", ["checkout", branch], { cwd: dir })
  await execa("git", ["rebase", "main"], { cwd: dir })
}
export async function validateWorktree(branch: string): Promise<string> {
  const root = await getRepoRoot()
  const dir = branchDirname(root, branch)

  // Check 1: Directory exists
  if (!fs.existsSync(dir)) {
    throw new Error(`Worktree directory does not exist: ${dir}`)
  }

  // Check 2: Directory is actually a git worktree (has .git file, not .git directory)
  const gitPath = path.join(dir, ".git")
  if (!fs.existsSync(gitPath)) {
    throw new Error(`Directory is not a git worktree (missing .git): ${dir}`)
  }

  // Check 3: Worktree is registered with git
  const { stdout: worktreeList } = await execa("git", ["worktree", "list", "--porcelain"], {
    cwd: root,
  })
  const worktrees = worktreeList.split("\n\n")
  const ourWorktree = worktrees.find((wt) => wt.includes(`worktree ${dir}`))
  if (!ourWorktree) {
    throw new Error(`Worktree not registered with git: ${dir}`)
  }

  // Check 4: Worktree is on the correct branch
  const { stdout: currentBranch } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: dir,
  })
  if (currentBranch.trim() !== branch) {
    throw new Error(
      `Worktree is on wrong branch: expected ${branch}, got ${currentBranch.trim()}`,
    )
  }

  return dir
}
