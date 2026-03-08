import type React from "react"
import { Box, Text } from "ink"
import chalk from "chalk"
import type { Row } from "../types"

const Col: React.FC<{ s: number; text: string }> = ({ s, text }) => {
  const t = text.length > s ? `${text.slice(0, s - 1)}…` : text.padEnd(s, " ")
  return <Text>{t}</Text>
}

export const Header: React.FC = () => (
  <Box>
    <Col s={38} text={chalk.underline("Worktree")} />
    <Col s={4} text={chalk.underline("Br")} />
    <Col s={8} text={chalk.underline("Run")} />
    <Col s={14} text={chalk.underline("Last commit")} />
    <Col s={18} text={chalk.underline("Status")} />
  </Box>
)

export const RowView: React.FC<{ row: Row; selected: boolean }> = ({ row, selected }) => {
  const branchCheck = row.hasBranch ? "[x]" : "[ ]"
  const running = row.serviceRunning ? chalk.green("●") : "—"
  const displayBranch = selected ? chalk.inverse(row.branch) : row.branch
  return (
    <Box>
      <Col s={38} text={displayBranch} />
      <Col s={4} text={branchCheck} />
      <Col s={8} text={running} />
      <Col s={14} text={row.lastCommitAge ?? "—"} />
      <Col s={18} text={row.status || ""} />
    </Box>
  )
}
