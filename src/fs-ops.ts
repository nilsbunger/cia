import * as path from "node:path"
import { WORKTREES_DIR_NAME } from "./constants"
import { execa } from "execa"

export function branchDirname(root: string, branch: string): string {
  return path.join(root, WORKTREES_DIR_NAME, branch)
}
export async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execa("bash", ["-lc", `command -v ${cmd}`])
    return stdout.trim() || null
  } catch {
    return null
  }
}
