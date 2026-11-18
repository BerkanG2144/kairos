import { useEffect, useState } from 'react'

/** Aktuelle Unix-Sekunde; tickt jede Sekunde, solange `active`. */
export function useNow(active = true): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    if (!active) return
    setNow(Math.floor(Date.now() / 1000))
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}
