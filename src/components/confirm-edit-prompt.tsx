import chalk from "chalk"
import { Box, Text } from "ink"
import type React from "react"
import type { EditCommandInfo } from "../types"

export const ConfirmEditPrompt: React.FC<{ info: EditCommandInfo }> = ({ info }) => (
  <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column" marginTop={1}>
    <Text>{chalk.bold.cyan("Open editor")}</Text>

    <Box marginTop={1} flexDirection="column">
      <Text>
        {chalk.dim("Command:")} {info.command}
      </Text>
      <Text>
        {chalk.dim("Directory:")} {info.dir}
      </Text>
      <Text>
        {chalk.dim("Source:")} {info.source === "configured" ? "editCommand in config" : "auto-detected"}
      </Text>
    </Box>

    <Box marginTop={1} flexDirection="column">
      <Text>{chalk.dim("Environment variables:")}</Text>
      {Object.entries(info.env).map(([key, value]) => (
        <Text key={key}>
          {"  "}
          {chalk.yellow(key)}={value}
        </Text>
      ))}
    </Box>

    <Box marginTop={1}>
      <Text dimColor>Enter to run • Esc to cancel</Text>
    </Box>
  </Box>
)
