import { execa } from "execa"
import { getBaseBranch, getRepoRoot } from "./repo"
import { log } from "./utils"

export type PRInfo = {
  number: number
  url: string
  state: "open" | "closed" | "merged"
  title: string
}

/**
 * Check if the GitHub CLI is available
 */
export async function isGhCliAvailable(): Promise<boolean> {
  try {
    await execa("gh", ["--version"])
    return true
  } catch {
    return false
  }
}

/**
 * Create a GitHub pull request for the given branch
 */
export async function createPR(branch: string, title?: string, body?: string): Promise<PRInfo> {
  const root = await getRepoRoot()
  const baseBranch = await getBaseBranch()

  log(`createPR: Creating PR for branch ${branch} -> ${baseBranch}`)

  // Push the branch first
  try {
    await execa("git", ["push", "-u", "origin", branch], { cwd: root })
  } catch (e) {
    log(`createPR: Push failed or branch already pushed`, { error: (e as Error).message })
    // Continue anyway - branch might already be pushed
  }

  // Create PR using GitHub CLI
  const args = ["pr", "create", "--head", branch, "--base", baseBranch]

  if (title) {
    args.push("--title", title)
  } else {
    args.push("--title", `[${branch}] Pull Request`)
  }

  if (body) {
    args.push("--body", body)
  } else {
    args.push("--body", "")
  }

  const { stdout } = await execa("gh", args, { cwd: root })
  const url = stdout.trim()

  log(`createPR: PR created successfully`, { url })

  // Extract PR number from URL (format: https://github.com/owner/repo/pull/123)
  const match = url.match(/\/pull\/(\d+)$/)
  const number = match ? Number.parseInt(match[1], 10) : 0

  return {
    number,
    url,
    state: "open",
    title: title || `[${branch}] Pull Request`,
  }
}

/**
 * Get PR information for a branch
 */
export async function getPRForBranch(branch: string): Promise<PRInfo | null> {
  const root = await getRepoRoot()

  try {
    // Use gh pr list to find PRs for this branch
    const { stdout } = await execa(
      "gh",
      ["pr", "list", "--head", branch, "--json", "number,url,state,title", "--limit", "1"],
      { cwd: root },
    )

    const prs = JSON.parse(stdout) as Array<{
      number: number
      url: string
      state: string
      title: string
    }>

    if (prs.length === 0) {
      return null
    }

    const pr = prs[0]

    // Normalize state to our expected values
    const state: "open" | "closed" | "merged" =
      pr.state.toLowerCase() === "merged"
        ? "merged"
        : pr.state.toLowerCase() === "open"
          ? "open"
          : "closed"

    return {
      number: pr.number,
      url: pr.url,
      state,
      title: pr.title,
    }
  } catch (e) {
    log(`getPRForBranch: Failed to get PR info for ${branch}`, { error: (e as Error).message })
    return null
  }
}

/**
 * Get PR information for multiple branches in batch
 */
export async function getPRsForBranches(branches: string[]): Promise<Map<string, PRInfo>> {
  const root = await getRepoRoot()
  const results = new Map<string, PRInfo>()

  if (branches.length === 0) {
    return results
  }

  try {
    // Get all open PRs for the repo
    const { stdout } = await execa(
      "gh",
      ["pr", "list", "--json", "number,url,state,title,headRefName", "--limit", "100"],
      { cwd: root },
    )

    const prs = JSON.parse(stdout) as Array<{
      number: number
      url: string
      state: string
      title: string
      headRefName: string
    }>

    // Map PRs to branches
    for (const pr of prs) {
      if (branches.includes(pr.headRefName)) {
        const state: "open" | "closed" | "merged" =
          pr.state.toLowerCase() === "merged"
            ? "merged"
            : pr.state.toLowerCase() === "open"
              ? "open"
              : "closed"

        results.set(pr.headRefName, {
          number: pr.number,
          url: pr.url,
          state,
          title: pr.title,
        })
      }
    }
  } catch (e) {
    log(`getPRsForBranches: Failed to get PR info`, { error: (e as Error).message })
  }

  return results
}
