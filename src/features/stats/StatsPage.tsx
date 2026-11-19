import { useMemo, useState } from 'react'
import { cx } from '../../components/cx.ts'
import { Seg } from '../../components/Seg.tsx'
import ui from '../../components/ui.module.css'
import { byDay as computeByDay } from '../../domain/sessions.ts'
import { daysLabel, isRange, rangeStats, RANGES } from '../../domain/stats.ts'
import { pct } from '../../domain/summary.ts'
import { fmt } from '../../domain/time.ts'
import { useAppState } from '../../state/StoreProvider.tsx'
import { useNow } from '../../state/useNow.ts'
import { usePref } from '../../state/usePref.ts'
import { DayBalance } from '../tracker/DayBalance.tsx'
import styles from './Stats.module.css'

export function StatsPage() {
  const state = useAppState()
  const now = useNow(!!state.meta.run, 20_000)
  const [range, setRange] = usePref('lernzeit.range', '30', isRange)

  const byDay = useMemo(() => computeByDay(state, now), [state, now])
  const today = new Date(now * 1000)
  const acts = state.meta.acts
  const st = rangeStats(byDay, range, today, acts)
  // Tagesbilanz: gewählter Tag (beim Öffnen heute)
  const [sel, setSel] = useState(() => new Date(now * 1000))
  const top = st.items[0]?.v ?? 1

  return (
    <main className={styles.stats}>
      <div className={cx(ui.head, styles.head)}>
        <span className={ui.label}>Statistik</span>
        <Seg label="Zeitraum" options={RANGES.map(({ r, label }) => ({ value: r, label }))} value={range} onChange={setRange} />
      </div>

      {range === 'day' ? (
        <DayBalance className={styles.day} byDay={byDay} acts={acts} sel={sel} onSelect={setSel} />
      ) : (
        <>
          <div className={styles.kpis}>
            <div>
              <div className={styles.k} data-testid="kpi-total">
                {fmt(st.total)}
              </div>
              <div className={ui.label}>Lernzeit</div>
            </div>
            <div>
              <div className={styles.k} data-testid="kpi-days">
                {st.studyDays}
              </div>
              <div className={ui.label}>Lerntage</div>
            </div>
            <div>
              <div className={styles.k} data-testid="kpi-avg">
                {fmt(st.avg)}
              </div>
              <div className={ui.label}>Ø pro Lerntag</div>
            </div>
          </div>

          <div className={styles.rows}>
            {!st.items.length && <div className={ui.empty}>Noch keine Lernzeit in diesem Zeitraum.</div>}
            {st.items.map((it) => (
              <div key={it.id} className={styles.row}>
                <span className={styles.n}>
                  <span className={ui.dot} style={{ background: it.c }} />
                  <span>{it.name}</span>
                </span>
                <div className={styles.track}>
                  <i
                    style={{
                      width: `${((it.v / top) * 100).toFixed(1)}%`,
                      background: it.c,
                    }}
                  />
                </div>
                <span className={styles.v}>{fmt(it.v)}</span>
                <span className={styles.p}>{pct(it.v, st.total)}%</span>
                <span className={styles.d}>{daysLabel(it.days)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
