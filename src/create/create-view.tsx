import type React from "react"
import chalk from "chalk"
import { CreatePrompt } from "./create-prompt"
import { createWorktree, openEditor } from "../cmd-ops"
import type { Action } from "../app-state-reducer"

export const CreateView: React.FC<{
  prefix: string
  dispatch: React.Dispatch<Action>
  refresh: () => Promise<void>
}> = ({ prefix, dispatch, refresh }) => (
  <CreatePrompt
    prefix={prefix}
    onSubmit={async (name) => {
      if (!name.startsWith(prefix)) {
        dispatch({ type: "dismiss", msg: chalk.red(`Worktree name must start with ${prefix}`) })
        return
      }
      dispatch({ type: "dismiss", msg: `Creating ${name}…` })
      try {
        const _dir = await createWorktree(name)
        dispatch({ type: "set-msg", msg: `Created ${name}` })
        await refresh()
      // biome-ignore lint/suspicious/noExplicitAny: ok for exceptions
      } catch (e: any) {
        dispatch({ type: "set-msg", msg: chalk.red(`Failed: ${e.shortMessage || e.message}`) })
      }
    }}
    onCancel={() => dispatch({ type: "dismiss" })}
  />
)
