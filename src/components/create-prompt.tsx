import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import TextInput from "ink-text-input"
import chalk from "chalk"
export const CreatePrompt: React.FC<{
  prefix: string // e.g., "agent/"
  onSubmit: (branch: string) => void
  onCancel: () => void
}> = ({ prefix, onSubmit, onCancel }) => {
  const [value, setValue] = useState<string>(prefix)

  useInput((input, key) => {
    if (key.escape) onCancel()
  })

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold("Create new agent branch")}</Text>
      <Text dimColor>Must start with {prefix}</Text>
      <Box marginTop={1}>
        <Text>Branch: </Text>
        <TextInput value={value} onChange={setValue} onSubmit={(v) => onSubmit(v.trim())} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter to create • Esc to cancel</Text>
      </Box>
    </Box>
  )
}
