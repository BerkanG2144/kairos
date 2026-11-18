import { GAP_MS } from './constants.ts'
import { fmt, hhmm } from './time.ts'
import type { Run } from './types.ts'

/**
 * Lücken-Erkennung: Lief ein Timer, während die Seite > GAP_MS kein Lebenszeichen
 * gab (geschlossen, Rechner im Schlaf), liefert sie den Zeitpunkt (s) des letzten
 * Lebenszeichens – dorthin kann rückwirkend gestoppt werden. Sonst null.
 */
export function detectGap(run: Run | null, lastSeenMs: number | null, nowMs: number): number | null {
  if (!run || !lastSeenMs) return null
  if (nowMs - lastSeenMs <= GAP_MS) return null
  const cutAt = Math.floor(lastSeenMs / 1000)
  return cutAt > run.t ? cutAt : null
}

/** Texte für den Lücken-Toast. */
export function gapTexts(cutAt: number, nowS: number): { text: string; cut: string } {
  const mins = Math.round((nowS - cutAt) / 60)
  const dur = mins >= 60 ? fmt(mins * 60) : `${mins} Min.`
  return {
    text: `Seite war ${dur} zu – der Timer lief weiter.`,
    cut: `Um ${hhmm(cutAt)} stoppen`,
  }
}

