import chalk from "chalk"
import { Box, Text } from "ink"
import type React from "react"

export const ConfirmForceDeletePrompt: React.FC<{
  name: string
}> = ({ name }) => (
  <Box borderStyle="round" borderColor="red" paddingX={1} flexDirection="column" marginTop={1}>
    <Text>{chalk.bold.red("Force delete worktree?")}</Text>
    <Box marginTop={1}>
      <Text>
        Worktree {chalk.bold(name)} will be deleted along with its local branch and remote backup.
      </Text>
    </Box>
    <Box marginTop={1}>
      <Text dimColor>y to force delete • n or Esc to cancel</Text>
    </Box>
  </Box>
)
