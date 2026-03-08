import type React from "react"
import { useState } from "react"
import { Box, Text, useInput } from "ink"
import TextInput from "ink-text-input"
import chalk from "chalk"

export const ConfigPrompt: React.FC<{
  currentPrefix: string
  currentRunCommand: string
  onSubmit: (prefix: string, runCommand: string) => void | Promise<void>
  onCancel: () => void
}> = ({ currentPrefix, currentRunCommand, onSubmit, onCancel }) => {
  const [prefix, setPrefix] = useState<string>(currentPrefix)
  const [runCommand, setRunCommand] = useState<string>(currentRunCommand)
  const [activeField, setActiveField] = useState<"prefix" | "runCommand">("prefix")

  useInput((input, key) => {
    if (key.escape) onCancel()
    if (key.tab) {
      setActiveField((f) => (f === "prefix" ? "runCommand" : "prefix"))
    }
  })

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold("Configuration")}</Text>
      <Text dimColor>User config (cia-user.jsonc) and repo config (cia-repo.jsonc)</Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>Branch prefix: </Text>
          {activeField === "prefix" ? (
            <TextInput
              value={prefix}
              onChange={setPrefix}
              onSubmit={(v) => {
                setPrefix(v.trim())
                setActiveField("runCommand")
              }}
              placeholder="e.g. nils/ or agent/"
            />
          ) : (
            <Text>{prefix || "(none)"}</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Run command: </Text>
          {activeField === "runCommand" ? (
            <TextInput
              value={runCommand}
              onChange={setRunCommand}
              onSubmit={(v) => onSubmit(prefix.trim(), v.trim())}
              placeholder="e.g. npm run dev"
            />
          ) : (
            <Text>{runCommand || "(not set)"}</Text>
          )}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Tab to switch fields • Enter to save/next • Esc to cancel</Text>
      </Box>
    </Box>
  )
}
