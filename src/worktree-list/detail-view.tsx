import chalk from "chalk"
import { Box, Text, useInput } from "ink"
import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Action, AppState } from "../app-state-reducer"
import { getServiceForWorktree, isServiceRunning } from "../service"
import type { CommandMenu, Worktree, WorktreeCommand } from "../types"
import { getWorktreeMenus } from "../types"
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
  const menus = useMemo(() => getWorktreeMenus(worktree), [worktree])
  const [idx, setIdx] = useState(0)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const service = getServiceForWorktree(worktree.name)
  const running = isServiceRunning(worktree.name)
  const processingRef = useRef(false)

  const currentMenu = activeMenu ? (menus.find((m) => m.key === activeMenu) ?? null) : null
  const itemCount = currentMenu ? currentMenu.commands.length : menus.length

  // Clamp idx when items change (e.g. after refresh changes PR state)
  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, itemCount - 1)))
  }, [itemCount])

  useInput(async (input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      exit()
      return
    }
    if (key.escape || key.backspace) {
      if (activeMenu) {
        const menuIdx = menus.findIndex((m) => m.key === activeMenu)
        setActiveMenu(null)
        setIdx(menuIdx >= 0 ? menuIdx : 0)
      } else {
        dispatch({ type: "dismiss" })
      }
      return
    }
    if (key.upArrow || input === "k") {
      setIdx((i) => Math.max(0, i - 1))
      return
    }
    if (key.downArrow || input === "j") {
      setIdx((i) => Math.min(itemCount - 1, i + 1))
      return
    }
    if (processingRef.current) return

    if (!activeMenu) {
      // Top level: open a submenu
      const menuKey = key.return ? menus[idx].key : input
      const target = menus.find((m) => m.key === menuKey)
      if (!target) return
      setActiveMenu(menuKey)
      setIdx(0)
    } else {
      // Inside a submenu: execute a command
      const commands = currentMenu!.commands
      const commandKey = key.return ? commands[idx].key : input
      const cmdItem = commands.find((c) => c.key === commandKey)
      if (!cmdItem) return

      processingRef.current = true
      try {
        const cmdIdx = commands.findIndex((c) => c.key === commandKey)
        if (cmdIdx !== idx) {
          setIdx(cmdIdx)
          await new Promise((r) => setTimeout(r, 80))
        }
        await executeWorktreeCommand(commandKey, worktree, state, dispatch, refresh)
      } finally {
        processingRef.current = false
      }
    }
  })

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        <Text>{chalk.bold(worktree.name)}</Text>
        <Text dimColor>{worktree.worktreeDir}</Text>

        <Box marginTop={1} flexDirection="column">
          <GitStatusSection worktree={worktree} baseBranch={state.baseBranch} />
          <ServiceSection worktree={worktree} running={running} pid={service?.pid ?? null} />
          <PRSection worktree={worktree} />
          <WarningsSection worktree={worktree} />
        </Box>

        <Box marginTop={1} flexDirection="column">
          {currentMenu ? (
            <>
              <Text>
                {chalk.bold("Commands:")} {chalk.cyan(currentMenu.label)}
              </Text>
              {currentMenu.commands.map((cmd, i) => (
                <CommandRow key={cmd.key} cmd={cmd} selected={i === idx} />
              ))}
              <Text dimColor>{"  "}← esc back</Text>
            </>
          ) : (
            <>
              <Text>{chalk.bold("Commands:")}</Text>
              {menus.map((menu, i) => (
                <MenuRow key={menu.key} menu={menu} selected={i === idx} />
              ))}
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}

const GitStatusSection: React.FC<{ worktree: Worktree; baseBranch: string }> = ({
  worktree,
  baseBranch,
}) => {
  const { ahead, behind, dirtyCount, inProgress, lastCommitAge } = worktree

  const hasAheadBehind = ahead !== undefined && behind !== undefined
  const aheadBehindText = hasAheadBehind
    ? ahead === 0 && behind === 0
      ? `up to date with ${baseBranch}`
      : `${ahead} ahead, ${behind} behind ${baseBranch}`
    : null

  return (
    <Box flexDirection="column">
      <Text>{chalk.dim("Git:")}</Text>
      <Text> Last commit: {lastCommitAge ?? "unknown"}</Text>
      {aheadBehindText && (
        <Text>
          {"  "}Commits: {(behind ?? 0) > 0 ? chalk.yellow(aheadBehindText) : aheadBehindText}
        </Text>
      )}
      {dirtyCount !== undefined && dirtyCount > 0 && (
        <Text> Dirty files: {chalk.yellow(String(dirtyCount))}</Text>
      )}
      {inProgress && (
        <Box flexDirection="column">
          <Text> {chalk.red.bold(`${inProgress} in progress`)}</Text>
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
        <Text>
          {" "}
          {chalk.green("● running")} {chalk.dim(`(pid ${pid})`)}
        </Text>
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
        <Text> {chalk.red(`✖ crashed with exit code ${worktree.serviceCrash.exitCode}`)}</Text>
        {displayLines.length > 0 && (
          <Box flexDirection="column" marginTop={0}>
            <Text dimColor>
              {" "}
              {outputLabel} (last {displayLines.length} line{displayLines.length > 1 ? "s" : ""}):
            </Text>
            {displayLines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable order
              <Text key={i} color="red">
                {"    "}
                {line}
              </Text>
            ))}
          </Box>
        )}
        <Text dimColor> Press s › r to restart the service</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{chalk.dim("Service:")}</Text>
      <Text> not running</Text>
    </Box>
  )
}

const PRSection: React.FC<{ worktree: Worktree }> = ({ worktree }) => {
  if (!worktree.prNumber) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text>{chalk.dim("Pull Request:")}</Text>
        <Text> No PR yet {chalk.dim("— press g › p to create")}</Text>
      </Box>
    )
  }

  const stateColor =
    worktree.prState === "merged" ? "magenta" : worktree.prState === "closed" ? "gray" : "blue"

  const stateLabel =
    worktree.prState === "merged" ? "merged ✓" : worktree.prState === "closed" ? "closed ✕" : "open"

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{chalk.dim("Pull Request:")}</Text>
      <Text>
        {" "}
        #{worktree.prNumber} {chalk[stateColor](stateLabel)}
      </Text>
      <Text dimColor> {worktree.prUrl}</Text>
    </Box>
  )
}

const WarningsSection: React.FC<{ worktree: Worktree }> = ({ worktree }) => {
  if (worktree.hasBranch) return null
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="yellow">
        {worktree.prunable
          ? "⚠ Worktree is prunable — the directory is missing. Use d › d to delete."
          : "⚠ Detached HEAD — this worktree is not on a branch. Use d › d to delete if no longer needed."}
      </Text>
    </Box>
  )
}

const MenuRow: React.FC<{
  menu: CommandMenu
  selected: boolean
}> = ({ menu, selected }) => {
  const keyCol = chalk.yellow(menu.key.padEnd(2))
  const label = `${menu.label} ›`.padEnd(14)
  const line = `  ${keyCol} ${label} ${chalk.dim(menu.description)}`
  return <Text>{selected ? chalk.inverse(line) : line}</Text>
}

const CommandRow: React.FC<{
  cmd: WorktreeCommand
  selected: boolean
}> = ({ cmd, selected }) => {
  const keyCol = chalk.yellow(cmd.key.padEnd(2))
  const label = cmd.label.padEnd(14)
  const line = `  ${keyCol} ${label} ${chalk.dim(cmd.description)}`
  return <Text>{selected ? chalk.inverse(line) : line}</Text>
}
