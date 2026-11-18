import { useState } from 'react'

/** Kleine UI-Einstellung in localStorage (pro Gerät), mit Validierung. */
export function usePref<T extends string>(key: string, fallback: T, valid: (x: unknown) => x is T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key)
      return valid(v) ? v : fallback
    } catch {
      return fallback
    }
  })
  return [
    value,
    (v) => {
      setValue(v)
      try {
        localStorage.setItem(key, v)
      } catch {
        /* egal */
      }
    },
  ]
}
