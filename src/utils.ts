import * as path from "node:path"
import * as os from "node:os"
import * as fs from "node:fs"

// Logging utility
export const LOG_FILE = path.join(os.tmpdir(), "agents-tui.log")
export function log(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const logLine = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`
  try {
    fs.appendFileSync(LOG_FILE, logLine)
  } catch (e) {
    // Silently fail if logging fails
    console.error("Failed to log to file", e)
  }
}

log(`Log file location: ${LOG_FILE}`)
