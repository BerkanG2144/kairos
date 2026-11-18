import { useLayoutEffect, useRef, type HTMLAttributes } from 'react'
import { cx, vars } from '../../components/cx.ts'
import { layoutSpans, type Placed } from '../../domain/lanes.ts'
import { isTimed, itemColor, sortItems } from '../../domain/plan.ts'
import { WEEKDAYS_SHORT } from '../../domain/summary.ts'
import { addDays, dayKey, fromMin, pad, toMin } from '../../domain/time.ts'
import type { Tracked } from '../../domain/tracked.ts'
import type { Act, PlanItem } from '../../domain/types.ts'
import { Chip } from './Chip.tsx'
import { H0, H1, minToPx, PX } from './grid.ts'
import type { OrgActions } from './types.ts'
import { useBlockDrag } from './useBlockDrag.tsx'
import styles from './WeekView.module.css'

type Props = {
  monday: Date
  plan: Record<string, PlanItem[]>
  acts: Act[]
  actions: OrgActions
  /** aktuelle Zeit (s) – für Jetzt-Linie und „heute“ */
  now: number
  /** getrackte Zeit je Tag (aus dem Tracker) */
  tracked: Record<string, Tracked[]>
  /** Titel eines Tasks (für getrackte Blöcke mit Task) */
  taskTitle: (id: string) => string | undefined
}

/** Geplante Einträge und getrackte Zeit teilen sich die Spuren eines Tages. */
type Entry = { kind: 'plan'; it: PlanItem } | { kind: 'track'; t: Tracked }

const clock = (m: number) => (m >= 1440 ? '24:00' : fromMin(Math.floor(m)))

/** Getrackte Zeit: schraffiert in der Fachfarbe, wächst live mit, solange der Timer läuft. */
export function TrackedBlock({ t, lane, n, name, color }: { t: Tracked; lane: number; n: number; name: string; color: string }) {
  const top = Math.max(0, minToPx(t.s))
  const h = Math.max(14, ((t.e - Math.max(t.s, H0 * 60)) / 60) * PX - 2)
  const w = 100 / n
  const time = `${clock(t.s)}–${t.live ? 'jetzt' : clock(t.e)}`
  return (
    <div
      className={cx(styles.trk, t.live && styles.live)}
      style={{ ...vars({ '--c': color }), top, height: h, left: `calc(${w * lane}% + 2px)`, width: `calc(${w}% - 4px)` }}
      title={`Getrackt: ${name} · ${time}`}
      aria-label={`Getrackt: ${name} ${time}`}
      data-tracked={t.live ? 'live' : 'done'}
    >
      <b>{name}</b>
      <span>{time}</span>
    </div>
  )
}

export function Block({
  x,
  color,
  dragging,
  readOnly,
  ...rest
}: { x: Placed; color: string; dragging?: boolean; readOnly?: boolean } & HTMLAttributes<HTMLDivElement>) {
  const top = Math.max(0, minToPx(x.s))
  const h = Math.max(18, ((x.e - Math.max(x.s, H0 * 60)) / 60) * PX - 2)
  const w = 100 / x.n
  return (
    <div
      className={cx(styles.blk, x.it.type === 'termin' && styles.ter, dragging && styles.drag, readOnly && styles.ro)}
      data-item={x.it.id}
      style={{ ...vars({ '--c': color }), top, height: h, left: `calc(${w * x.lane}% + 2px)`, width: `calc(${w}% - 4px)` }}
      {...rest}
    >
      <b>{x.it.title}</b>
      <span>
        {x.it.t}–{x.it.e}
      </span>
      {!readOnly && <i className={styles.rs} data-resize aria-hidden="true" />}
    </div>
  )
}

function Preview({ p, acts }: { p: ReturnType<ReturnType<typeof useBlockDrag>['preview']>; acts: Act[] }) {
  if (!p) return null
  if (p.kind === 'block') return <Block x={p.x} color={itemColor(p.x.it, acts)} dragging />
  return (
    <div className={styles.ghost} style={{ top: minToPx(p.s), height: Math.max(18, ((p.e - p.s) / 60) * PX - 2) }} data-testid="drag-ghost">
      {fromMin(p.s)}–{fromMin(p.e)}
    </div>
  )
}

