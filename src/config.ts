import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { parse } from "jsonc-parser"
import { BRANCH_PREFIX } from "./constants"

const CONFIG_FILE = "cia.jsonc"

export interface CiaConfig {
  branchPrefix: string
}

export type ConfigResult =
  | { ok: true; config: CiaConfig }
  | { ok: false; noProject: true }

function getDefaultBranchPrefix(): string {
  const username = os.userInfo().username
  return username ? `${username}/` : BRANCH_PREFIX
}

function configPath(): string {
  return path.join(process.cwd(), CONFIG_FILE)
}

export function configFilePath(): string {
  return configPath()
}

export async function getConfig(): Promise<ConfigResult> {
  const file = configPath()
  if (!fs.existsSync(file)) {
    return { ok: false, noProject: true }
  }
  try {
    const raw = fs.readFileSync(file, "utf-8")
    const data = parse(raw) as Partial<CiaConfig>
    const prefix =
      typeof data.branchPrefix === "string" ? data.branchPrefix : getDefaultBranchPrefix()
    return {
      ok: true,
      config: {
        branchPrefix: prefix.endsWith("/") ? prefix : prefix + "/",
      },
    }
  } catch {
    return { ok: true, config: { branchPrefix: getDefaultBranchPrefix() } }
  }
}

export async function createProject(): Promise<CiaConfig> {
  const file = configPath()
  const defaultPrefix = getDefaultBranchPrefix()
  const config: CiaConfig = { branchPrefix: defaultPrefix }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
  return { ...config }
}

export async function setBranchPrefix(prefix: string): Promise<void> {
  const file = configPath()
  const normalized = prefix.trim().endsWith("/") ? prefix.trim() : prefix.trim() + "/"
  const result = await getConfig()
  const currentConfig =
    result.ok && result.config ? result.config : { branchPrefix: getDefaultBranchPrefix() }
  const config = { ...currentConfig, branchPrefix: normalized }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8")
}
