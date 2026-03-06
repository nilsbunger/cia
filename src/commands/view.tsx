import React from "react"
import { SlashCommandPrompt } from "../components/slash-command-prompt"
import { ConfigPrompt } from "../components/config-prompt"

export type SlashCommandResult = "config" | { unknown: string } | "cancel"

export const SlashCommandView: React.FC<{
  onSubmit: (result: SlashCommandResult) => void
  onCancel: () => void
}> = ({ onSubmit, onCancel }) => (
  <SlashCommandPrompt
    onSubmit={(cmd) => {
      const name = cmd.replace(/^\//, "").toLowerCase()
      if (name === "config") onSubmit("config")
      else if (name) onSubmit({ unknown: name })
      else onSubmit("cancel")
    }}
    onCancel={onCancel}
  />
)

export const ConfigView: React.FC<{
  currentPrefix: string
  currentRunCommand: string
  onSubmit: (prefix: string, runCommand: string) => Promise<void>
  onCancel: () => void
}> = ({ currentPrefix, currentRunCommand, onSubmit, onCancel }) => (
  <ConfigPrompt
    currentPrefix={currentPrefix}
    currentRunCommand={currentRunCommand}
    onSubmit={onSubmit}
    onCancel={onCancel}
  />
)
