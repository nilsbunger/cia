import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { spawn } from "node:child_process"
import { log } from "./utils"

const RUNNING_SERVICE_FILE = "running-service"

function runningServicePath(repoRoot: string): string {
  const ciaDir = path.join(repoRoot, ".cia")
  if (!fs.existsSync(ciaDir)) {
    fs.mkdirSync(ciaDir, { recursive: true })
  }
  return path.join(ciaDir, RUNNING_SERVICE_FILE)
}

/** Check if a process is still running */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Get the currently running branch and whether it's still alive */
export async function getRunningService(
  repoRoot: string,
): Promise<{ branch: string; pid: number } | null> {
  const file = runningServicePath(repoRoot)
  if (!fs.existsSync(file)) return null
  try {
    const content = fs.readFileSync(file, "utf-8").trim().split("\n")
    if (content.length < 2) return null
    const branch = content[0]
    const pid = Number.parseInt(content[1], 10)
    if (!Number.isFinite(pid)) return null
    if (!isProcessAlive(pid)) {
      fs.unlinkSync(file)
      return null
    }
    return { branch, pid }
  } catch {
    return null
  }
}

function clearRunningService(repoRoot: string): void {
  const file = runningServicePath(repoRoot)
  if (fs.existsSync(file)) fs.unlinkSync(file)
}

/** Run the service in a new terminal window. Only one branch can run at a time. */
export async function runService(
  repoRoot: string,
  branch: string,
  worktreeDir: string,
  runCommand: string,
): Promise<void> {
  const running = await getRunningService(repoRoot)
  if (running) {
    throw new Error(`Service already running for branch ${running.branch}. Kill it first (x).`)
  }

  if (os.platform() === "darwin") {
    await runServiceMac(repoRoot, branch, worktreeDir, runCommand)
  } else {
    await runServiceDetached(repoRoot, branch, worktreeDir, runCommand)
  }
}

async function runServiceMac(
  repoRoot: string,
  branch: string,
  worktreeDir: string,
  runCommand: string,
): Promise<void> {
  const ciaDir = path.join(repoRoot, ".cia")
  if (!fs.existsSync(ciaDir)) fs.mkdirSync(ciaDir, { recursive: true })
  const runningPath = runningServicePath(repoRoot)
  const scriptPath = path.join(ciaDir, "run-service.sh")
  const script = `#!/bin/bash
cd ${JSON.stringify(worktreeDir)}
printf '%s\\n%d\\n' ${JSON.stringify(branch)} $$ > ${JSON.stringify(runningPath)}
exec bash -c ${JSON.stringify(runCommand)}
`
  fs.writeFileSync(scriptPath, script, "utf-8")
  fs.chmodSync(scriptPath, 0o755)

  const osaScript = `tell application "Terminal" to do script "bash " & quoted form of ${JSON.stringify(scriptPath)}`
  spawn("osascript", ["-e", osaScript], { detached: true, stdio: "ignore" })

  // Poll for the PID file (script writes it before exec)
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100))
    if (fs.existsSync(runningPath)) {
      const content = fs.readFileSync(runningPath, "utf-8").trim().split("\n")
      const pid = Number.parseInt(content[1], 10)
      if (Number.isFinite(pid)) {
        log(`Service started for ${branch}, pid=${pid}`)
        return
      }
    }
  }
  throw new Error("Failed to start service: PID file not created")
}

async function runServiceDetached(
  repoRoot: string,
  branch: string,
  worktreeDir: string,
  runCommand: string,
): Promise<void> {
  const file = runningServicePath(repoRoot)
  const child = spawn("bash", ["-c", runCommand], {
    cwd: worktreeDir,
    detached: true,
    stdio: "ignore",
  })
  child.unref()
  const pid = child.pid ?? 0
  fs.writeFileSync(file, `${branch}\n${pid}\n`, "utf-8")
  log(`Service started for ${branch}, pid=${pid}`)
}

/** Kill the running service */
export async function killService(repoRoot: string): Promise<void> {
  const running = await getRunningService(repoRoot)
  if (!running) {
    throw new Error("No service is running")
  }
  try {
    process.kill(running.pid, "SIGTERM")
    log(`Sent SIGTERM to service pid=${running.pid}`)
  } catch (e) {
    log(`Failed to kill process ${running.pid}`, { error: (e as Error).message })
    try {
      process.kill(running.pid, "SIGKILL")
    } catch {
      // Process may already be dead
    }
  }
  clearRunningService(repoRoot)
}
