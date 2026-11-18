/**
 * Lane-Layout für überlappende Blöcke eines Tages (wie Kalender-Apps):
 * Einträge, die sich (transitiv) überlappen, bilden einen Cluster; innerhalb
 * bekommt jeder Eintrag die erste freie Spur. n = Spuren im Cluster → Breite 1/n.
 */
import { toMin } from './time.ts'
import type { PlanItem } from './types.ts'

/** Mindestdauer in Minuten (Raster). */
export const SNAP_MIN = 15

export type Placed = { it: PlanItem; s: number; e: number; lane: number; n: number }

export function layoutDay(items: PlanItem[]): Placed[] {
  const ev: Placed[] = items
    .map((it) => {
      const s = toMin(it.t) ?? 0
      return { it, s, e: Math.max(toMin(it.e) ?? 0, s + SNAP_MIN), lane: 0, n: 1 }
    })
    .sort((a, b) => a.s - b.s || b.e - a.e)

  let cluster: Placed[] = []
  let cEnd = -1
  const flush = () => {
    const n = Math.max(1, ...cluster.map((x) => x.lane + 1))
    for (const x of cluster) x.n = n
    cluster = []
  }
  for (const x of ev) {
    if (x.s >= cEnd && cluster.length) flush()
    const used = new Set(cluster.filter((y) => y.e > x.s).map((y) => y.lane))
    let l = 0
    while (used.has(l)) l++
    x.lane = l
    cluster.push(x)
    cEnd = Math.max(cEnd, x.e)
  }
  if (cluster.length) flush()
  return ev
}
