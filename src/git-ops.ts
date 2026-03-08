import { execa } from "execa"
import * as path from "node:path"
import { log } from "./utils"
import * as fs from "node:fs"
import { branchDirname } from "./fs-ops"
import { getRepoRoot } from "./repo"

export { getRepoRoot } from "./repo"

export type Worktree = {
  dir: string
  branch: string | null
  lastCommitDate: number
}

export async function listWorktrees(branchPrefix: string): Promise<Worktree[]> {
  const repoRoot = await getRepoRoot()

  const { stdout: worktreeList } = await execa("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
  })

  const worktrees: Worktree[] = []
  for (const block of worktreeList.split("\n\n").filter(Boolean)) {
    const lines = block.split("\n")
    const dirLine = lines.find((l) => l.startsWith("worktree "))
    const branchLine = lines.find((l) => l.startsWith("branch refs/heads/"))
    const isDetached = lines.some((l) => l === "detached")
    if (!dirLine) continue

    const dir = dirLine.replace("worktree ", "").trim()
    const branch = branchLine ? branchLine.replace("branch refs/heads/", "").trim() : null

    // Skip the main worktree (the repo root itself)
    if (dir === repoRoot) continue

    // Filter: worktree's branch must match prefix, or if detached, the dir path should indicate prefix
    const matchesPrefix = branch
      ? branch.startsWith(branchPrefix)
      : false
    if (!matchesPrefix && !isDetached) continue
    // For detached worktrees, skip if they don't look like they belong to us
    if (isDetached && !matchesPrefix) continue

    // Get last commit date from HEAD of the worktree
    let lastCommitDate = 0
    try {
      const ref = branch ?? "HEAD"
      const { stdout: tsOut } = await execa(
        "git",
        ["log", "-1", "--format=%ct", ref],
        { cwd: dir },
      )
      lastCommitDate = Number(tsOut.trim()) || 0
    } catch {
      // ignore
    }

    worktrees.push({ dir, branch, lastCommitDate })
  }

  worktrees.sort((a, b) => b.lastCommitDate - a.lastCommitDate)
  log(`listWorktrees: Found ${worktrees.length} worktrees matching prefix "${branchPrefix}"`, worktrees.map((w) => w.branch ?? w.dir))

  return worktrees
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
    throw new Error(`Directory is not a git worktree (missing .git file): ${dir}`)
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
