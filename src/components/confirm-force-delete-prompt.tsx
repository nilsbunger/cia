import type React from "react"
import { Box, Text } from "ink"
import chalk from "chalk"

export const ConfirmForceDeletePrompt: React.FC<{
  branch: string
}> = ({ branch }) => (
  <Box
    borderStyle="round"
    borderColor="red"
    paddingX={1}
    flexDirection="column"
    marginTop={1}>
    <Text>{chalk.bold.red("Force delete branch?")}</Text>
    <Box marginTop={1}>
      <Text>
        Branch {chalk.bold(branch)} will be deleted with worktree and remote backup.
      </Text>
    </Box>
    <Box marginTop={1}>
      <Text dimColor>y to force delete • n or Esc to cancel</Text>
    </Box>
  </Box>
)
