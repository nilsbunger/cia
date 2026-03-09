import { useInput } from "ink"
import { useState, useRef, useCallback, useEffect } from "react"

export function useIdleSleep({ refresh, idleTimeoutMs }: { refresh: () => Promise<void>, idleTimeoutMs: number }) {
  const [sleeping, setSleeping] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setSleeping(true)
    }, idleTimeoutMs)
  }, [idleTimeoutMs])

  useInput(() => {
    if (sleeping) {
      setSleeping(false)
      refresh()
    }
    resetTimer()
  })

  useEffect(() => {
    resetTimer()
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [resetTimer])

  return { sleeping }
}
