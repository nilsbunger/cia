import chalk from "chalk"
import { Box, Text } from "ink"
import type React from "react"
import type { AppState } from "../app-state-reducer"
import type { Worktree } from "../types"

export const WorktreeListView: React.FC<{
  state: AppState
}> = ({ state }) => {
  const { rows, idx, loading, branchPrefix } = state

  return (
    <>
      <Box flexDirection="column" marginTop={1}>
        <Header />
        <Box flexDirection="column">
          {loading && <Text dimColor>Loading…</Text>}
          {!loading && rows.length === 0 && (
            <Text dimColor>No {branchPrefix} worktrees yet. Press "n" to create one.</Text>
          )}
          {!loading &&
            rows.map((r, i) => <WorktreeRow key={r.name} row={r} selected={i === idx} />)}
        </Box>
      </Box>
      <Warnings rows={rows} />
    </>
  )
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ok
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "")

const WorktreeCol: React.FC<{ s: number; text: string }> = ({ s, text }) => {
  const visible = stripAnsi(text)
  if (visible.length > s) {
    // Truncate based on visible length, but preserve ANSI codes
    let visCount = 0
    let i = 0
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ok
    const ansiRe = /\x1b\[[0-9;]*m/g
    let result = ""
    while (i < text.length && visCount < s - 1) {
      ansiRe.lastIndex = i
      const m = ansiRe.exec(text)
      if (m && m.index === i) {
        result += m[0]
        i += m[0].length
      } else {
        result += text[i]
        visCount++
        i++
      }
    }
    return <Text>{`${result}…`}</Text>
  }
  const pad = " ".repeat(s - visible.length)
  return (
    <Text>
      {text}
      {pad}
    </Text>
  )
}

const Header: React.FC = () => (
  <Box>
    <WorktreeCol s={40} text={chalk.underline("Worktree")} />
    <WorktreeCol s={8} text={chalk.underline("Run")} />
    <WorktreeCol s={10} text={chalk.underline("PR")} />
    <WorktreeCol s={14} text={chalk.underline("Last commit")} />
    <WorktreeCol s={18} text={chalk.underline("Status")} />
  </Box>
)

const WorktreeRow: React.FC<{ row: Worktree; selected: boolean }> = ({ row, selected }) => {
  const running = row.serviceRunning
    ? chalk.green("●")
    : row.serviceCrash
      ? chalk.red(`✖ ${row.serviceCrash.exitCode}`)
      : "—"
  const warning = row.hasBranch ? "" : " ⚠"
  const displayName = selected ? chalk.inverse(row.name) + warning : row.name + warning

  // Format PR status
  const prStatus = row.prNumber
    ? row.prState === "merged"
      ? chalk.magenta(`#${row.prNumber} ✓`)
      : row.prState === "closed"
        ? chalk.gray(`#${row.prNumber} ✕`)
        : chalk.blue(`#${row.prNumber}`)
    : "—"

  return (
    <Box>
      <WorktreeCol s={40} text={displayName} />
      <WorktreeCol s={8} text={running} />
      <WorktreeCol s={10} text={prStatus} />
      <WorktreeCol s={14} text={row.lastCommitAge ?? "—"} />
      <WorktreeCol s={18} text={row.status || ""} />
    </Box>
  )
}
const Warnings: React.FC<{ rows: Worktree[] }> = ({ rows }) => {
  const branchWarnings = rows.filter((r) => !r.hasBranch)
  const crashWarnings = rows.filter((r) => r.serviceCrash)
  if (branchWarnings.length === 0 && crashWarnings.length === 0) return null
  return (
    <Box flexDirection="column">
      {branchWarnings.map((r) => (
        <Text key={r.name} color="yellow">
          ⚠ {r.name}:{" "}
          {r.prunable ? "worktree is prunable (run git worktree prune)" : "detached HEAD"}
        </Text>
      ))}
      {crashWarnings.map((r) => {
        const lastLine =
          r.serviceCrash?.stderr.trimEnd().split("\n").pop() ||
          (r.serviceCrash?.stdout?.trimEnd().split("\n").pop() ?? "")
        return (
          <Text key={`crash-${r.name}`} color="red">
            ✖ {r.name}: exited {r.serviceCrash?.exitCode}
            {lastLine ? ` — ${lastLine}` : ""}
          </Text>
        )
      })}
    </Box>
  )
}
