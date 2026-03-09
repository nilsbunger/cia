import type React from "react"
import chalk from "chalk"
import { SlashCommandPrompt } from "./slash-command-prompt"
import { ConfigPrompt } from "./config-prompt"
import { setBranchPrefix, setRunCommand, setRunDir, getConfig } from "../config"
import type { Action, AppState } from "../app-state-reducer"

export const SlashCommandView: React.FC<{
  dispatch: React.Dispatch<Action>
}> = ({ dispatch }) => (
  <SlashCommandPrompt
    onSubmit={(cmd) => {
      const name = cmd.replace(/^\//, "").toLowerCase()
      if (name === "config") dispatch({ type: "open-dialog", dialog: { mode: "config" } })
      else if (name) dispatch({ type: "dismiss", msg: chalk.red(`Unknown command: /${name}`) })
      else dispatch({ type: "dismiss" })
    }}
    onCancel={() => dispatch({ type: "dismiss" })}
  />
)

export const ConfigView: React.FC<{
  state: AppState
  dispatch: React.Dispatch<Action>
  refresh: () => Promise<void>
}> = ({ state, dispatch, refresh }) => {
  const { branchPrefix, runCommand, runDir, repoRoot } = state

  return (
    <ConfigPrompt
      currentPrefix={branchPrefix}
      currentRunCommand={runCommand}
      currentRunDir={runDir}
      onSubmit={async (prefix, cmd, dir) => {
        await setBranchPrefix(prefix)
        await setRunCommand(cmd)
        await setRunDir(dir)
        const result = await getConfig()
        const config = result.ok
          ? result.config
          : { branchPrefix, runCommand, runDir }
        dispatch({
          type: "loaded-config",
          branchPrefix: config.branchPrefix,
          runCommand: config.runCommand ?? "",
          runDir: config.runDir ?? "",
          repoRoot,
        })
        dispatch({ type: "dismiss", msg: "Config saved" })
        await refresh()
      }}
      onCancel={() => dispatch({ type: "dismiss" })}
    />
  )
}
