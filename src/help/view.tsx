import React from "react"
import { Box, Text } from "ink"
import chalk from "chalk"
import { WORKTREES_DIR_NAME } from "../constants"

export const HelpView: React.FC<{ branchPrefix: string }> = ({ branchPrefix }) => (
  <Box borderStyle="round" paddingX={1} paddingY={0} marginTop={1}>
    <Box flexDirection="column">
      <Text>{chalk.bold("Keys")}</Text>
      <Text> ↑/↓ Move selection</Text>
      <Text> enter Open selected branch in Cursor/VSCode (creates worktree if needed)</Text>
      <Text> n New agent branch (create + open)</Text>
      <Text> / Slash commands (e.g. /config for branch prefix)</Text>
      <Text> t Run service (opens new terminal; requires run command in /config)</Text>
      <Text> x Kill running service (with confirmation)</Text>
      <Text> s Sync (rebase selected onto local main)</Text>
      <Text> p Push to remote for backup</Text>
      <Text> m Merge selected → main</Text>
      <Text> d Delete selected branch + worktree + remote backup (warns if unmerged)</Text>
      <Text> r Refresh list</Text>
      <Text> ? Toggle help</Text>
      <Text> q Quit</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>{chalk.bold("Notes")}</Text>
        <Text>• Branches must start with {branchPrefix}</Text>
        <Text>• Worktrees live in {WORKTREES_DIR_NAME}/, nested by branch path</Text>
        <Text>• Status column shows ↑ahead↓behind (vs local main) and *dirty-count</Text>
        <Text>• All operations are local; push is optional for remote backup</Text>
      </Box>
    </Box>
  </Box>
)
