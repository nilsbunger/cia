import { execa } from "execa"
import * as path from "path"

/** Returns the branch currently checked out in the root worktree (the "base" branch). */
export async function getBaseBranch(): Promise<string> {
  const root = await getRepoRoot()
  const { stdout } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root })
  return stdout.trim()
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
