import { Box, Text } from "ink"
import chalk from "chalk"
import { BRANCH_PREFIX } from "../constants"
import { WORKTREES_DIR_NAME } from "../constants"
import { Row } from "../types"
import React from "react"


export const Help: React.FC = () => (
  <Box flexDirection="column">
    <Text>{chalk.bold("Keys")}</Text>
    <Text> ↑/↓ Move selection</Text>
    <Text> enter Open selected branch in Cursor/VSCode (creates worktree if needed)</Text>
    <Text> n New agent branch (create + open)</Text>
    <Text> s Sync (rebase selected onto local main)</Text>
    <Text> p Push to remote for backup</Text>
    <Text> m Merge selected → main</Text>
    <Text> d Delete selected branch + worktree + remote backup (warns if unmerged)</Text>
    <Text> r Refresh list</Text>
    <Text> ? Toggle help</Text>
    <Text> q Quit</Text>
    <Box marginTop={1} flexDirection="column">
      <Text>{chalk.bold("Notes")}</Text>
      <Text>• Branches must start with {BRANCH_PREFIX}</Text>
      <Text>• Worktrees live in {WORKTREES_DIR_NAME}/, named with slashes → "__"</Text>
      <Text>• Status column shows ↑ahead↓behind (vs local main) and *dirty-count</Text>
      <Text>• All operations are local; push is optional for remote backup</Text>
    </Box>
  </Box>
)

export const Header: React.FC = () => (
  <Box>
    <Col s={38} text={chalk.underline("Branch")} />
    <Col s={20} text={chalk.underline("Worktree")} />
    <Col s={20} text={chalk.underline("Status")} />
  </Box>
)

export const RowView: React.FC<{ row: Row; selected: boolean }> = ({ row, selected }) => {
  const worktree = row.worktreeDir ? "yes" : "—"
  return (
    <Box>
      <Col s={38} text={(selected ? chalk.inverse : (x: string) => x)(row.branch)} />
      <Col s={10} text={worktree} />
      <Col s={10} text={row.status || ""} />
    </Box>
  )
}

export const Col: React.FC<{ s: number; text: string }> = ({ s, text }) => {
  const t = text.length > s ? text.slice(0, s - 1) + "…" : text.padEnd(s, " ")
  return <Text>{t}</Text>
}
