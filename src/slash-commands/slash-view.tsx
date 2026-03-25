import chalk from "chalk"
import type React from "react"
import type { Action, AppState } from "../app-state-reducer"
import { getConfig, setBaseBranch, setBranchPrefix, setEditCommand, setEditor, setOnCreateScript, setRunCommand, setRunDir } from "../config"
import { ConfigPrompt } from "./config-prompt"
import { SlashCommandPrompt } from "./slash-command-prompt"

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
  const { branchPrefix, editor, baseBranch, runCommand, runDir, onCreateScript, editCommand, repoRoot } = state

  return (
    <ConfigPrompt
      currentPrefix={branchPrefix}
      currentEditor={editor}
      currentBaseBranch={baseBranch}
      currentRunCommand={runCommand}
      currentRunDir={runDir}
      currentOnCreateScript={onCreateScript}
      currentEditCommand={editCommand}
      onSubmit={async (prefix, editorType, base, cmd, dir, createScript, editCmd) => {
        await setBranchPrefix(prefix)
        await setEditor(editorType)
        await setBaseBranch(base)
        await setRunCommand(cmd)
        await setRunDir(dir)
        await setOnCreateScript(createScript)
        await setEditCommand(editCmd)
        const result = await getConfig()
        const config = result.ok ? result.config : { branchPrefix, editor, baseBranch, runCommand, runDir, onCreateScript, editCommand }
        dispatch({
          type: "loaded-config",
          branchPrefix: config.branchPrefix,
          editor: config.editor,
          baseBranch: config.baseBranch ?? "",
          runCommand: config.runCommand ?? "",
          runDir: config.runDir ?? "",
          onCreateScript: config.onCreateScript ?? "",
          editCommand: config.editCommand ?? "",
          repoRoot,
        })
        dispatch({ type: "dismiss", msg: "Config saved" })
        await refresh()
      }}
      onCancel={() => dispatch({ type: "dismiss" })}
    />
  )
}
