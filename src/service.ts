import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { spawn } from "node:child_process"
import { log } from "./utils"
import { projectRoot } from "./config"

/** Sanitize worktree name for use as a filename (replace / with --) */
function pidFileName(worktree: string): string {
  return `${worktree.replace(/\//g, "--")}.pid`
}

function ciaTmpDir(): string {
  const dir = path.join(projectRoot(), ".cia-tmp")
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function pidFilePath(worktree: string): string {
  return path.join(ciaTmpDir(), pidFileName(worktree))
}

/** Detect which terminal the user is running in (best effort). */
function getPreferredTerminal(): "warp" | "iterm" | "terminal" {
  const term = process.env.TERM_PROGRAM ?? ""
  if (term === "WarpTerminal") return "warp"
  if (term === "iTerm.app") return "iterm"
  return "terminal"
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

type ServiceCrashInfo ={ exitCode: number; stderr: string; stdout: string }

/** Read PID from a pid file, returning null if missing or stale (and cleaning up stale files) */
function readPidFile(filePath: string): number | null {
  if (!fs.existsSync(filePath)) return null
  try {
    const pid = Number.parseInt(fs.readFileSync(filePath, "utf-8").trim(), 10)
    if (!Number.isFinite(pid)) {
      fs.unlinkSync(filePath)
      return null
    }
    if (!isProcessAlive(pid)) {
      // Don't clean up here — let getServiceCrashInfo read crash files first
      return null
    }
    return pid
  } catch {
    return null
  }
}

function crashFilePath(worktree: string): string {
  return path.join(ciaTmpDir(), `${pidFileName(worktree).replace(/\.pid$/, ".crash")}`)
}

/** Check for crash info left behind by a dead service process, persisting it for future reads. */
export function getServiceCrashInfo(worktree: string): ServiceCrashInfo | null {
  // First check for a previously persisted crash file
  const crashFile = crashFilePath(worktree)
  if (fs.existsSync(crashFile)) {
    try {
      return JSON.parse(fs.readFileSync(crashFile, "utf-8"))
    } catch {
      // Corrupted crash file, remove it
      try { fs.unlinkSync(crashFile) } catch {}
    }
  }

  // Check if the pid file indicates a newly dead process
  const pidFile = pidFilePath(worktree)
  if (!fs.existsSync(pidFile)) return null

  let pid: number
  try {
    pid = Number.parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10)
    if (!Number.isFinite(pid)) {
      fs.unlinkSync(pidFile)
      return null
    }
  } catch {
    return null
  }

  // If still alive, no crash
  if (isProcessAlive(pid)) return null

  const tmpDir = ciaTmpDir()
  const exitFile = path.join(tmpDir, `${pid}.exit`)
  const stderrFile = path.join(tmpDir, `${pid}.stderr`)
  const stdoutFile = path.join(tmpDir, `${pid}.stdout`)

  let crashInfo: ServiceCrashInfo | null = null

  if (fs.existsSync(exitFile)) {
    const exitCode = Number.parseInt(fs.readFileSync(exitFile, "utf-8").trim(), 10)
    let stderr = ""
    if (fs.existsSync(stderrFile)) {
      const full = fs.readFileSync(stderrFile, "utf-8")
      const lines = full.trimEnd().split("\n")
      stderr = lines.slice(-20).join("\n")
    }
    let stdout = ""
    if (fs.existsSync(stdoutFile)) {
      const full = fs.readFileSync(stdoutFile, "utf-8")
      const lines = full.trimEnd().split("\n")
      stdout = lines.slice(-20).join("\n")
    }
    if (exitCode !== 0) {
      crashInfo = { exitCode, stderr, stdout }
      // Persist crash info so it survives across refresh cycles
      fs.writeFileSync(crashFile, JSON.stringify(crashInfo), "utf-8")
    }
  }

  // Clean up transient process files (crash file persists)
  for (const f of [pidFile, exitFile, stderrFile, stdoutFile]) {
    try { fs.unlinkSync(f) } catch {}
  }

  return crashInfo
}

/** Clear any persisted crash info for a worktree (called when relaunching a service). */
function clearServiceCrash(worktree: string): void {
  const crashFile = crashFilePath(worktree)
  try { fs.unlinkSync(crashFile) } catch {}
}

/** Check if a service is running for a specific worktree */
export function isServiceRunning(worktree: string): boolean {
  return readPidFile(pidFilePath(worktree)) !== null
}

/** Get the running service info for a specific worktree, or null if not running */
export function getServiceForWorktree(worktree: string): { worktree: string; pid: number } | null {
  const pid = readPidFile(pidFilePath(worktree))
  if (pid === null) return null
  return { worktree, pid }
}

export async function runService(
  worktree: string,
  runDir: string,
  runCommand: string,
): Promise<void> {
  if (isServiceRunning(worktree)) {
    throw new Error(`Service already running for worktree ${worktree}. Kill it first (x).`)
  }

  clearServiceCrash(worktree)

  const tmpDir = ciaTmpDir()
  const pidFile = pidFilePath(worktree)
  const scriptPath = path.join(tmpDir, "run-service.sh")
  const windowTitle = `cia (${worktree})`
  // Resolve the run command relative to the CIA project root so that scripts
  // like ./vibe.sh are found even when cwd is the worktree's run dir.
  const resolvedCommand = runCommand.startsWith("./") || runCommand.startsWith("../")
    ? path.resolve(projectRoot(), runCommand)
    : runCommand
  const script = `#!/bin/bash
# CIA service runner for worktree: ${worktree}

# Set terminal window title
echo -ne "\\033]0;${windowTitle}\\007"

# Record PID so CIA can track this process
CIA_TMP=${JSON.stringify(tmpDir)}
echo $$ > ${JSON.stringify(pidFile)}

# Ensure we capture exit code even if killed by a signal
SERVICE_EXIT=1
cleanup() {
  echo $SERVICE_EXIT > "$CIA_TMP/$$.exit"
  # Give process substitution tees a moment to flush
  sleep 0.1
}
trap cleanup EXIT

# Run the service in the worktree's run directory
echo "CIA service runner:"
echo "  run dir:      ${JSON.stringify(runDir)}"
echo "  run command:  ${JSON.stringify(runCommand)} -> ${JSON.stringify(resolvedCommand)}"
echo "  cia root:     ${JSON.stringify(projectRoot())}"
echo "---"
cd ${JSON.stringify(runDir)} || { echo "ERROR: failed to cd to run dir"; exit 1; }
echo "  actual cwd:   $(pwd)"
echo ""
bash -c ${JSON.stringify(resolvedCommand)} > >(tee "$CIA_TMP/$$.stdout") 2> >(tee "$CIA_TMP/$$.stderr" >/dev/stderr)
SERVICE_EXIT=$?
`
  fs.writeFileSync(scriptPath, script, "utf-8")
  fs.chmodSync(scriptPath, 0o755)

  const preferred = getPreferredTerminal()
  try {
    if (preferred === "warp") {
      await launchWarp(scriptPath, runDir, windowTitle)
    } else if (preferred === "iterm") {
      launchITerm(scriptPath, windowTitle)
    } else {
      launchTerminal(scriptPath)
    }
  } catch (e) {
    // Fallback to Terminal.app if preferred terminal fails
    log(`Preferred terminal (${preferred}) failed, falling back to Terminal`, {
      error: (e as Error).message,
    })
    launchTerminal(scriptPath)
  }

  // Poll for the PID file (script writes it before exec)
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100))
    if (fs.existsSync(pidFile)) {
      const pid = Number.parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10)
      if (Number.isFinite(pid)) {
        log(`Service started for ${worktree}, pid=${pid}`)
        return
      }
    }
  }
  throw new Error("Failed to start service: PID file not created")
}

