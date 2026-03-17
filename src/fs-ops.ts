import * as path from "node:path"
import { execa } from "execa"
import { getConfig, getProjectRoot } from "./config"

export async function branchDirname(branch: string): Promise<string> {
  const result = await getConfig()
  if (!result.ok) {
    throw new Error("CIA project not initialized")
  }
  const worktreeDir = result.config.worktreeDir
  const projRoot = getProjectRoot()
  return path.join(projRoot, worktreeDir, branch)
}
export async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execa("bash", ["-lc", `command -v ${cmd}`])
    return stdout.trim() || null
  } catch {
    return null
  }
}
