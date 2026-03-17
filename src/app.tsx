import chalk from "chalk"
import { Box, Text, useApp } from "ink"
import type React from "react"
import { useCallback, useEffect, useReducer } from "react"
import { useTuiInput } from "./actions/use-tui-input"
import type { Action, AppState } from "./app-state-reducer"
import { appReducer, initialState } from "./app-state-reducer"
import { computeWorktrees } from "./cmd-helpers"
import { ConfirmCleanupCreatePrompt } from "./components/confirm-cleanup-create-prompt"
import { ConfirmDeletePrompt } from "./components/confirm-delete-prompt"
import { ConfirmForceDeletePrompt } from "./components/confirm-force-delete-prompt"
import { ConfirmKillPrompt } from "./components/confirm-kill-prompt"
import { ConfirmOperationPrompt } from "./components/confirm-operation-prompt"
import { InitPrompt } from "./components/init-prompt"
import { getConfig } from "./config"
import { CreateView } from "./create/create-view"
import { HelpView } from "./help/view"
import { useIdleSleep } from "./hooks/use-idle-sleep"
import { useInterval } from "./hooks/use-interval"
import { ConfigView, SlashCommandView } from "./slash-commands/slash-view"
import { LOG_FILE } from "./utils"
import { WorktreeDetailView } from "./worktree-list/detail-view"
import { WorktreeListView } from "./worktree-list/view"

const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export default function App() {
  const { exit } = useApp()
  const [state, dispatch] = useReducer(appReducer, initialState)

  const refresh = useCallback(async () => {
    const worktrees = await computeWorktrees()
    dispatch({ type: "refresh-done", rows: worktrees })
  }, [])

  const { sleeping } = useIdleSleep({ refresh, idleTimeoutMs: IDLE_TIMEOUT_MS })

  useEffect(() => {
    getConfig().then((r) => {
      if (r.ok) {
        dispatch({
          type: "loaded-config",
          branchPrefix: r.config.branchPrefix,
          editor: r.config.editor,
          baseBranch: r.config.baseBranch ?? "",
          runCommand: r.config.runCommand ?? "",
          runDir: r.config.runDir ?? "",
          onCreateScript: r.config.onCreateScript ?? "",
          repoRoot: r.repoRoot,
        })
        refresh()
      } else {
        dispatch({ type: "open-dialog", dialog: { mode: "init" } })
      }
    })
  }, [refresh])

  if (sleeping) {
    return <SleepingView />
  }

  return <ActiveView state={state} dispatch={dispatch} refresh={refresh} exit={exit} />
}

const SleepingView = () => {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" marginTop={2}>
      <Text>
        {chalk.dim("z")}
        {chalk.dim("z")}
        {chalk.dim("z")} {chalk.bold.dim("Sleeping")} {chalk.dim("z")}
        {chalk.dim("z")}
        {chalk.dim("z")}
      </Text>
      <Text> </Text>
      <Text dimColor>Idle for 5 minutes — refresh paused.</Text>
      <Text dimColor>Press any key to wake up.</Text>
    </Box>
  )
}

const ActiveView = ({
  state,
  dispatch,
  refresh,
  exit,
}: {
  state: AppState
  dispatch: React.Dispatch<Action>
  refresh: () => Promise<void>
  exit: () => void
}) => {
  const { dialog, msg, branchPrefix } = state

  useInterval(() => {
    if (dialog.mode === "list" || dialog.mode === "worktree-detail") refresh()
  }, 5000)

  useTuiInput(state, dispatch, refresh, exit)

  const mainView = (() => {
    switch (dialog.mode) {
      case "help":
        return <HelpView branchPrefix={branchPrefix} />
      case "slash-command":
        return <SlashCommandView dispatch={dispatch} />
      case "init":
        return <InitPrompt />
      case "config":
        return <ConfigView state={state} dispatch={dispatch} refresh={refresh} />
      case "create":
        return <CreateView prefix={branchPrefix} dispatch={dispatch} refresh={refresh} />
      case "confirm-delete":
        return <ConfirmDeletePrompt candidate={dialog.candidate} />
      case "confirm-force-delete":
        return <ConfirmForceDeletePrompt name={dialog.candidate.name} />
      case "confirm-merge":
      case "confirm-sync":
        return <ConfirmOperationPrompt candidate={dialog.candidate} />
      case "confirm-kill-service":
        return <ConfirmKillPrompt worktree={dialog.worktree} />
      case "confirm-cleanup-failed-create":
        return <ConfirmCleanupCreatePrompt branch={dialog.branch} error={dialog.error} />
      case "worktree-detail":
        return (
          <WorktreeDetailView
            worktree={dialog.worktree}
            state={state}
            dispatch={dispatch}
            refresh={refresh}
            exit={exit}
          />
        )
      case "list":
        return <WorktreeListView state={state} />
      default:
        return null
    }
  })()

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{chalk.bold("Agents TUI")}</Text>
        <Text>
          {" "}
          {chalk.dim("(")}
          {branchPrefix}
          {chalk.dim("… worktrees) – press ? for help")}
        </Text>
      </Box>
      <Box>
        <Text dimColor>Log: {LOG_FILE}</Text>
      </Box>

      {mainView}

      <Box marginTop={1}>
        <Text dimColor>{msg || " "}</Text>
      </Box>
      <Box>
        <Text dimColor>
          {dialog.mode === "worktree-detail"
            ? "Hints: ↑/↓ select command • enter execute • letter shortcut • esc back • q quit"
            : "Hints: ↑/↓ select • enter open • n new • / commands • ? help • q/esc quit"}
        </Text>
      </Box>
    </Box>
  )
}
