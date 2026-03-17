import chalk from "chalk"
import { Box, Text, useInput } from "ink"
import TextInput from "ink-text-input"
import type React from "react"
import { useEffect, useState } from "react"
import { listBranchesWithoutWorktrees } from "../git-ops"

export type CreateResult =
  | { kind: "new"; name: string }
  | { kind: "existing"; branch: string }

export const CreatePrompt: React.FC<{
  prefix: string // e.g., "agent/"
  onSubmit: (result: CreateResult) => void
  onCancel: () => void
}> = ({ prefix, onSubmit, onCancel }) => {
  const [value, setValue] = useState<string>(prefix)
  // selectedIdx: 0 = "New Branch", 1..N = existing branches
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [existingBranches, setExistingBranches] = useState<string[]>([])

  useEffect(() => {
    listBranchesWithoutWorktrees(prefix).then(setExistingBranches)
  }, [prefix])

  const totalItems = 1 + existingBranches.length

  useInput((_input, key) => {
    if (key.escape) {
      onCancel()
      return
    }
    if (selectedIdx > 0) {
      // Existing branch selected
      if (key.return) {
        onSubmit({ kind: "existing", branch: existingBranches[selectedIdx - 1] })
        return
      }
      if (key.upArrow) {
        setSelectedIdx((i) => Math.max(0, i - 1))
        return
      }
      if (key.downArrow) {
        setSelectedIdx((i) => Math.min(totalItems - 1, i + 1))
        return
      }
    } else {
      // "New Branch" selected — only handle arrow navigation
      // (TextInput handles typing and Enter)
      if (key.downArrow && existingBranches.length > 0) {
        setSelectedIdx(1)
        return
      }
    }
  })

  const isNewSelected = selectedIdx === 0

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold("Create new worktree")}</Text>
      <Text dimColor>Must start with {prefix}</Text>
      <Box marginTop={1} flexDirection="column">
        {/* New Branch option */}
        <Box>
          <Text>{isNewSelected ? chalk.cyan("❯ ") : "  "}</Text>
          <Text bold={isNewSelected}>New Branch: </Text>
          {isNewSelected ? (
            <TextInput
              value={value}
              onChange={setValue}
              onSubmit={(v) => onSubmit({ kind: "new", name: v.trim() })}
            />
          ) : (
            <Text dimColor>{value}</Text>
          )}
        </Box>

        {/* Existing branches */}
        {existingBranches.map((branch, i) => {
          const idx = i + 1
          const isSelected = selectedIdx === idx
          return (
            <Box key={branch}>
              <Text>{isSelected ? chalk.cyan("❯ ") : "  "}</Text>
              <Text bold={isSelected}>{branch}</Text>
            </Box>
          )
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {existingBranches.length > 0
            ? "↑/↓ select • Enter to create • Esc to cancel"
            : "Enter to create • Esc to cancel"}
        </Text>
      </Box>
    </Box>
  )
}
