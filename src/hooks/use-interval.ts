import { useEffect, useRef } from "react"

export function useInterval(callback: () => void, ms: number) {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  }, [callback])
  useEffect(() => {
    const id = setInterval(() => saved.current(), ms)
    return () => clearInterval(id)
  }, [ms])
}