function launchTerminal(scriptPath: string, _windowTitle?: string): void {
  const osaScript = `tell application "Terminal" to do script "bash " & quoted form of ${JSON.stringify(scriptPath)}`
  spawn("osascript", ["-e", osaScript], { detached: true, stdio: "ignore" })
}

function launchITerm(scriptPath: string, windowTitle: string): void {
  const osaScript = `tell application "iTerm" to tell (create window with default profile command "bash " & quoted form of ${JSON.stringify(scriptPath)}) to tell current session of current tab to set name to ${JSON.stringify(windowTitle)}`
  spawn("osascript", ["-e", osaScript], { detached: true, stdio: "ignore" })
}

async function launchWarp(scriptPath: string, worktreeDir: string, windowTitle: string): Promise<void> {
  const warpConfigDir = path.join(os.homedir(), ".warp", "launch_configurations")
  if (!fs.existsSync(warpConfigDir)) {
    fs.mkdirSync(warpConfigDir, { recursive: true })
  }
  const configPath = path.join(warpConfigDir, "cia-run.yaml")
  const config = `---
name: cia-run
windows:
  - tabs:
      - title: ${JSON.stringify(windowTitle)}
        layout:
          cwd: ${JSON.stringify(worktreeDir)}
          commands:
            - exec: ${JSON.stringify(`exec bash ${scriptPath}`)}
`
  fs.writeFileSync(configPath, config, "utf-8")
  const url = "warp://launch/cia-run"
  spawn("open", [url], { detached: true, stdio: "ignore" })
}

/** Kill the running service for a specific worktree */
export async function killService(worktree: string): Promise<void> {
  const service = getServiceForWorktree(worktree)
  if (!service) {
    throw new Error(`No service is running for ${worktree}`)
  }
  try {
    process.kill(service.pid, "SIGTERM")
    log(`Sent SIGTERM to service pid=${service.pid} for ${worktree}`)
  } catch (e) {
    log(`Failed to kill process ${service.pid}`, { error: (e as Error).message })
    try {
      process.kill(service.pid, "SIGKILL")
    } catch {
      // Process may already be dead
    }
  }
  const pidFile = pidFilePath(worktree)
  if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile)
}
