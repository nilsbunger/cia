import * as fs from "node:fs"
import * as path from "node:path"
import { getCiaTempDir } from "./config"

// Logging utility
export function getLogFile(): string {
  return path.join(getCiaTempDir(), "agents-tui.log")
}

export const LOG_FILE = getLogFile()

export function log(message: string, data?: unknown) {
  const logFile = getLogFile()
  const timestamp = new Date().toISOString()
  const logLine = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`
  try {
    fs.appendFileSync(logFile, logLine)
  } catch (e) {
    // Silently fail if logging fails
    console.error("Failed to log to file", e)
  }
}

log(`Log file location: ${getLogFile()}`)
