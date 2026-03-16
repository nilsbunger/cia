import chalk from "chalk"
import { Box, Text } from "ink"
import type React from "react"
import type { OperationCandidate } from "../types"

export const ConfirmOperationPrompt: React.FC<{
  candidate: OperationCandidate
}> = ({ candidate }) => {
  const operationName = candidate.operation === "merge" ? "Merge" : "Sync (rebase)"
  const operationDesc =
    candidate.operation === "merge"
      ? `merge ${candidate.name} into main`
      : `rebase ${candidate.name} onto main`

  return (
    <Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold.yellow("⚠ Conflicts Predicted")}</Text>

      <Box marginTop={1}>
        <Text>
          {operationName} will likely cause conflicts in{" "}
          {chalk.bold(candidate.conflictingFiles.length)} file(s):
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        {candidate.conflictingFiles.slice(0, 5).map((file, i) => (
          <Box key={file}>
            <Text dimColor>{file}</Text>
          </Box>
        ))}
        {candidate.conflictingFiles.length > 5 && (
          <Text dimColor>... and {candidate.conflictingFiles.length - 5} more</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text>{chalk.bold(`Continue with ${operationDesc}?`)}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>If conflicts occur, resolve them in your editor.</Text>
      </Box>
      <Box>
        <Text dimColor>y to continue • n or Esc to cancel</Text>
      </Box>
    </Box>
  )
}
