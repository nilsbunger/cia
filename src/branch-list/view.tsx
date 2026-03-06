import React from "react"
import { Box, Text } from "ink"
import chalk from "chalk"
import { Row } from "../types"

const Col: React.FC<{ s: number; text: string }> = ({ s, text }) => {
  const t = text.length > s ? text.slice(0, s - 1) + "…" : text.padEnd(s, " ")
  return <Text>{t}</Text>
}

export const Header: React.FC = () => (
  <Box>
    <Col s={38} text={chalk.underline("Branch")} />
    <Col s={12} text={chalk.underline("Worktree")} />
    <Col s={8} text={chalk.underline("Run")} />
    <Col s={18} text={chalk.underline("Status")} />
  </Box>
)

export const RowView: React.FC<{ row: Row; selected: boolean }> = ({ row, selected }) => {
  const worktree = row.worktreeDir ? "yes" : "—"
  const running = row.serviceRunning ? chalk.green("●") : "—"
  const displayBranch = selected ? chalk.inverse(row.branch) : row.branch
  return (
    <Box>
      <Col s={38} text={displayBranch} />
      <Col s={12} text={worktree} />
      <Col s={8} text={running} />
      <Col s={18} text={row.status || ""} />
    </Box>
  )
}
