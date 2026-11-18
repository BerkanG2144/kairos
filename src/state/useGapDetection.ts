import { useEffect, useRef, useState } from 'react'
import { GAP_MS } from '../domain/constants.ts'
import { detectGap } from '../domain/gap.ts'
import type { Store } from './store.ts'

const LS_SEEN = 'lernzeit.seen'
const BEAT_MS = 5000

function readSeen(): number | null {
  try {
    return Number(localStorage.getItem(LS_SEEN)) || null
  } catch {
    return null
  }
}
function markSeen() {
  try {
    localStorage.setItem(LS_SEEN, String(Date.now()))
  } catch {
    /* privat/gesperrt: dann eben keine Lücken-Erkennung über Neuladen hinweg */
  }
}

export type Gap = { cutAt: number; detectedAt: number; runT: number }

/**
 * Lebenszeichen alle 5 s sowie bei pagehide/visibilitychange. Erkennt eine Lücke
 * > 5 min (Seite zu, Rechner im Schlaf) bei laufendem Timer – beim Laden und im Betrieb.
 */
export function useGapDetection(store: Store): [Gap | null, () => void] {
  // Beim ersten Render lesen – vor jedem Effekt, der das Lebenszeichen überschreibt.
  const [gap, setGap] = useState<Gap | null>(() => {
    const run = store.get().meta.run
    const cutAt = detectGap(run, readSeen(), Date.now())
    return cutAt && run ? { cutAt, detectedAt: Math.floor(Date.now() / 1000), runT: run.t } : null
  })
  const gapRef = useRef(gap)
  gapRef.current = gap

  useEffect(() => {
    markSeen()
    let lastTick = Date.now()
    let ticks = 0
    const id = setInterval(() => {
      const n = Date.now()
      const run = store.get().meta.run
      if (n - lastTick > GAP_MS && !gapRef.current) {
        const cutAt = detectGap(run, lastTick, n)
        if (cutAt && run) setGap({ cutAt, detectedAt: Math.floor(n / 1000), runT: run.t })
      }
      lastTick = n
      if (++ticks % (BEAT_MS / 1000) === 0) markSeen()
    }, 1000)
    const onVis = () => {
      if (document.hidden) markSeen()
    }
    addEventListener('pagehide', markSeen)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      removeEventListener('pagehide', markSeen)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [store])

  return [gap, () => setGap(null)]
}
