import * as fs from "node:fs"
import * as path from "node:path"
import {
  type CiaRepoConfig,
  getRepoConfig,
  setRunCommand as setRepoRunCommand,
  setRunDir as setRepoRunDir,
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

/** Project root = directory where the app runs. A project is any directory with cia config files. */
export const projectRoot = process.cwd()

export const ciaDir = path.join(projectRoot, CIA_DIR)

export const ciaTempDir = path.join(ciaDir, "tmp")

export async function getConfig(): Promise<ConfigResult> {
  if (!fs.existsSync(ciaTempDir)) {
    fs.mkdirSync(ciaTempDir, { recursive: true })
  }

  try {
    const repoConfigPath = path.join(ciaDir, "cia-repo.jsonc")
    if (!fs.existsSync(repoConfigPath)) {
      return { ok: false, noProject: true }
    }
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
        runCommand: repoConfig.runCommand,
        runDir: repoConfig.runDir,
      },
      repoRoot,
    }
  } catch {
    return { ok: false, noProject: true }
  }
}

export async function createProject(): Promise<CiaConfig> {
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
    runCommand: repoConfig.runCommand,
    runDir: repoConfig.runDir,
  }
}

export async function setBranchPrefix(prefix: string): Promise<void> {
  await setUserBranchPrefix(projectRoot, prefix)
}

export async function setEditor(editor: EditorType): Promise<void> {
  await setUserEditor(projectRoot, editor)
}

export async function setRunCommand(runCommand: string): Promise<void> {
  await setRepoRunCommand(projectRoot, runCommand)
}

export async function setRunDir(runDir: string): Promise<void> {
  await setRepoRunDir(projectRoot, runDir)
}
