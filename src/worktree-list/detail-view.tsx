import type React from "react"
import { useState } from "react"
import { Box, Text, useInput } from "ink"
import chalk from "chalk"
import type { Worktree } from "../types"
import { WORKTREE_COMMANDS } from "../types"
import type { AppState, Action } from "../app-state-reducer"
import { isServiceRunning, getServiceForWorktree } from "../service"
import { executeWorktreeCommand } from "./execute-command"

type DetailProps = {
  worktree: Worktree
  state: AppState
  dispatch: React.Dispatch<Action>
  refresh: () => Promise<void>
  exit: () => void
}

export const WorktreeDetailView: React.FC<DetailProps> = ({
  worktree,
  state,
  dispatch,
  refresh,
  exit,
}) => {
  const [idx, setIdx] = useState(0)
  const service = getServiceForWorktree(worktree.name)
  const running = isServiceRunning(worktree.name)

  useInput(async (input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      exit()
      return
    }
    if (key.escape) {
      dispatch({ type: "dismiss" })
      return
    }
    if (key.upArrow || input === "k") {
      setIdx((i) => Math.max(0, i - 1))
      return
    }
    if (key.downArrow || input === "j") {
      setIdx((i) => Math.min(WORKTREE_COMMANDS.length - 1, i + 1))
      return
    }
    // Execute command by letter shortcut or ENTER on selected
    const commandKey = key.return ? WORKTREE_COMMANDS[idx].key : input
    const cmdIdx = WORKTREE_COMMANDS.findIndex((c) => c.key === commandKey)
    if (cmdIdx === -1) return
    // Move highlight to the command before executing, let render tick
    if (cmdIdx !== idx) {
      setIdx(cmdIdx)
      await new Promise((r) => setTimeout(r, 80))
    }
    await executeWorktreeCommand(commandKey, worktree, state, dispatch, refresh)
  })

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        <Text>{chalk.bold(worktree.name)}</Text>
        <Text dimColor>{worktree.worktreeDir}</Text>

        <Box marginTop={1} flexDirection="column">
          <GitStatusSection worktree={worktree} />
          <ServiceSection worktree={worktree} running={running} pid={service?.pid ?? null} />
          <WarningsSection worktree={worktree} />
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text>{chalk.bold("Commands:")}</Text>
          {WORKTREE_COMMANDS.map((cmd, i) => (
            <CommandRow key={cmd.key} cmd={cmd} selected={i === idx} />
          ))}
        </Box>
      </Box>
    </Box>
  )
}

const GitStatusSection: React.FC<{ worktree: Worktree }> = ({ worktree }) => {
  const { ahead, behind, dirtyCount, inProgress, lastCommitAge } = worktree

  const hasAheadBehind = ahead !== undefined && behind !== undefined
  const aheadBehindText = hasAheadBehind
    ? ahead === 0 && behind === 0
      ? "up to date with main"
      : `${ahead} ahead, ${behind} behind main`
    : null

  return (
    <Box flexDirection="column">
      <Text>{chalk.dim("Git:")}</Text>
      <Text>  Last commit: {lastCommitAge ?? "unknown"}</Text>
      {aheadBehindText && (
        <Text>
          {"  "}Commits: {(behind ?? 0) > 0 ? chalk.yellow(aheadBehindText) : aheadBehindText}
        </Text>
      )}
      {dirtyCount !== undefined && dirtyCount > 0 && (
        <Text>  Dirty files: {chalk.yellow(String(dirtyCount))}</Text>
      )}
      {inProgress && (
        <Box flexDirection="column">
          <Text>  {chalk.red.bold(`${inProgress} in progress`)}</Text>
          <Text dimColor>
            {"  "}Open in editor to resolve, then continue the {inProgress.toLowerCase()}
          </Text>
        </Box>
      )}
    </Box>
  )
}

const ServiceSection: React.FC<{
  worktree: Worktree
  running: boolean
  pid: number | null
}> = ({ worktree, running, pid }) => {
  if (running && pid) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text>{chalk.dim("Service:")}</Text>
        <Text>  {chalk.green("● running")} {chalk.dim(`(pid ${pid})`)}</Text>
      </Box>
    )
  }
  if (worktree.serviceCrash) {
    const stderrLines = worktree.serviceCrash.stderr.trimEnd().split("\n").filter(Boolean)
    const stdoutLines = (worktree.serviceCrash.stdout ?? "").trimEnd().split("\n").filter(Boolean)
    // Show stderr if available, otherwise fall back to stdout
    const hasStderr = stderrLines.length > 0
    const outputLines = hasStderr ? stderrLines : stdoutLines
    const displayLines = outputLines.slice(-5)
    const outputLabel = hasStderr ? "stderr" : "stdout"
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text>{chalk.dim("Service:")}</Text>
        <Text>  {chalk.red(`✖ crashed with exit code ${worktree.serviceCrash.exitCode}`)}</Text>
        {displayLines.length > 0 && (
          <Box flexDirection="column" marginTop={0}>
            <Text dimColor>  {outputLabel} (last {displayLines.length} line{displayLines.length > 1 ? "s" : ""}):</Text>
            {displayLines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable order
              <Text key={i} color="red">{"    "}{line}</Text>
            ))}
          </Box>
        )}
        <Text dimColor>  Press r to restart the service</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{chalk.dim("Service:")}</Text>
      <Text>  not running</Text>
    </Box>
  )
}

const WarningsSection: React.FC<{ worktree: Worktree }> = ({ worktree }) => {
  if (worktree.hasBranch) return null
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="yellow">
        {worktree.prunable
          ? "⚠ Worktree is prunable — the directory is missing. Use D to force delete, or run `git worktree prune`."
          : "⚠ Detached HEAD — this worktree is not on a branch. Use D to force delete if no longer needed."}
      </Text>
    </Box>
  )
}

const CommandRow: React.FC<{
  cmd: { key: string; label: string; description: string }
  selected: boolean
}> = ({ cmd, selected }) => {
  const keyCol = chalk.yellow(cmd.key.padEnd(2))
  const label = cmd.label.padEnd(14)
  const line = `  ${keyCol} ${label} ${chalk.dim(cmd.description)}`
  return <Text>{selected ? chalk.inverse(line) : line}</Text>
}
