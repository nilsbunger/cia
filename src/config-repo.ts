import * as fs from "node:fs"
import * as path from "node:path"
import { parse } from "jsonc-parser"

const REPO_CONFIG_FILE = "cia-repo.jsonc"

export interface CiaRepoConfig {
  /** Command to run the service (e.g. "npm run dev") */
  runCommand?: string
}

function repoConfigPath(repoRoot: string): string {
  return path.join(repoRoot, REPO_CONFIG_FILE)
}

export function repoConfigFilePath(repoRoot: string): string {
  return repoConfigPath(repoRoot)
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
      runCommand: typeof data.runCommand === "string" ? data.runCommand : undefined,
    }
  } catch {
    return {}
  }
}

export async function setRunCommand(repoRoot: string, runCommand: string): Promise<void> {
  const file = repoConfigPath(repoRoot)
  const current = await getRepoConfig(repoRoot)
  const config: CiaRepoConfig = { ...current, runCommand: runCommand.trim() || undefined }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
}
