import * as fs from "node:fs"
import * as path from "node:path"
import { getRepoRoot } from "./repo"
import { getUserConfig, setBranchPrefix as setUserBranchPrefix } from "./config-user"
import { getRepoConfig, setRunCommand as setRepoRunCommand } from "./config-repo"

export type { CiaUserConfig } from "./config-user"
export type { CiaRepoConfig } from "./config-repo"

export interface CiaConfig {
  branchPrefix: string
  runCommand?: string
}

export type ConfigResult =
  | { ok: true; config: CiaConfig; repoRoot: string }
  | { ok: false; noProject: true }

export function configFilePath(): string {
  return path.join(process.cwd(), "cia-repo.jsonc")
}

export async function getConfig(): Promise<ConfigResult> {
  try {
    const repoRoot = await getRepoRoot()
    const repoConfigPath = path.join(repoRoot, "cia-repo.jsonc")
    if (!fs.existsSync(repoConfigPath)) {
      return { ok: false, noProject: true }
    }
    const [userConfig, repoConfig] = await Promise.all([
      getUserConfig(repoRoot),
      getRepoConfig(repoRoot),
    ])
    return {
      ok: true,
      config: {
        branchPrefix: userConfig.branchPrefix,
        runCommand: repoConfig.runCommand,
      },
      repoRoot,
    }
  } catch {
    return { ok: false, noProject: true }
  }
}

export async function createProject(): Promise<CiaConfig> {
  const repoRoot = await getRepoRoot()
  const userConfig = await getUserConfig(repoRoot)
  const repoConfig = await getRepoConfig(repoRoot)
  // Ensure both config files exist
  await setUserBranchPrefix(repoRoot, userConfig.branchPrefix)
  const repoConfigPath = path.join(repoRoot, "cia-repo.jsonc")
  if (!fs.existsSync(repoConfigPath)) {
    fs.writeFileSync(
      repoConfigPath,
      JSON.stringify({ ...repoConfig } as object, null, 2) + "\n",
      "utf-8",
    )
  }
  return {
    branchPrefix: userConfig.branchPrefix,
    runCommand: repoConfig.runCommand,
  }
}

export async function setBranchPrefix(prefix: string): Promise<void> {
  const repoRoot = await getRepoRoot()
  await setUserBranchPrefix(repoRoot, prefix)
}

export async function setRunCommand(runCommand: string): Promise<void> {
  const repoRoot = await getRepoRoot()
  await setRepoRunCommand(repoRoot, runCommand)
}
