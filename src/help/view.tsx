import chalk from "chalk"
import { Box, Text } from "ink"
import type React from "react"
import { WORKTREES_DIR_NAME } from "../constants"

export const HelpView: React.FC<{ branchPrefix: string }> = ({ branchPrefix }) => (
  <Box borderStyle="round" paddingX={1} paddingY={0} marginTop={1}>
    <Box flexDirection="column">
      <Text>{chalk.bold("List view")}</Text>
      <Text> ↑/↓ Move selection</Text>
      <Text> enter Open worktree detail + commands</Text>
      <Text> n New worktree (create + open)</Text>
      <Text> / Slash commands (e.g. /config for worktree prefix)</Text>
      <Text> ? Toggle help</Text>
      <Text> q Quit</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>{chalk.bold("Worktree detail (after pressing enter)")}</Text>
        <Text> e Open in Cursor/VSCode (creates worktree if needed)</Text>
        <Text> c Stage all changes & commit (opens terminal)</Text>
        <Text> r Run service (opens new terminal; requires run command in /config)</Text>
        <Text> x Kill running service (with confirmation)</Text>
        <Text> s Sync (rebase onto local main)</Text>
        <Text> p Create PR / push to remote (context-dependent)</Text>
        <Text> d Delete worktree + branch + remote backup (warns if unmerged)</Text>
        <Text> esc Back to list</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>{chalk.bold("Notes")}</Text>
        <Text>• Worktrees must start with {branchPrefix}</Text>
        <Text>• Worktrees live in {WORKTREES_DIR_NAME}/, nested by worktree name</Text>
        <Text>• Status column shows ↑ahead↓behind (vs local main) and *dirty-count</Text>
        <Text>• All operations are local; push is optional for remote backup</Text>
      </Box>
    </Box>
  </Box>
)
