import * as fs from "node:fs"
import * as path from "node:path"
import { parse } from "jsonc-parser"

const CIA_DIR = ".cia"
const REPO_CONFIG_FILE = "cia-repo.jsonc"

export interface CiaRepoConfig {
  /** Branch to use as the base for new worktrees (e.g. "main", "develop"). Falls back to HEAD of root worktree. */
  baseBranch?: string
  /** Command to run the service (e.g. "npm run dev") */
  runCommand?: string
  /** Directory to run the service in, relative to repo root (e.g. "frontend") */
  runDir?: string
  /** Shell script to run after a new worktree is created. Executed with cwd set to the new worktree directory. */
  onCreateScript?: string
}

function repoConfigPath(repoRoot: string): string {
  return path.join(repoRoot, CIA_DIR, REPO_CONFIG_FILE)
}

export async function getRepoConfig(repoRoot: string): Promise<CiaRepoConfig> {
  const file = repoConfigPath(repoRoot)
  if (!fs.existsSync(file)) {
    return {}
  }
  try {
    const raw = fs.readFileSync(file, "utf-8")
    const data = parse(raw) as Partial<CiaRepoConfig>
    return {
      baseBranch: typeof data.baseBranch === "string" ? data.baseBranch : undefined,
      runCommand: typeof data.runCommand === "string" ? data.runCommand : undefined,
      runDir: typeof data.runDir === "string" ? data.runDir : undefined,
      onCreateScript: typeof data.onCreateScript === "string" ? data.onCreateScript : undefined,
    }
  } catch {
    return {}
  }
}

export async function setRunCommand(repoRoot: string, runCommand: string): Promise<void> {
  const ciaDir = path.join(repoRoot, CIA_DIR)
  if (!fs.existsSync(ciaDir)) {
    fs.mkdirSync(ciaDir, { recursive: true })
  }
  const file = repoConfigPath(repoRoot)
  const current = await getRepoConfig(repoRoot)
  const config: CiaRepoConfig = { ...current, runCommand: runCommand.trim() || undefined }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
}

export async function setBaseBranch(repoRoot: string, baseBranch: string): Promise<void> {
  const ciaDir = path.join(repoRoot, CIA_DIR)
  if (!fs.existsSync(ciaDir)) {
    fs.mkdirSync(ciaDir, { recursive: true })
  }
  const file = repoConfigPath(repoRoot)
  const current = await getRepoConfig(repoRoot)
  const config: CiaRepoConfig = { ...current, baseBranch: baseBranch.trim() || undefined }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
}

export async function setRunDir(repoRoot: string, runDir: string): Promise<void> {
  const ciaDir = path.join(repoRoot, CIA_DIR)
  if (!fs.existsSync(ciaDir)) {
    fs.mkdirSync(ciaDir, { recursive: true })
  }
  const file = repoConfigPath(repoRoot)
  const current = await getRepoConfig(repoRoot)
  const config: CiaRepoConfig = { ...current, runDir: runDir.trim() || undefined }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
}

export async function setOnCreateScript(repoRoot: string, onCreateScript: string): Promise<void> {
  const ciaDir = path.join(repoRoot, CIA_DIR)
  if (!fs.existsSync(ciaDir)) {
    fs.mkdirSync(ciaDir, { recursive: true })
  }
  const file = repoConfigPath(repoRoot)
  const current = await getRepoConfig(repoRoot)
  const config: CiaRepoConfig = { ...current, onCreateScript: onCreateScript.trim() || undefined }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
}
