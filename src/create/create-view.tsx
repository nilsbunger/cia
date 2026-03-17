import chalk from "chalk"
import type React from "react"
import type { Action } from "../app-state-reducer"
import { type CreateWorktreeResult, createWorktree } from "../cmd-ops"
import { type CreateResult, CreatePrompt } from "./create-prompt"

function formatCreateMsg(label: string, result: CreateWorktreeResult): string {
  const parts = [`Created ${label}`]
  if (result.scriptOutput) {
    parts.push(chalk.green("onCreateScript ran successfully"))
    const out = [result.scriptOutput.stdout, result.scriptOutput.stderr].filter(Boolean).join("\n")
    if (out) parts.push(out)
  }
  return parts.join("\n")
}

export const CreateView: React.FC<{
  prefix: string
  dispatch: React.Dispatch<Action>
  refresh: () => Promise<void>
}> = ({ prefix, dispatch, refresh }) => (
  <CreatePrompt
    prefix={prefix}
    onSubmit={async (result: CreateResult) => {
      if (result.kind === "new") {
        const name = result.name
        if (!name.startsWith(prefix)) {
          dispatch({ type: "dismiss", msg: chalk.red(`Worktree name must start with ${prefix}`) })
          return
        }
        dispatch({ type: "dismiss", msg: `Creating ${name}…` })
        try {
          const wtResult = await createWorktree(name)
          if (wtResult.scriptError) {
            dispatch({
              type: "open-dialog",
              dialog: { mode: "confirm-cleanup-failed-create", branch: name, existingBranch: false, error: wtResult.scriptError },
            })
          } else {
            dispatch({ type: "set-msg", msg: formatCreateMsg(name, wtResult) })
          }
          await refresh()
        // biome-ignore lint/suspicious/noExplicitAny: ok for exceptions
        } catch (e: any) {
          const error = e.shortMessage || e.message
          dispatch({
            type: "open-dialog",
            dialog: { mode: "confirm-cleanup-failed-create", branch: name, existingBranch: false, error },
          })
        }
      } else {
        const branch = result.branch
        dispatch({ type: "dismiss", msg: `Creating worktree for ${branch}…` })
        try {
          const wtResult = await createWorktree(branch, true)
          if (wtResult.scriptError) {
            dispatch({
              type: "open-dialog",
              dialog: { mode: "confirm-cleanup-failed-create", branch, existingBranch: true, error: wtResult.scriptError },
            })
          } else {
            dispatch({ type: "set-msg", msg: formatCreateMsg(branch, wtResult) })
          }
          await refresh()
        // biome-ignore lint/suspicious/noExplicitAny: ok for exceptions
        } catch (e: any) {
          const error = e.shortMessage || e.message
          dispatch({
            type: "open-dialog",
            dialog: { mode: "confirm-cleanup-failed-create", branch, existingBranch: true, error },
          })
        }
      }
    }}
    onCancel={() => dispatch({ type: "dismiss" })}
  />
)
