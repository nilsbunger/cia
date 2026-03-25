import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { parse } from "jsonc-parser"
import { BRANCH_PREFIX, WORKTREES_DIR_NAME } from "./constants"

const CIA_DIR = ".cia"
const USER_CONFIG_FILE = "cia-user.jsonc"

export interface CiaUserConfig {
  branchPrefix: string
  worktreeDir: string
}

function getDefaultBranchPrefix(): string {
  const username = os.userInfo().username
  return username ? `${username}/` : BRANCH_PREFIX
}

function getDefaultWorktreeDir(): string {
  return WORKTREES_DIR_NAME
}

function userConfigPath(repoRoot: string): string {
  return path.join(repoRoot, CIA_DIR, USER_CONFIG_FILE)
}

export async function getUserConfig(repoRoot: string): Promise<CiaUserConfig> {
  const file = userConfigPath(repoRoot)
  if (!fs.existsSync(file)) {
    return {
      branchPrefix: getDefaultBranchPrefix(),
      worktreeDir: getDefaultWorktreeDir(),
    }
  }
  try {
    const raw = fs.readFileSync(file, "utf-8")
    const data = parse(raw) as Partial<CiaUserConfig>
    const prefix =
      typeof data.branchPrefix === "string" ? data.branchPrefix : getDefaultBranchPrefix()
    const worktreeDir =
      typeof data.worktreeDir === "string" ? data.worktreeDir : getDefaultWorktreeDir()
    return {
      branchPrefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
      worktreeDir,
    }
  } catch {
    return {
      branchPrefix: getDefaultBranchPrefix(),
      worktreeDir: getDefaultWorktreeDir(),
    }
  }
}

export async function setBranchPrefix(repoRoot: string, prefix: string): Promise<void> {
  const ciaDir = path.join(repoRoot, CIA_DIR)
  if (!fs.existsSync(ciaDir)) {
    fs.mkdirSync(ciaDir, { recursive: true })
  }
  const file = userConfigPath(repoRoot)
  const normalized = prefix.trim().endsWith("/") ? prefix.trim() : `${prefix.trim()}/`
  const current = await getUserConfig(repoRoot)
  const config: CiaUserConfig = {
    branchPrefix: normalized,
    worktreeDir: current.worktreeDir,
  }
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf-8")
}

export async function setWorktreeDir(repoRoot: string, worktreeDir: string): Promise<void> {
  const ciaDir = path.join(repoRoot, CIA_DIR)
  if (!fs.existsSync(ciaDir)) {
    fs.mkdirSync(ciaDir, { recursive: true })
  }
  const file = userConfigPath(repoRoot)
  const current = await getUserConfig(repoRoot)
  const config: CiaUserConfig = {
    branchPrefix: current.branchPrefix,
    worktreeDir: worktreeDir.trim(),
  }
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf-8")
}

