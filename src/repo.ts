import { execa } from "execa"
import * as path from "path"
import { getProjectRoot } from "./config"
import { getRepoConfig } from "./config-repo"

/** Returns the configured base branch, or falls back to the branch checked out in the root worktree. */
export async function getBaseBranch(): Promise<string> {
  const config = await getRepoConfig(getProjectRoot())
  if (config.baseBranch) {
    return config.baseBranch
  }
  const root = await getRepoRoot()
  const { stdout } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root })
  return stdout.trim()
}

export async function getRepoRoot(): Promise<string> {
  // When run from a worktree, --show-toplevel returns the worktree path.
  // Use --git-common-dir to find the main .git directory, then get its parent.
  const cwd = getProjectRoot()
  const { stdout } = await execa("git", ["rev-parse", "--git-common-dir"], { cwd })
  const commonDir = stdout.trim()
  // commonDir is either absolute path or relative path like ".git"
  const absoluteCommonDir = path.isAbsolute(commonDir) ? commonDir : path.resolve(cwd, commonDir)
  // The repo root is the parent of the .git directory
  return path.dirname(absoluteCommonDir)
}
