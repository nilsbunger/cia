import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { parse } from "jsonc-parser"
import { BRANCH_PREFIX } from "./constants"

const USER_CONFIG_FILE = "cia-user.jsonc"

export interface CiaUserConfig {
  branchPrefix: string
}

function getDefaultBranchPrefix(): string {
  const username = os.userInfo().username
  return username ? `${username}/` : BRANCH_PREFIX
}

function userConfigPath(repoRoot: string): string {
  return path.join(repoRoot, USER_CONFIG_FILE)
}

export function userConfigFilePath(repoRoot: string): string {
  return userConfigPath(repoRoot)
}

export async function getUserConfig(repoRoot: string): Promise<CiaUserConfig> {
  const file = userConfigPath(repoRoot)
  if (!fs.existsSync(file)) {
    return { branchPrefix: getDefaultBranchPrefix() }
  }
  try {
    const raw = fs.readFileSync(file, "utf-8")
    const data = parse(raw) as Partial<CiaUserConfig>
    const prefix =
      typeof data.branchPrefix === "string" ? data.branchPrefix : getDefaultBranchPrefix()
    return {
      branchPrefix: prefix.endsWith("/") ? prefix : prefix + "/",
    }
  } catch {
    return { branchPrefix: getDefaultBranchPrefix() }
  }
}

export async function setBranchPrefix(repoRoot: string, prefix: string): Promise<void> {
  const file = userConfigPath(repoRoot)
  const normalized = prefix.trim().endsWith("/") ? prefix.trim() : prefix.trim() + "/"
  const current = await getUserConfig(repoRoot)
  const config: CiaUserConfig = { ...current, branchPrefix: normalized }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
}

