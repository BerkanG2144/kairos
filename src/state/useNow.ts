import { useEffect, useState } from 'react'

const nowS = () => Math.floor(Date.now() / 1000)

/** Aktuelle Unix-Sekunde; aktualisiert alle `everyMs`, solange `active`. */
export function useNow(active = true, everyMs = 1000): number {
  const [now, setNow] = useState(nowS)
  useEffect(() => {
    if (!active) return
    setNow(nowS())
    const id = setInterval(() => setNow(nowS()), everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
  return now
}
