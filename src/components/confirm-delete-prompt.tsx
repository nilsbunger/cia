import { Box, Text } from "ink"
import chalk from "chalk"

export const ConfirmDeletePrompt: React.FC<{
  branch: string
  unmergedCommits: string[]
  uncommittedFiles: string[]
  worktreeIssues: string[]
}> = ({ branch, unmergedCommits, uncommittedFiles, worktreeIssues }) => {
  const hasUnmergedCommits = unmergedCommits.length > 0
  const hasUncommittedFiles = uncommittedFiles.length > 0
  const hasWorktreeIssues = worktreeIssues.length > 0

  return (
    <Box
      borderStyle="round"
      borderColor="red"
      paddingX={1}
      flexDirection="column"
      marginTop={1}>
      <Text>{chalk.bold.red("⚠ Warning: Issues detected")}</Text>

      {hasUnmergedCommits && (
        <>
          <Box marginTop={1}>
            <Text>
              Branch {chalk.bold(branch)} has {chalk.bold(unmergedCommits.length)} unmerged
              commit(s):
            </Text>
          </Box>
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {unmergedCommits.slice(0, 5).map((commit, i) => (
              <Box key={i}>
                <Text dimColor>{commit}</Text>
              </Box>
            ))}
            {unmergedCommits.length > 5 && (
              <Text dimColor>... and {unmergedCommits.length - 5} more</Text>
            )}
          </Box>
        </>
      )}

      {hasUncommittedFiles && (
        <>
          <Box marginTop={1}>
            <Text>
              Branch {chalk.bold(branch)} has {chalk.bold(uncommittedFiles.length)} uncommitted
              file(s):
            </Text>
          </Box>
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {uncommittedFiles.slice(0, 5).map((file, i) => (
              <Box key={i}>
                <Text dimColor>{file}</Text>
              </Box>
            ))}
            {uncommittedFiles.length > 5 && (
              <Text dimColor>... and {uncommittedFiles.length - 5} more</Text>
            )}
          </Box>
        </>
      )}

      {hasWorktreeIssues && (
        <>
          <Box marginTop={1}>
            <Text>Worktree has {chalk.bold(worktreeIssues.length)} issue(s):</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {worktreeIssues.map((issue, i) => (
              <Box key={i}>
                <Text dimColor>{issue}</Text>
              </Box>
            ))}
          </Box>
        </>
      )}

      <Box marginTop={1}>
        <Text>{chalk.bold("Force delete this branch anyway?")}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>y to force delete • n or Esc to cancel</Text>
      </Box>
    </Box>
  )
}
