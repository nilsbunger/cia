import chalk from "chalk"
import { Box, Text } from "ink"

export const ConfirmCleanupCreatePrompt: React.FC<{
  branch: string
  error: string
}> = ({ branch, error }) => {
  return (
    <Box borderStyle="round" borderColor="red" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold.red("Worktree creation failed")}</Text>
      <Box marginTop={1}>
        <Text>
          Branch: {chalk.bold(branch)}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{error}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>{chalk.bold("Delete the failed branch and worktree?")}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter or y to delete • n or Esc to keep (for debugging)</Text>
      </Box>
    </Box>
  )
}
