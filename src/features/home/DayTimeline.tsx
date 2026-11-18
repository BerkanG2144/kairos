import { useLayoutEffect, useRef } from 'react'
import { layoutSpans, type Placed } from '../../domain/lanes.ts'
import { isTimed, itemColor } from '../../domain/plan.ts'
import { findTask } from '../../domain/tasks.ts'
import { pad, toMin } from '../../domain/time.ts'
import { trackedByDay, type Tracked } from '../../domain/tracked.ts'
import type { PlanItem, State } from '../../domain/types.ts'
import { H0, H1, minToPx, PX } from '../organisation/grid.ts'
import { Block, TrackedBlock } from '../organisation/WeekView.tsx'
import styles from './DayTimeline.module.css'

type Entry = { kind: 'plan'; it: PlanItem } | { kind: 'track'; t: Tracked }

/** Ein Tag als Kalender: geplante Einträge + getrackte Zeit (live), Jetzt-Linie. Nur Anzeige. */
export function DayTimeline({ state, day, items, now }: { state: State; day: string; items: PlanItem[]; now: number }) {
  const scroll = useRef<HTMLDivElement>(null)
  const acts = state.meta.acts
  const tracked = trackedByDay(state, [day], now)[day] ?? []
  const d = new Date(now * 1000)
  const nowMin = d.getHours() * 60 + d.getMinutes()
  const height = (H1 - H0) * PX

  // Beim Öffnen so scrollen, dass „jetzt“ im oberen Drittel steht.
  useLayoutEffect(() => {
    const sc = scroll.current
    if (sc) sc.scrollTop = Math.max(0, minToPx(nowMin) - sc.clientHeight / 3)
  }, []) // nur beim ersten Rendern

  const spans = layoutSpans<Entry>([
    ...items.filter(isTimed).map((it) => ({ v: { kind: 'plan' as const, it }, s: toMin(it.t) ?? 0, e: toMin(it.e) ?? 0 })),
    ...tracked.filter((t) => t.e > H0 * 60).map((t) => ({ v: { kind: 'track' as const, t }, s: t.s, e: t.e })),
  ])

  return (
    <div className={styles.scroll} ref={scroll} data-testid="day-timeline">
      <div className={styles.row}>
        <div className={styles.hours} style={{ height }}>
          {Array.from({ length: H1 - H0 - 1 }, (_, i) => H0 + 1 + i).map((h) => (
            <span key={h} style={{ top: (h - H0) * PX }}>
              {pad(h)}:00
            </span>
          ))}
        </div>
        <div className={styles.col} style={{ height, backgroundSize: `100% ${PX}px, 100% ${PX / 2}px` }}>
          {spans.map(({ v, ...pos }) => {
            if (v.kind === 'track') {
              const act = acts.find((a) => a.id === v.t.a)
              const name = (v.t.k && findTask(state, v.t.k)?.title) || act?.name || '—'
              return <TrackedBlock key={`trk-${v.t.start}-${v.t.s}`} t={v.t} lane={pos.lane} n={pos.n} name={name} color={act?.c ?? 'var(--mute)'} />
            }
            const x: Placed = { it: v.it, ...pos }
            return <Block key={x.it.id} x={x} color={itemColor(x.it, acts)} readOnly aria-label={`${x.it.title} ${x.it.t}–${x.it.e}`} />
          })}
          {nowMin >= H0 * 60 && <div className={styles.nowline} style={{ top: minToPx(nowMin) }} />}
        </div>
      </div>
    </div>
  )
}
