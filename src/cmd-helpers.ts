import { execa } from "execa"
import { branchDirname } from "./fs-ops"
import { getRepoRoot, listAgentBranches, validateWorktree } from "./git-ops"
import * as fs from "node:fs"
import { createWorktree } from "./cmd-ops"
import { log } from "./utils"
import { Row } from "./types"

export async function ensureWorktree(branch: string): Promise<string> {
  const root = await getRepoRoot()
  const dir = branchDirname(root, branch)

  if (fs.existsSync(dir)) {
    return await validateWorktree(branch)
  } else {
    return await createWorktree(branch)
  }
}
export async function checkDeleteIssues(branch: string): Promise<{
  isClean: boolean
  unmergedCommits: string[]
  uncommittedFiles: string[]
  worktreeIssues: string[]
}> {
  log(`checkDeleteIssues: Starting check for branch: ${branch}`)
  const root = await getRepoRoot()
  const dir = branchDirname(root, branch)
  log(`checkDeleteIssues: root=${root}, dir=${dir}`)
  const worktreeIssues: string[] = []

  try {
    // Check commits in branch that are not in main
    log(`checkDeleteIssues: Checking for unmerged commits...`)
    const { stdout } = await execa("git", ["log", "main.." + branch, "--format=%h %s"], {
      cwd: root,
    })
    const unmergedCommits = stdout.trim().split("\n").filter(Boolean)
    log(`checkDeleteIssues: Found ${unmergedCommits.length} unmerged commits`)

    // Check for uncommitted changes (staged or unstaged) in the worktree
    let uncommittedFiles: string[] = []
    const dirExists = fs.existsSync(dir)
    log(`checkDeleteIssues: Worktree exists: ${dirExists}`)
    if (dirExists) {
      // Get status of worktree - both staged and unstaged files
      log(`checkDeleteIssues: Checking git status in worktree...`)
      const { stdout: statusOut } = await execa("git", ["status", "--porcelain"], { cwd: dir })
      uncommittedFiles = statusOut.trim().split("\n").filter(Boolean)
      log(`checkDeleteIssues: Found ${uncommittedFiles.length} uncommitted files`)

      // Check if worktree is actually locked (not just has uncommitted changes)
      log(`checkDeleteIssues: Checking if worktree is locked...`)
      try {
        const { stdout: worktreeList } = await execa(
          "git",
          ["worktree", "list", "--porcelain"],
          { cwd: root },
        )
        // Check if this specific worktree is marked as locked in the output
        const lines = worktreeList.split("\n")
        let foundOurWorktree = false
        for (const line of lines) {
          if (line.startsWith("worktree ") && line.includes(dir)) {
            foundOurWorktree = true
          }
          if (foundOurWorktree && line.startsWith("locked")) {
            worktreeIssues.push("Worktree is locked")
            log(`checkDeleteIssues: Worktree is actually locked`)
            break
          }
          // Reset when we hit the next worktree entry
          if (foundOurWorktree && line.startsWith("worktree ") && !line.includes(dir)) {
            break
          }
        }
      } catch (e: any) {
        log(`checkDeleteIssues: Failed to check worktree lock status`, { error: e.message })
      }
    }

    const isClean =
      unmergedCommits.length === 0 &&
      uncommittedFiles.length === 0 &&
      worktreeIssues.length === 0
    log(`checkDeleteIssues: Final result`, {
      isClean,
      unmergedCommits: unmergedCommits.length,
      uncommittedFiles: uncommittedFiles.length,
      worktreeIssues,
    })
    return { isClean, unmergedCommits, uncommittedFiles, worktreeIssues }
  } catch (e: any) {
    // If command fails, assume not clean
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
    const { stdout: mergeBase } = await execa("git", ["merge-base", "main", branch], { cwd: root })
    const base = mergeBase.trim()

    // Use git merge-tree to simulate the merge and detect conflicts
    // merge-tree shows conflicts without touching the working directory
    const { stdout } = await execa("git", ["merge-tree", base, "main", branch], { cwd: root })

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
  } catch (e: any) {
    // If merge-tree fails, assume there might be conflicts
    log(`checkForConflicts: Error running merge-tree`, { error: e.message })
    return { hasConflicts: false, conflictingFiles: [] }
  }
}

export async function computeRows(): Promise<Row[]> {
  const root = await getRepoRoot()
  const branches = await listAgentBranches()
  const rows: Row[] = []
  for (const branch of branches) {
    const dir = branchDirname(root, branch)
    const exists = fs.existsSync(dir)
    // branch status summary
    let status = ""
    try {
      const cwd = exists ? dir : root

      // Check for merge/rebase in progress
      let inProgress = ""
      if (exists) {
        const mergeHeadPath = `${dir}/.git/MERGE_HEAD`
        const rebaseHeadPath = `${dir}/.git/rebase-merge`
        const rebaseApplyPath = `${dir}/.git/rebase-apply`

        if (fs.existsSync(mergeHeadPath)) {
          inProgress = "MERGE"
        } else if (fs.existsSync(rebaseHeadPath) || fs.existsSync(rebaseApplyPath)) {
          inProgress = "REBASE"
        }
      }

      // Get ahead/behind info (compared to local main)
      const { stdout: revListOut } = await execa(
        "git",
        ["rev-list", "--left-right", "--count", `main...${branch}`],
        { cwd },
      )
      const [ahead, behind] = revListOut.trim().split("\t").map(Number)
      const aheadBehind = ahead || behind ? `↑${ahead}↓${behind}` : ""

      // Get dirty files count
      const { stdout: statusOut } = await execa("git", ["status", "--porcelain"], { cwd })
      const dirtyCount = statusOut.trim().split("\n").filter(Boolean).length
      const dirty = dirtyCount ? `*${dirtyCount}` : ""

      status = [inProgress, aheadBehind, dirty].filter(Boolean).join(" ")
    } catch {
      status = ""
    }
    rows.push({ branch, status, worktreeDir: exists ? dir : null })
  }
  return rows
}
