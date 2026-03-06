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

/** Project root = directory where the app runs. A project is any directory with cia config files. */
export function projectRoot(): string {
  return process.cwd()
}

export function configFilePath(): string {
  return path.join(projectRoot(), "cia-repo.jsonc")
}

export async function getConfig(): Promise<ConfigResult> {
  try {
    const projRoot = projectRoot()
    const repoConfigPath = path.join(projRoot, "cia-repo.jsonc")
    if (!fs.existsSync(repoConfigPath)) {
      return { ok: false, noProject: true }
    }
    const repoRoot = await getRepoRoot()
    const [userConfig, repoConfig] = await Promise.all([
      getUserConfig(projRoot),
      getRepoConfig(projRoot),
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
  const projRoot = projectRoot()
  const userConfig = await getUserConfig(projRoot)
  const repoConfig = await getRepoConfig(projRoot)
  // Ensure both config files exist
  await setUserBranchPrefix(projRoot, userConfig.branchPrefix)
  const repoConfigPath = path.join(projRoot, "cia-repo.jsonc")
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
  await setUserBranchPrefix(projectRoot(), prefix)
}

export async function setRunCommand(runCommand: string): Promise<void> {
  await setRepoRunCommand(projectRoot(), runCommand)
}

/** Resolve relative paths in the run command from cia project root. */
export function resolveRunCommand(runCommand: string): string {
  const cwd = projectRoot()
  const tokens = runCommand.split(/\s+/)
  const resolved = tokens.map((token) => {
    if (token.startsWith(".") || token.startsWith("..") || (token.includes("/") && !path.isAbsolute(token))) {
      return path.resolve(cwd, token)
    }
    return token
  })
  return resolved.join(" ")
}
