import React from "react"
import { Box, Text } from "ink"
import chalk from "chalk"

export const ConfirmOperationPrompt: React.FC<{
  branch: string
  operation: "merge" | "sync"
  conflictingFiles: string[]
}> = ({ branch, operation, conflictingFiles }) => {
  const operationName = operation === "merge" ? "Merge" : "Sync (rebase)"
  const operationDesc =
    operation === "merge"
      ? `merge ${branch} into main`
      : `rebase ${branch} onto main`

  return (
    <Box
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      flexDirection="column"
      marginTop={1}>
      <Text>{chalk.bold.yellow("⚠ Conflicts Predicted")}</Text>

      <Box marginTop={1}>
        <Text>
          {operationName} will likely cause conflicts in{" "}
          {chalk.bold(conflictingFiles.length)} file(s):
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        {conflictingFiles.slice(0, 5).map((file, i) => (
          <Box key={i}>
            <Text dimColor>{file}</Text>
          </Box>
        ))}
        {conflictingFiles.length > 5 && (
          <Text dimColor>... and {conflictingFiles.length - 5} more</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text>
          {chalk.bold(`Continue with ${operationDesc}?`)}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          If conflicts occur, resolve them in your editor.
        </Text>
      </Box>
      <Box>
        <Text dimColor>y to continue • n or Esc to cancel</Text>
      </Box>
    </Box>
  )
}
