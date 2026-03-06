import type React from "react"
import { Box, Text } from "ink"
import chalk from "chalk"

export const InitPrompt: React.FC = () => {
  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      flexDirection="column"
      marginTop={1}>
      <Text>{chalk.bold.cyan("No cia project found")}</Text>
      <Box marginTop={1}>
        <Text>Create a cia project here? (creates cia.jsonc)</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>y to create • n or Esc to quit</Text>
      </Box>
    </Box>
  )
}
