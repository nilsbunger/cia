import { execa } from "execa"
import * as path from "path"

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
