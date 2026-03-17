import * as fs from "node:fs"
import * as path from "node:path"
import {
  type CiaRepoConfig,
  getRepoConfig,
  setBaseBranch as setRepoBaseBranch,
  setRunCommand as setRepoRunCommand,
  setRunDir as setRepoRunDir,
  setOnCreateScript as setRepoOnCreateScript,
} from "./config-repo"
import {
  type CiaUserConfig,
  type EditorType,
  getUserConfig,
  setBranchPrefix as setUserBranchPrefix,
  setEditor as setUserEditor,
} from "./config-user"
import { getRepoRoot } from "./repo"

const CIA_DIR = ".cia"

type CiaConfig = CiaUserConfig & CiaRepoConfig

type ConfigResult =
  | { ok: true; config: CiaConfig; repoRoot: string }
  | { ok: false; noProject: true }

/**
 * Get the project root directory where CIA should operate.
 * When run via `pnpm --dir`, pnpm sets INIT_CWD to the original invoking directory.
 * Otherwise, uses the current working directory.
 */
export function getProjectRoot(): string {
  return process.env.INIT_CWD || process.cwd()
}

export function getCiaDir(): string {
  return path.join(getProjectRoot(), CIA_DIR)
}

export function getCiaTempDir(): string {
  return path.join(getCiaDir(), "tmp")
}

export async function getConfig(): Promise<ConfigResult> {
  const ciaTempDir = getCiaTempDir()
  if (!fs.existsSync(ciaTempDir)) {
    fs.mkdirSync(ciaTempDir, { recursive: true })
  }

  try {
    const ciaDir = getCiaDir()
    const repoConfigPath = path.join(ciaDir, "cia-repo.jsonc")
    if (!fs.existsSync(repoConfigPath)) {
      return { ok: false, noProject: true }
    }
    const projectRoot = getProjectRoot()
    const repoRoot = await getRepoRoot()
    const [userConfig, repoConfig] = await Promise.all([
      getUserConfig(projectRoot),
      getRepoConfig(projectRoot),
    ])
    return {
      ok: true,
      config: {
        branchPrefix: userConfig.branchPrefix,
        worktreeDir: userConfig.worktreeDir,
        editor: userConfig.editor,
        baseBranch: repoConfig.baseBranch,
        runCommand: repoConfig.runCommand,
        runDir: repoConfig.runDir,
        onCreateScript: repoConfig.onCreateScript,
      },
      repoRoot,
    }
  } catch {
    return { ok: false, noProject: true }
  }
}

export async function createProject(): Promise<CiaConfig> {
  const ciaDir = getCiaDir()
  const projectRoot = getProjectRoot()

  // Ensure .cia directory exists
  if (!fs.existsSync(ciaDir)) {
    fs.mkdirSync(ciaDir, { recursive: true })
  }

  const userConfig = await getUserConfig(projectRoot)
  const repoConfig = await getRepoConfig(projectRoot)

  // Ensure both config files exist
  await setUserBranchPrefix(projectRoot, userConfig.branchPrefix)

  const repoConfigPath = path.join(ciaDir, "cia-repo.jsonc")
  if (!fs.existsSync(repoConfigPath)) {
    fs.writeFileSync(
      repoConfigPath,
      `${JSON.stringify({ ...repoConfig } as object, null, 2)}\n`,
      "utf-8",
    )
  }
  return {
    branchPrefix: userConfig.branchPrefix,
    worktreeDir: userConfig.worktreeDir,
    editor: userConfig.editor,
    baseBranch: repoConfig.baseBranch,
    runCommand: repoConfig.runCommand,
    runDir: repoConfig.runDir,
    onCreateScript: repoConfig.onCreateScript,
  }
}

export async function setBranchPrefix(prefix: string): Promise<void> {
  await setUserBranchPrefix(getProjectRoot(), prefix)
}

export async function setEditor(editor: EditorType): Promise<void> {
  await setUserEditor(getProjectRoot(), editor)
}

export async function setBaseBranch(baseBranch: string): Promise<void> {
  await setRepoBaseBranch(getProjectRoot(), baseBranch)
}

export async function setRunCommand(runCommand: string): Promise<void> {
  await setRepoRunCommand(getProjectRoot(), runCommand)
}

export async function setRunDir(runDir: string): Promise<void> {
  await setRepoRunDir(getProjectRoot(), runDir)
}

export async function setOnCreateScript(onCreateScript: string): Promise<void> {
  await setRepoOnCreateScript(getProjectRoot(), onCreateScript)
}
