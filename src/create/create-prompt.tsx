import type React from "react"
import { useState } from "react"
import { Box, Text, useInput } from "ink"
import TextInput from "ink-text-input"
import chalk from "chalk"

export const CreatePrompt: React.FC<{
  prefix: string // e.g., "agent/"
  onSubmit: (name: string) => void
  onCancel: () => void
}> = ({ prefix, onSubmit, onCancel }) => {
  const [value, setValue] = useState<string>(prefix)

  useInput((input, key) => {
    if (key.escape) onCancel()
  })

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold("Create new worktree")}</Text>
      <Text dimColor>Must start with {prefix}</Text>
      <Box marginTop={1}>
        <Text>Name: </Text>
        <TextInput value={value} onChange={setValue} onSubmit={(v) => onSubmit(v.trim())} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter to create • Esc to cancel</Text>
      </Box>
    </Box>
  )
}
