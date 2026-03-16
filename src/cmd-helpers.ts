import * as fs from "node:fs"
import * as path from "node:path"
import { execa } from "execa"
import { createWorktree } from "./cmd-ops"
import { getConfig } from "./config"
import { branchDirname } from "./fs-ops"
import { listWorktrees, validateWorktree } from "./git-ops"
import { getBaseBranch, getRepoRoot } from "./repo"
import type { Worktree } from "./types"
import { log } from "./utils"

/** Human-readable age; use date only if older than 60 days */
function formatCommitAge(unixTs: number): string {
  if (!unixTs) return "—"
  const now = Date.now() / 1000
  const diffSec = now - unixTs
  const days = diffSec / 86400
  if (days < 1) return "today"
  if (days < 2) return "yesterday"
  if (days < 7) return `${Math.floor(days)} days ago`
  if (days <= 60) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`
  }
  return new Date(unixTs * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export async function ensureWorktree(branchName: string): Promise<string> {
  const dir = await branchDirname(branchName)
  if (fs.existsSync(dir)) return await validateWorktree(branchName)
  return await createWorktree(branchName)
}

export async function checkDeleteIssues(
  worktreeDir: string,
  branch: string | null,
): Promise<{
  isClean: boolean
  unmergedCommits: string[]
  uncommittedFiles: string[]
  worktreeIssues: string[]
}> {
  log(`checkDeleteIssues: Starting check`, { worktreeDir, branch })
  const root = await getRepoRoot()
  log(`checkDeleteIssues: root=${root}, dir=${worktreeDir}`)
  const worktreeIssues: string[] = []

  try {
    // Check commits in branch that are not in the base branch (only if there is a branch)
    const baseBranch = await getBaseBranch()
    let unmergedCommits: string[] = []
    if (branch) {
      log(`checkDeleteIssues: Checking for unmerged commits against ${baseBranch}...`)
      const { stdout } = await execa("git", [`log`, `${baseBranch}..${branch}`, `--format=%h %s`], {
        cwd: root,
      })
      unmergedCommits = stdout.trim().split("\n").filter(Boolean)
      log(`checkDeleteIssues: Found ${unmergedCommits.length} unmerged commits`)
    }

    // Check for uncommitted changes (staged or unstaged) in the worktree
    let uncommittedFiles: string[] = []
    const dirExists = fs.existsSync(worktreeDir)
    log(`checkDeleteIssues: Worktree exists: ${dirExists}`)
    if (dirExists) {
      // Get status of worktree - both staged and unstaged files
      log(`checkDeleteIssues: Checking git status in worktree...`)
      const { stdout: statusOut } = await execa("git", ["status", "--porcelain"], {
        cwd: worktreeDir,
      })
      uncommittedFiles = statusOut.trim().split("\n").filter(Boolean)
      log(`checkDeleteIssues: Found ${uncommittedFiles.length} uncommitted files`)

      // Check if worktree is actually locked (not just has uncommitted changes)
      log(`checkDeleteIssues: Checking if worktree is locked...`)
      try {
        const { stdout: worktreeList } = await execa("git", ["worktree", "list", "--porcelain"], {
          cwd: root,
        })
        const lines = worktreeList.split("\n")
        let foundOurWorktree = false
        for (const line of lines) {
          if (line.startsWith("worktree ") && line.includes(worktreeDir)) {
            foundOurWorktree = true
          }
          if (foundOurWorktree && line.startsWith("locked")) {
            worktreeIssues.push("Worktree is locked")
            log(`checkDeleteIssues: Worktree is actually locked`)
            break
          }
          if (foundOurWorktree && line.startsWith("worktree ") && !line.includes(worktreeDir)) {
            break
          }
        }
        // biome-ignore lint/suspicious/noExplicitAny: ok in catch
      } catch (e: any) {
        log(`checkDeleteIssues: Failed to check worktree lock status`, { error: e.message })
      }
    } else {
      worktreeIssues.push("Worktree directory is missing (prunable)")
    }

    const isClean =
      unmergedCommits.length === 0 && uncommittedFiles.length === 0 && worktreeIssues.length === 0
    log(`checkDeleteIssues: Final result`, {
      isClean,
      unmergedCommits: unmergedCommits.length,
      uncommittedFiles: uncommittedFiles.length,
      worktreeIssues,
    })
    return { isClean, unmergedCommits, uncommittedFiles, worktreeIssues }
    // biome-ignore lint/suspicious/noExplicitAny: ok
  } catch (e: any) {
    log(`checkDeleteIssues: Exception caught`, {
      message: e.message,
      stderr: e.stderr,
      exitCode: e.exitCode,
    })
    return {
      isClean: false,
      unmergedCommits: [`Error checking: ${e.message}`],
      uncommittedFiles: [],
      worktreeIssues: [],
    }
  }
}
export async function checkForConflicts(
  branch: string,
  operation: "merge" | "rebase",
): Promise<{ hasConflicts: boolean; conflictingFiles: string[] }> {
  log(`checkForConflicts: Starting check for ${operation} of ${branch}`)
  const root = await getRepoRoot()

  try {
    // First get the merge base
    const baseBranch = await getBaseBranch()
    const { stdout: mergeBase } = await execa("git", ["merge-base", baseBranch, branch], {
      cwd: root,
    })
    const base = mergeBase.trim()

    // Use git merge-tree to simulate the merge and detect conflicts
    // merge-tree shows conflicts without touching the working directory
    const { stdout } = await execa("git", ["merge-tree", base, baseBranch, branch], { cwd: root })

    // If merge-tree output contains conflict markers, there will be conflicts
    const hasConflicts = stdout.includes("<<<<<<<") || stdout.includes("=======")

    if (hasConflicts) {
      // Extract file paths from conflict markers
      const lines = stdout.split("\n")
      const conflictingFiles: string[] = []
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("diff --cc ")) {
          const filePath = lines[i].substring(10)
          conflictingFiles.push(filePath)
        }
      }
      log(`checkForConflicts: Found ${conflictingFiles.length} conflicting files`)
      return { hasConflicts: true, conflictingFiles }
    }

    log(`checkForConflicts: No conflicts detected`)
    return { hasConflicts: false, conflictingFiles: [] }
    // biome-ignore lint/suspicious/noExplicitAny: ok in catch
  } catch (e: any) {
    // If merge-tree fails, assume there might be conflicts
    log(`checkForConflicts: Error running merge-tree`, { error: e.message })
    return { hasConflicts: false, conflictingFiles: [] }
  }
}

export async function computeWorktrees(): Promise<Worktree[]> {
  const result = await getConfig()
  if (!result.ok) return []
  const { branchPrefix, worktreeDir } = result.config
  const root = result.repoRoot
  const worktrees = await listWorktrees(branchPrefix)
  const { isServiceRunning, getServiceCrashInfo } = await import("./service")

  // Fetch PR information for all branches in batch
  const branches = worktrees.map((wt) => wt.branch).filter((b): b is string => b !== null)
  let prMap = new Map<
    string,
    { number: number; url: string; state: "open" | "closed" | "merged" }
  >()
  try {
    const { isGhCliAvailable, getPRsForBranches } = await import("./github-ops")
    if (await isGhCliAvailable()) {
      prMap = await getPRsForBranches(branches)
    }
  } catch (e) {
    log(`computeWorktrees: Failed to fetch PR info`, { error: (e as Error).message })
  }

  const rows: Worktree[] = []
  for (const wt of worktrees) {
    const dir = wt.dir
    const branch = wt.branch ?? path.relative(path.join(root, worktreeDir), dir)
    // worktree status summary
    let status = ""
    let ahead: number | undefined
    let behind: number | undefined
    let dirtyCount: number | undefined
    let inProgress: "MERGE" | "REBASE" | undefined
    try {
      // Check for merge/rebase in progress
      const mergeHeadPath = `${dir}/.git/MERGE_HEAD`
      const rebaseHeadPath = `${dir}/.git/rebase-merge`
      const rebaseApplyPath = `${dir}/.git/rebase-apply`

      if (fs.existsSync(mergeHeadPath)) {
        inProgress = "MERGE"
      } else if (fs.existsSync(rebaseHeadPath) || fs.existsSync(rebaseApplyPath)) {
        inProgress = "REBASE"
      }

      // Get ahead/behind info (compared to local main)
      if (wt.branch) {
        const { stdout: revListOut } = await execa(
          "git",
          ["rev-list", "--left-right", "--count", `main...${wt.branch}`],
          { cwd: dir },
        )
        const parts = revListOut.trim().split("\t").map(Number)
        ahead = parts[0]
        behind = parts[1]
        const aheadBehind = ahead || behind ? `↑${ahead}↓${behind}` : ""
        status = inProgress ? `${inProgress} ${aheadBehind}` : aheadBehind
      } else {
        status = inProgress || "detached"
      }

      // Get dirty files count
      const { stdout: statusOut } = await execa("git", ["status", "--porcelain"], { cwd: dir })
      dirtyCount = statusOut.trim().split("\n").filter(Boolean).length
      const dirty = dirtyCount ? `*${dirtyCount}` : ""

      status = [status, dirty].filter(Boolean).join(" ")
    } catch {
      status = ""
    }
    const running = isServiceRunning(branch)
    const serviceCrash = running ? undefined : (getServiceCrashInfo(branch) ?? undefined)

    // Get PR info if available
    const prInfo = wt.branch ? prMap.get(wt.branch) : undefined

    rows.push({
      name: branch,
      hasBranch: wt.branch !== null && !wt.prunable,
      prunable: wt.prunable,
      status,
      worktreeDir: dir,
      serviceRunning: running,
      serviceCrash,
      lastCommitAge: formatCommitAge(wt.lastCommitDate),
      ahead,
      behind,
      dirtyCount,
      inProgress,
      prNumber: prInfo?.number,
      prUrl: prInfo?.url,
      prState: prInfo?.state,
    })
  }
  return rows
}
