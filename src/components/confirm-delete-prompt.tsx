import chalk from "chalk"
import { Box, Text } from "ink"
import type { DeleteCandidate } from "../types"

const IssueList: React.FC<{ items: string[]; label: string; maxItems?: number }> = ({
  items,
  label,
  maxItems = 5,
}) => {
  if (items.length === 0) return null
  return (
    <>
      <Box marginTop={1}>
        <Text>{label}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        {items.slice(0, maxItems).map((item) => (
          <Box key={item}>
            <Text dimColor>{item}</Text>
          </Box>
        ))}
        {items.length > maxItems && <Text dimColor>... and {items.length - maxItems} more</Text>}
      </Box>
    </>
  )
}

export const ConfirmDeletePrompt: React.FC<{
  candidate: DeleteCandidate
}> = ({ candidate }) => {
  const { name, unmergedCommits, uncommittedFiles, worktreeIssues } = candidate

  return (
    <Box borderStyle="round" borderColor="red" paddingX={1} flexDirection="column" marginTop={1}>
      <Text>{chalk.bold.red("⚠ Warning: Issues detected")}</Text>

      <IssueList
        items={unmergedCommits}
        label={`Worktree ${chalk.bold(name)} has ${chalk.bold(unmergedCommits.length)} unmerged commit(s):`}
      />
      <IssueList
        items={uncommittedFiles}
        label={`Worktree ${chalk.bold(name)} has ${chalk.bold(uncommittedFiles.length)} uncommitted file(s):`}
      />
      <IssueList
        items={worktreeIssues}
        label={`Worktree has ${chalk.bold(worktreeIssues.length)} issue(s):`}
      />

      <Box marginTop={1}>
        <Text>{chalk.bold("Force delete this worktree anyway?")}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>y to force delete • n or Esc to cancel</Text>
      </Box>
    </Box>
  )
}
