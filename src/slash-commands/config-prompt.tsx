import chalk from "chalk"
import { Box, Text, useInput } from "ink"
import TextInput from "ink-text-input"
import type React from "react"
import { useState } from "react"
import type { EditorType } from "../config-user"

const FIELDS = ["prefix", "editor", "baseBranch", "runCommand", "runDir", "onCreateScript", "editCommand"] as const
type Field = (typeof FIELDS)[number]

function nextField(f: Field): Field {
  const i = FIELDS.indexOf(f)
  return FIELDS[(i + 1) % FIELDS.length]
}

function prevField(f: Field): Field {
  const i = FIELDS.indexOf(f)
  return FIELDS[(i - 1 + FIELDS.length) % FIELDS.length]
}

export const ConfigPrompt: React.FC<{
  currentPrefix: string
  currentEditor: EditorType
  currentBaseBranch: string
  currentRunCommand: string
  currentRunDir: string
  currentOnCreateScript: string
  currentEditCommand: string
  onSubmit: (
    prefix: string,
    editor: EditorType,
    baseBranch: string,
    runCommand: string,
    runDir: string,
    onCreateScript: string,
    editCommand: string,
  ) => void | Promise<void>
  onCancel: () => void
}> = ({ currentPrefix, currentEditor, currentBaseBranch, currentRunCommand, currentRunDir, currentOnCreateScript, currentEditCommand, onSubmit, onCancel }) => {
  const [prefix, setPrefix] = useState<string>(currentPrefix)
  const [editor, setEditor] = useState<EditorType>(currentEditor)
  const [baseBranch, setBaseBranch] = useState<string>(currentBaseBranch)
  const [runCommand, setRunCommand] = useState<string>(currentRunCommand)
  const [runDir, setRunDir] = useState<string>(currentRunDir)
  const [onCreateScript, setOnCreateScript] = useState<string>(currentOnCreateScript)
  const [editCommand, setEditCommand] = useState<string>(currentEditCommand)
  const [activeField, setActiveField] = useState<Field>("prefix")

  useInput((_input, key) => {
    if (key.escape) onCancel()
    if (key.downArrow || (key.tab && !key.shift)) {
      setActiveField(nextField)
    }
    if (key.upArrow || (key.tab && key.shift)) {
      setActiveField(prevField)
    }
  })

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold("Configuration")}</Text>
      <Text dimColor>User config (cia-user.jsonc) and repo config (cia-repo.jsonc)</Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>Worktree prefix: </Text>
          {activeField === "prefix" ? (
            <TextInput
              value={prefix}
              onChange={setPrefix}
              onSubmit={(v) => {
                setPrefix(v.trim())
                setActiveField("editor")
              }}
              placeholder="e.g. nils/ or agent/"
            />
          ) : (
            <Text>{prefix || "(none)"}</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Editor: </Text>
          {activeField === "editor" ? (
            <TextInput
              value={editor}
              onChange={(v) => setEditor(v as EditorType)}
              onSubmit={(v) => {
                const normalized = v.trim() as EditorType
                setEditor(normalized)
                setActiveField("baseBranch")
              }}
              placeholder="auto, cursor, vscode, or claude"
            />
          ) : (
            <Text>{editor}</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Base branch: </Text>
          {activeField === "baseBranch" ? (
            <TextInput
              value={baseBranch}
              onChange={setBaseBranch}
              onSubmit={(v) => {
                setBaseBranch(v.trim())
                setActiveField("runCommand")
              }}
              placeholder="e.g. main (blank = current HEAD)"
            />
          ) : (
            <Text>{baseBranch || "(current HEAD)"}</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Run command (dev server): </Text>
          {activeField === "runCommand" ? (
            <TextInput
              value={runCommand}
              onChange={setRunCommand}
              onSubmit={(v) => {
                setRunCommand(v.trim())
                setActiveField("runDir")
              }}
              placeholder="e.g. npm run dev"
            />
          ) : (
            <Text>{runCommand || "(not set)"}</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Run dir (relative to repo root): </Text>
          {activeField === "runDir" ? (
            <TextInput
              value={runDir}
              onChange={setRunDir}
              onSubmit={(v) => {
                setRunDir(v.trim())
                setActiveField("onCreateScript")
              }}
              placeholder="e.g. frontend (blank = repo root)"
            />
          ) : (
            <Text>{runDir || "(repo root)"}</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>On-create script: </Text>
          {activeField === "onCreateScript" ? (
            <TextInput
              value={onCreateScript}
              onChange={setOnCreateScript}
              onSubmit={(v) => {
                setOnCreateScript(v.trim())
                setActiveField("editCommand")
              }}
              placeholder="e.g. pnpm install (runs in new worktree dir)"
            />
          ) : (
            <Text>{onCreateScript || "(not set)"}</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Edit command: </Text>
          {activeField === "editCommand" ? (
            <TextInput
              value={editCommand}
              onChange={setEditCommand}
              onSubmit={(v) => onSubmit(prefix.trim(), editor, baseBranch.trim(), runCommand.trim(), runDir.trim(), onCreateScript.trim(), v.trim())}
              placeholder="e.g. cursor -n . (runs in worktree root)"
            />
          ) : (
            <Text>{editCommand || "(not set — uses editor setting)"}</Text>
          )}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓/Tab to switch fields • Enter to save/next • Esc to cancel</Text>
      </Box>
    </Box>
  )
}
