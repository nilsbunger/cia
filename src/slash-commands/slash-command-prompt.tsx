import type React from "react"
import { useState } from "react"
import { Box, Text, useInput } from "ink"
import TextInput from "ink-text-input"
import chalk from "chalk"

export const SlashCommandPrompt: React.FC<{
  onSubmit: (command: string) => void
  onCancel: () => void
}> = ({ onSubmit, onCancel }) => {
  const [value, setValue] = useState<string>("")

  useInput((input, key) => {
    if (key.escape) onCancel()
  })

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold("Command")}</Text>
      <Box marginTop={1}>
        <Text>/</Text>
        <TextInput value={value} onChange={setValue} onSubmit={(v) => onSubmit(v.trim())} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter to run • Esc to cancel</Text>
      </Box>
    </Box>
  )
}
