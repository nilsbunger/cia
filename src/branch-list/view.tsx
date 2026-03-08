import type React from "react"
import { Box, Text } from "ink"
import chalk from "chalk"
import type { Row } from "../types"

// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "")

const Col: React.FC<{ s: number; text: string }> = ({ s, text }) => {
  const visible = stripAnsi(text)
  if (visible.length > s) {
    // Truncate based on visible length, but preserve ANSI codes
    let visCount = 0
    let i = 0
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
  return <Text>{text}{pad}</Text>
}

export const Header: React.FC = () => (
  <Box>
    <Col s={40} text={chalk.underline("Worktree")} />
    <Col s={8} text={chalk.underline("Run")} />
    <Col s={14} text={chalk.underline("Last commit")} />
    <Col s={18} text={chalk.underline("Status")} />
  </Box>
)

export const RowView: React.FC<{ row: Row; selected: boolean }> = ({ row, selected }) => {
  const running = row.serviceRunning ? chalk.green("●") : "—"
  const warning = row.hasBranch ? "" : " ⚠"
  const displayBranch = selected ? chalk.inverse(row.branch) + warning : row.branch + warning
  return (
    <Box>
      <Col s={40} text={displayBranch} />
      <Col s={8} text={running} />
      <Col s={14} text={row.lastCommitAge ?? "—"} />
      <Col s={18} text={row.status || ""} />
    </Box>
  )
}

export const Warnings: React.FC<{ rows: Row[] }> = ({ rows }) => {
  const detached = rows.filter((r) => !r.hasBranch)
  if (detached.length === 0) return null
  return (
    <Box flexDirection="column">
      {detached.map((r) => (
        <Text key={r.branch} color="yellow">
          ⚠ {r.branch}: worktree has no branch (detached HEAD)
        </Text>
      ))}
    </Box>
  )
}
