import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanupAll, createTestWorktree, getTestRepoRoot, makeCommit } from "./helpers"

// Mock getConfig so computeWorktrees uses our test prefix
vi.mock("../../src/config", async () => {
  const helpers = await import("./helpers")
  const path = await import("node:path")
  return {
    getConfig: async () => {
      const root = await helpers.getTestRepoRoot()
      return {
        ok: true,
        config: { branchPrefix: "cia-test/", worktreeDir: ".worktrees" },
        repoRoot: root,
      }
    },
    projectRoot: process.cwd(),
    ciaDir: path.join(process.cwd(), ".cia"),
    ciaTempDir: path.join(process.cwd(), ".cia", "tmp"),
  }
})

// Mock service module (computeWorktrees dynamically imports it)
vi.mock("../../src/service", () => ({
  isServiceRunning: () => false,
  getServiceCrashInfo: () => null,
}))

// Mock github-ops module (computeWorktrees dynamically imports it)
vi.mock("../../src/github-ops", () => ({
  isGhCliAvailable: async () => false,
  getPRsForBranches: async () => new Map(),
}))

describe("worktree ahead/behind status", () => {
  beforeAll(async () => {
    await cleanupAll()
  })

  afterAll(async () => {
    await cleanupAll()
  })

  it("BUG-2: ahead/behind counts should not be swapped", async () => {
    // Create a worktree and make 2 commits so it's ahead of main
    const { dir, branch } = await createTestWorktree("bug2-swap")
    await makeCommit(dir, "file1.txt", "content1")
    await makeCommit(dir, "file2.txt", "content2")

    const { computeWorktrees } = await import("../../src/cmd-helpers")
    const worktrees = await computeWorktrees()
    const wt = worktrees.find((w) => w.name === branch)

    expect(wt).toBeDefined()
    // The worktree has 2 commits that main doesn't have → ahead=2
    // Main has 0 commits that the worktree doesn't have → behind=0
    expect(wt!.ahead).toBe(2)
    expect(wt!.behind).toBe(0)
  })

  it("BUG-1: ahead/behind should use getBaseBranch(), not hardcoded 'main'", async () => {
    const root = await getTestRepoRoot()

    // Create a worktree for an alternate base branch and add 3 commits to it,
    // so it diverges from main.
    const { dir: altBaseDir } = await createTestWorktree("alt-base")
    await makeCommit(altBaseDir, "base1.txt", "b1")
    await makeCommit(altBaseDir, "base2.txt", "b2")
    await makeCommit(altBaseDir, "base3.txt", "b3")

    // Create the worktree under test (branched from main, 0 extra commits)
    await createTestWorktree("bug1-hardcoded")

    // Mock getBaseBranch to return our alternate base branch.
    // If the code correctly calls getBaseBranch(), the rev-list will be computed
    // against cia-test/alt-base. If it hardcodes "main", the counts will differ.
    const repo = await import("../../src/repo")
    const spy = vi.spyOn(repo, "getBaseBranch").mockResolvedValue("cia-test/alt-base")

    try {
      const { computeWorktrees } = await import("../../src/cmd-helpers")
      const worktrees = await computeWorktrees()
      const wt = worktrees.find((w) => w.name === "cia-test/bug1-hardcoded")

      expect(wt).toBeDefined()

      // Relative to cia-test/alt-base:
      //   alt-base has 3 commits not in bug1-hardcoded → behind=3
      //   bug1-hardcoded has 0 commits not in alt-base → ahead=0
      // If the code hardcodes "main" instead:
      //   main has 0 commits not in bug1-hardcoded → behind=0  (WRONG)
      //   bug1-hardcoded has 0 commits not in main → ahead=0
      expect(wt!.behind).toBe(3)
    } finally {
      spy.mockRestore()
    }
  })
})
