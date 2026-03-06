import type React from "react"
import { Box, Text } from "ink"
import chalk from "chalk"

export const ConfirmKillPrompt: React.FC<{
  branch: string
}> = ({ branch }) => (
  <Box
    borderStyle="round"
    borderColor="yellow"
    paddingX={1}
    flexDirection="column"
    marginTop={1}>
    <Text>{chalk.bold.yellow("Kill running service?")}</Text>
    <Box marginTop={1}>
      <Text>
        Service is running for branch {chalk.bold(branch)}. Kill it?
      </Text>
    </Box>
    <Box marginTop={1}>
      <Text dimColor>y to kill • n or Esc to cancel</Text>
    </Box>
  </Box>
)
