import React from "react"
import { CreatePrompt } from "../components/create-prompt"

export const CreateView: React.FC<{
  prefix: string
  onSubmit: (branchName: string) => void | Promise<void>
  onCancel: () => void
}> = ({ prefix, onSubmit, onCancel }) => (
  <CreatePrompt prefix={prefix} onSubmit={onSubmit} onCancel={onCancel} />
)
