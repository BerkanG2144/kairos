import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { cx, vars } from '../../components/cx.ts'
import { layoutDay, type Placed } from '../../domain/lanes.ts'
import { isTimed, itemColor, sortItems } from '../../domain/plan.ts'
import { WEEKDAYS_SHORT } from '../../domain/summary.ts'
import { addDays, dayKey, pad } from '../../domain/time.ts'
import type { Act, PlanItem } from '../../domain/types.ts'
import { Chip } from './Chip.tsx'
import { H0, H1, minToPx, PX } from './grid.ts'
import type { OrgActions } from './types.ts'
import styles from './WeekView.module.css'

type Props = {
  monday: Date
  plan: Record<string, PlanItem[]>
  acts: Act[]
  actions: OrgActions
  /** aktuelle Zeit (s) – für Jetzt-Linie und „heute“ */
  now: number
  /** optionale Interaktion auf dem Raster (Drag & Drop), siehe useBlockDrag */
  colProps?: (day: string) => HTMLAttributes<HTMLDivElement>
  blockProps?: (x: Placed) => HTMLAttributes<HTMLDivElement>
  overlay?: (day: string) => ReactNode
}

export function Block({ x, color, children, ...rest }: { x: Placed; color: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const top = Math.max(0, minToPx(x.s))
  const h = Math.max(18, ((x.e - Math.max(x.s, H0 * 60)) / 60) * PX - 2)
  const w = 100 / x.n
  return (
    <div
      className={cx(styles.blk, x.it.type === 'termin' && styles.ter)}
      data-item={x.it.id}
      style={{ ...vars({ '--c': color }), top, height: h, left: `calc(${w * x.lane}% + 2px)`, width: `calc(${w}% - 4px)` }}
      {...rest}
    >
      <b>{x.it.title}</b>
      <span>
        {x.it.t}–{x.it.e}
      </span>
      {children}
    </div>
  )
}

export function WeekView({ monday, plan, acts, actions, now, colProps, blockProps, overlay }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const nowD = new Date(now * 1000)
  const tk = dayKey(nowD)
  const owk = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const weekKey = dayKey(monday)
  const inWeek = days.some((d) => dayKey(d) === tk)

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
                  {...colProps?.(k)}
                >
                  {layoutDay((plan[k] ?? []).filter(isTimed)).map((x) => (
                    <Block
                      key={x.it.id}
                      x={x}
                      color={itemColor(x.it, acts)}
                      onClick={blockProps ? undefined : () => actions.open(x.it)}
                      {...blockProps?.(x)}
                    />
                  ))}
                  {k === tk && nowMin >= H0 * 60 && <div className={styles.nowline} style={{ top: minToPx(nowMin) }} />}
                  {overlay?.(k)}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
