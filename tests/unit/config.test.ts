import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { getUserConfig, setWorktreeDir, setBranchPrefix, setEditor } from "../../src/config-user"
import { getRepoConfig, setRunCommand } from "../../src/config-repo"

describe("Config System", () => {
  let tempDir: string

  beforeEach(() => {
    // Create a temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cia-config-test-"))
  })

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe("User Config", () => {
    it("should default to .worktrees for worktree directory", async () => {
      const config = await getUserConfig(tempDir)
      expect(config.worktreeDir).toBe(".worktrees")
    })

    it("should default editor to 'auto'", async () => {
      const config = await getUserConfig(tempDir)
      expect(config.editor).toBe("auto")
    })

    it("should default branch prefix to username/", async () => {
      const username = os.userInfo().username
      const config = await getUserConfig(tempDir)
      expect(config.branchPrefix).toBe(`${username}/`)
    })

    it("should store config in .cia/cia-user.jsonc", async () => {
      await setBranchPrefix(tempDir, "test/")
      const configPath = path.join(tempDir, ".cia", "cia-user.jsonc")
      expect(fs.existsSync(configPath)).toBe(true)
    })

    it("should allow custom worktree directory", async () => {
      await setWorktreeDir(tempDir, "../wt/")
      const config = await getUserConfig(tempDir)
      expect(config.worktreeDir).toBe("../wt/")
    })

    it("should persist custom worktree directory", async () => {
      await setWorktreeDir(tempDir, "../custom/")
      const config = await getUserConfig(tempDir)
      expect(config.worktreeDir).toBe("../custom/")

      // Read again to ensure it persists
      const config2 = await getUserConfig(tempDir)
      expect(config2.worktreeDir).toBe("../custom/")
    })

    it("should normalize branch prefix with trailing slash", async () => {
      await setBranchPrefix(tempDir, "myprefix")
      const config = await getUserConfig(tempDir)
      expect(config.branchPrefix).toBe("myprefix/")
    })

    it("should read existing config with both fields", async () => {
      // Manually create a config file
      const ciaDir = path.join(tempDir, ".cia")
      fs.mkdirSync(ciaDir, { recursive: true })
      const configData = {
        branchPrefix: "custom/",
        worktreeDir: "../external/",
      }
      fs.writeFileSync(
        path.join(ciaDir, "cia-user.jsonc"),
        JSON.stringify(configData, null, 2),
        "utf-8",
      )

      const config = await getUserConfig(tempDir)
      expect(config.branchPrefix).toBe("custom/")
      expect(config.worktreeDir).toBe("../external/")
    })

    it("should allow setting editor to claude", async () => {
      await setEditor(tempDir, "claude")
      const config = await getUserConfig(tempDir)
      expect(config.editor).toBe("claude")
    })

    it("should persist editor preference", async () => {
      await setEditor(tempDir, "cursor")
      const config1 = await getUserConfig(tempDir)
      expect(config1.editor).toBe("cursor")

      // Read again to ensure it persists
      const config2 = await getUserConfig(tempDir)
      expect(config2.editor).toBe("cursor")
    })
  })

  describe("Repo Config", () => {
    it("should store config in .cia/cia-repo.jsonc", async () => {
      await setRunCommand(tempDir, "npm run dev")
      const configPath = path.join(tempDir, ".cia", "cia-repo.jsonc")
      expect(fs.existsSync(configPath)).toBe(true)
    })

    it("should default to empty config", async () => {
      const config = await getRepoConfig(tempDir)
      expect(config.runCommand).toBeUndefined()
      expect(config.runDir).toBeUndefined()
    })

    it("should persist run command", async () => {
      await setRunCommand(tempDir, "pnpm dev")
      const config = await getRepoConfig(tempDir)
      expect(config.runCommand).toBe("pnpm dev")
    })
  })

  describe("Config Directory Structure", () => {
    it("should create .cia directory when setting user config", async () => {
      await setBranchPrefix(tempDir, "test/")
      const ciaDir = path.join(tempDir, ".cia")
      expect(fs.existsSync(ciaDir)).toBe(true)
      expect(fs.statSync(ciaDir).isDirectory()).toBe(true)
    })

    it("should create .cia directory when setting repo config", async () => {
      await setRunCommand(tempDir, "test command")
      const ciaDir = path.join(tempDir, ".cia")
      expect(fs.existsSync(ciaDir)).toBe(true)
      expect(fs.statSync(ciaDir).isDirectory()).toBe(true)
    })

    it("should keep existing .cia directory", async () => {
      const ciaDir = path.join(tempDir, ".cia")
      fs.mkdirSync(ciaDir)

      await setBranchPrefix(tempDir, "test/")
      await setRunCommand(tempDir, "test")

      expect(fs.existsSync(ciaDir)).toBe(true)
      expect(fs.existsSync(path.join(ciaDir, "cia-user.jsonc"))).toBe(true)
      expect(fs.existsSync(path.join(ciaDir, "cia-repo.jsonc"))).toBe(true)
    })
  })
})