export function WeekView({ monday, plan, acts, actions, now, tracked, taskTitle }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const nowD = new Date(now * 1000)
  const tk = dayKey(nowD)
  const owk = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const weekKey = dayKey(monday)
  const inWeek = days.some((d) => dayKey(d) === tk)
  const drag = useBlockDrag(owk, actions)

  // Spalten von Kopf und Fällig-Zeile an die Scrollbar des Rasters angleichen.
  useLayoutEffect(() => {
    const sc = scroll.current
    if (sc && owk.current) owk.current.style.setProperty('--sbw', `${sc.offsetWidth - sc.clientWidth}px`)
  })

  // Beim Öffnen bzw. Wochenwechsel zur aktuellen Uhrzeit (sonst 08:00) scrollen.
  useLayoutEffect(() => {
    const sc = scroll.current
    if (!sc) return
    const n = new Date()
    sc.scrollTop = inWeek ? Math.max(0, (n.getHours() - 1.5 - H0) * PX) : (8 - H0) * PX
  }, [weekKey]) // nur bei Wochenwechsel, nicht bei jedem Tick

  const nowMin = nowD.getHours() * 60 + nowD.getMinutes()
  const height = (H1 - H0) * PX

  return (
    <div className={styles.wkwrap}>
      <div className={styles.owk} ref={owk}>
        <div className={cx(styles.row, styles.padded)}>
          <div />
          {days.map((d) => {
            const k = dayKey(d)
            const we = d.getDay() === 0 || d.getDay() === 6
            return (
              <button
                key={k}
                type="button"
                className={cx(styles.dh, k === tk && styles.today, we && styles.we)}
                title="Abgabe hinzufügen"
                onClick={() => actions.create(k, 'abgabe')}
                data-day={k}
              >
                {WEEKDAYS_SHORT[d.getDay()]}
                <b>{d.getDate()}</b>
              </button>
            )
          })}
        </div>
        <div className={cx(styles.row, styles.padded, styles.allday)}>
          <div className={styles.g}>fällig</div>
          {days.map((d) => {
            const k = dayKey(d)
            return (
              <div key={k} className={styles.ad} data-allday={k}>
                {sortItems(plan[k] ?? [])
                  .filter((it) => !isTimed(it))
                  .map((it) => (
                    <Chip key={it.id} it={it} acts={acts} actions={actions} withTime />
                  ))}
              </div>
            )
          })}
        </div>
        <div className={styles.wkscroll} ref={scroll} data-testid="week-scroll">
          <div className={styles.row}>
            <div className={styles.hours} style={{ height }}>
              {Array.from({ length: H1 - H0 - 1 }, (_, i) => H0 + 1 + i).map((h) => (
                <span key={h} style={{ top: (h - H0) * PX }}>
                  {pad(h)}:00
                </span>
              ))}
            </div>
            {days.map((d) => {
              const k = dayKey(d)
              const we = d.getDay() === 0 || d.getDay() === 6
              return (
                <div
                  key={k}
                  className={cx(styles.col, k === tk && styles.colToday, we && styles.colWe)}
                  style={{ ...vars({ '--ph': `${PX}px` }), height }}
                  data-col={k}
                  {...drag.colProps(k)}
                >
                  {layoutSpans<Entry>([
                    ...(plan[k] ?? [])
                      .filter((it) => isTimed(it) && it.id !== drag.hiddenId)
                      .map((it) => ({ v: { kind: 'plan' as const, it }, s: toMin(it.t) ?? 0, e: toMin(it.e) ?? 0 })),
                    ...(tracked[k] ?? []).filter((t) => t.e > H0 * 60).map((t) => ({ v: { kind: 'track' as const, t }, s: t.s, e: t.e })),
                  ]).map(({ v, ...pos }) => {
                    if (v.kind === 'track') {
                      const act = acts.find((a) => a.id === v.t.a)
                      const name = (v.t.k && taskTitle(v.t.k)) || act?.name || '—'
                      return <TrackedBlock key={`trk-${v.t.start}-${v.t.s}`} t={v.t} lane={pos.lane} n={pos.n} name={name} color={act?.c ?? 'var(--mute)'} />
                    }
                    const x: Placed = { it: v.it, ...pos }
                    return (
                      <Block
                        key={x.it.id}
                        x={x}
                        color={itemColor(x.it, acts)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${x.it.title} ${x.it.t}–${x.it.e}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') actions.open(x.it)
                        }}
                      />
                    )
                  })}
                  {k === tk && nowMin >= H0 * 60 && <div className={styles.nowline} style={{ top: minToPx(nowMin) }} />}
                  <Preview p={drag.preview(k)} acts={acts} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
