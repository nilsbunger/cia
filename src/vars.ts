import { getProjectRoot } from "./config"

export type CiaVars = {
  "wt-name": string
  "wt-dir": string
  "project-root": string
}

/** Build the standard CIA variables for a given worktree context. */
export function buildVars(worktreeName: string, worktreeDir: string, branchPrefix?: string): CiaVars {
  const name = branchPrefix && worktreeName.startsWith(branchPrefix)
    ? worktreeName.slice(branchPrefix.length)
    : worktreeName
  return {
    "wt-name": name,
    "wt-dir": worktreeDir,
    "project-root": getProjectRoot(),
  }
}

/** Interpolate ${var} references in a template string. Unknown vars are left as-is. */
export function interpolate(template: string, vars: CiaVars): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
    if (key in vars) return vars[key as keyof CiaVars]
    return match
  })
}

/** Convert CIA vars to CIA_-prefixed env vars (wt-name → CIA_WT_NAME). */
export function makeCiaEnv(vars: CiaVars): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(vars)) {
    const envKey = `CIA_${key.replace(/-/g, "_").toUpperCase()}`
    env[envKey] = value
  }
  return env
}

/** Generate bash export lines for CIA env vars (for embedding in shell scripts). */
export function bashExports(vars: CiaVars): string {
  return Object.entries(makeCiaEnv(vars))
    .map(([k, v]) => `export ${k}=${JSON.stringify(v)}`)
    .join("\n")
}

export const VAR_DESCRIPTIONS = [
  { name: "wt-name", envName: "CIA_WT_NAME", description: "Worktree branch name (without prefix)" },
  { name: "wt-dir", envName: "CIA_WT_DIR", description: "Worktree directory" },
  { name: "project-root", envName: "CIA_PROJECT_ROOT", description: "Project root directory" },
] as const
