import * as fs from "node:fs"
import * as path from "node:path"
import { execa } from "execa"
import { branchDirname } from "./fs-ops"
import { getBaseBranch, getRepoRoot } from "./repo"
import { log } from "./utils"

type Worktree = {
  dir: string
  branch: string | null
  lastCommitDate: number
  prunable: boolean
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
    const isPrunable = lines.some((l) => l.startsWith("prunable"))
    if (!dirLine) continue

    const dir = dirLine.replace("worktree ", "").trim()
    const branch = branchLine ? branchLine.replace("branch refs/heads/", "").trim() : null

    // Skip the main worktree (the repo root itself)
    if (dir === repoRoot) continue

    // Filter: worktree's branch must match prefix
    const matchesPrefix = branch ? branch.startsWith(branchPrefix) : false
    if (!matchesPrefix) continue

    // Get last commit date from HEAD of the worktree
    let lastCommitDate = 0
    try {
      const ref = branch ?? "HEAD"
      const { stdout: tsOut } = await execa("git", ["log", "-1", "--format=%ct", ref], { cwd: dir })
      lastCommitDate = Number(tsOut.trim()) || 0
    } catch {
      // ignore
    }

    worktrees.push({ dir, branch, lastCommitDate, prunable: isPrunable })
  }

  worktrees.sort((a, b) => b.lastCommitDate - a.lastCommitDate)
  log(
    `listWorktrees: Found ${worktrees.length} worktrees matching prefix "${branchPrefix}"`,
    worktrees.map((w) => w.branch ?? w.dir),
  )

  return worktrees
}

/**
 * List branches matching the given prefix that do NOT currently have a worktree.
 */
export async function listBranchesWithoutWorktrees(branchPrefix: string): Promise<string[]> {
  const repoRoot = await getRepoRoot()

  // Get all local branches matching the prefix
  const { stdout: branchOutput } = await execa(
    "git",
    ["branch", "--format=%(refname:short)", "--list", `${branchPrefix}*`],
    { cwd: repoRoot },
  )
  const allBranches = branchOutput
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean)

  // Get all branches that currently have worktrees
  const { stdout: worktreeList } = await execa("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
  })
  const worktreeBranches = new Set<string>()
  for (const block of worktreeList.split("\n\n").filter(Boolean)) {
    const branchLine = block.split("\n").find((l) => l.startsWith("branch refs/heads/"))
    if (branchLine) {
      worktreeBranches.add(branchLine.replace("branch refs/heads/", "").trim())
    }
  }

  return allBranches.filter((b) => !worktreeBranches.has(b))
}

export async function mergeIntoMain(branch: string) {
  // Step 1: Validate worktree exists and is in correct state
  const dir = await validateWorktree(branch)
  const root = await getRepoRoot()

  const baseBranch = await getBaseBranch()

  // Step 2: Merge base branch into the agent branch in the worktree
  // This is where any conflicts will be resolved
  // Allow fast-forward if possible (cleaner history)
  await execa("git", ["checkout", branch], { cwd: dir })
  await execa("git", ["merge", baseBranch], { cwd: dir })

  // Step 3: Now merge the agent branch into the base branch (guaranteed clean fast-forward)
  // Switch to base branch in root repo and merge the agent branch
  await execa("git", ["checkout", baseBranch], { cwd: root })
  await execa("git", ["merge", branch, "--ff-only"], { cwd: root })
}

export async function pushBranch(branch: string) {
  // Validate worktree exists and is in correct state
  await validateWorktree(branch)
  const root = await getRepoRoot()
  await execa("git", ["push", "-u", "origin", branch], { cwd: root })
}

export async function syncBranch(branch: string) {
  // Validate worktree exists and is in correct state
  const dir = await validateWorktree(branch)
  await execa("git", ["checkout", branch], { cwd: dir })
  const baseBranch = await getBaseBranch()
  await execa("git", ["rebase", baseBranch], { cwd: dir })
}

export async function validateWorktree(branchName: string): Promise<string> {
  const root = await getRepoRoot()
  const branchDir = await branchDirname(branchName)

  // Check 1: Directory exists
  if (!fs.existsSync(branchDir)) {
    throw new Error(`Worktree directory does not exist: ${branchDir}`)
  }

  // Check 2: Directory is actually a git worktree (has .git file, not .git directory)
  const gitPath = path.join(branchDir, ".git")
  if (!fs.existsSync(gitPath)) {
    throw new Error(`Directory is not a git worktree (missing .git file): ${branchDir}`)
  }

  // Check 3: Worktree is registered with git
  const { stdout: worktreeList } = await execa("git", ["worktree", "list", "--porcelain"], {
    cwd: root,
  })
  const worktrees = worktreeList.split("\n\n")
  const ourWorktree = worktrees.find((wt) => wt.includes(`worktree ${branchDir}`))
  if (!ourWorktree) {
    throw new Error(`Worktree not registered with git: ${branchDir}`)
  }

  // Check 4: Worktree is on the correct branch
  const { stdout: currentBranch } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: branchDir,
  })
  if (currentBranch.trim() !== branchName) {
    throw new Error(
      `Worktree is on wrong branch: expected ${branchName}, got ${currentBranch.trim()}`,
    )
  }

  return branchDir
}
