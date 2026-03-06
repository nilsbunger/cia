import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "path"
import { getRepoRoot } from "./repo"
import { BRANCH_PREFIX } from "./constants"

const CONFIG_DIR = ".cia"
const CONFIG_FILE = "config.json"

export interface CiaConfig {
  branchPrefix: string
}

function getDefaultBranchPrefix(): string {
  const username = os.userInfo().username
  return username ? `${username}/` : BRANCH_PREFIX
}

function configPath(root: string): string {
  return path.join(root, CONFIG_DIR, CONFIG_FILE)
}

export async function getConfig(): Promise<CiaConfig> {
  const root = await getRepoRoot()
  const file = configPath(root)
  if (!fs.existsSync(file)) {
    const defaultPrefix = getDefaultBranchPrefix()
    const config: CiaConfig = { branchPrefix: defaultPrefix }
    // Persist default so user gets their username as prefix without manual setup
    const dir = path.join(root, CONFIG_DIR)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
    return { ...config }
  }
  try {
    const raw = fs.readFileSync(file, "utf-8")
    const data = JSON.parse(raw) as Partial<CiaConfig>
    const prefix =
      typeof data.branchPrefix === "string" ? data.branchPrefix : getDefaultBranchPrefix()
    return {
      branchPrefix: prefix.endsWith("/") ? prefix : prefix + "/",
    }
  } catch {
    return { branchPrefix: getDefaultBranchPrefix() }
  }
}

export async function setBranchPrefix(prefix: string): Promise<void> {
  const root = await getRepoRoot()
  const dir = path.join(root, CONFIG_DIR)
  const file = configPath(root)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const normalized = prefix.trim().endsWith("/") ? prefix.trim() : prefix.trim() + "/"
  const config = await getConfig()
  config.branchPrefix = normalized
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
}
