import * as fs from "node:fs"
import * as path from "node:path"
import { execa } from "execa"

const TEST_PREFIX = "cia-test/"

export async function getTestRepoRoot(): Promise<string> {
  const { stdout } = await execa("git", ["rev-parse", "--git-common-dir"])
  const commonDir = stdout.trim()
  const abs = path.isAbsolute(commonDir) ? commonDir : path.resolve(commonDir)
  return path.dirname(abs)
}

const trackedBranches: string[] = []

export async function createTestWorktree(name: string): Promise<{ dir: string; branch: string }> {
  const root = await getTestRepoRoot()
  const branch = `${TEST_PREFIX}${name}`
  const dir = path.join(root, ".worktrees", branch)

  fs.mkdirSync(path.dirname(dir), { recursive: true })
  await execa("git", ["worktree", "add", "-b", branch, dir], { cwd: root })
  trackedBranches.push(branch)

  return { dir, branch }
}

export async function makeCommit(dir: string, filename: string, content: string): Promise<string> {
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, content)
  await execa("git", ["add", filename], { cwd: dir })
  await execa("git", ["commit", "-m", `test: add ${filename}`], { cwd: dir })
  const { stdout: hash } = await execa("git", ["rev-parse", "HEAD"], { cwd: dir })
  return hash.trim()
}

export async function cleanupAll(): Promise<void> {
  const root = await getTestRepoRoot()

  // Remove all cia-test/ worktrees
  const { stdout } = await execa("git", ["worktree", "list", "--porcelain"], { cwd: root })
  for (const block of stdout.split("\n\n").filter(Boolean)) {
    const lines = block.split("\n")
    const dirLine = lines.find((l) => l.startsWith("worktree "))
    const branchLine = lines.find((l) => l.startsWith("branch refs/heads/cia-test/"))
    if (branchLine && dirLine) {
      const dir = dirLine.replace("worktree ", "")
      try {
        await execa("git", ["worktree", "remove", "--force", dir], { cwd: root })
      } catch {
        // already removed
      }
    }
  }

  // Delete all cia-test/ branches
  const { stdout: branchList } = await execa("git", ["branch", "--list", "cia-test/*"], {
    cwd: root,
  })
  for (const b of branchList
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    try {
      await execa("git", ["branch", "-D", b], { cwd: root })
    } catch {
      // already deleted
    }
  }

  // Prune stale worktree entries
  await execa("git", ["worktree", "prune"], { cwd: root })

  trackedBranches.length = 0
}
