import type React from "react"
import { useState } from "react"
import { Box, Text, useInput } from "ink"
import TextInput from "ink-text-input"
import chalk from "chalk"

export const PrefixPrompt: React.FC<{
  currentPrefix: string
  onSubmit: (prefix: string) => void
  onCancel: () => void
}> = ({ currentPrefix, onSubmit, onCancel }) => {
  const [value, setValue] = useState<string>(currentPrefix)

  useInput((input, key) => {
    if (key.escape) onCancel()
  })

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold("Set branch prefix")}</Text>
      <Text dimColor>Branches will be filtered and created with this prefix (e.g. nils/ or agent/)</Text>
      <Box marginTop={1}>
        <Text>Prefix: </Text>
        <TextInput value={value} onChange={setValue} onSubmit={(v) => onSubmit(v.trim())} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter to save • Esc to cancel</Text>
      </Box>
    </Box>
  )
}
