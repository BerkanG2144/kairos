import { useMemo } from 'react'
import { cx } from '../../components/cx.ts'
import { Seg } from '../../components/Seg.tsx'
import ui from '../../components/ui.module.css'
import { byDay as computeByDay } from '../../domain/sessions.ts'
import { daysLabel, hoursLabel, isRange, lastWeeks, rangeStats, RANGES, streaks } from '../../domain/stats.ts'
import { pct } from '../../domain/summary.ts'
import { fmt } from '../../domain/time.ts'
import { useAppState } from '../../state/StoreProvider.tsx'
import { useNow } from '../../state/useNow.ts'
import { usePref } from '../../state/usePref.ts'
import styles from './Stats.module.css'

export function StatsPage() {
  const state = useAppState()
  const now = useNow(!!state.meta.run, 20_000)
  const [range, setRange] = usePref('lernzeit.range', '30', isRange)

  const byDay = useMemo(() => computeByDay(state, now), [state, now])
  const today = new Date(now * 1000)
  const acts = state.meta.acts
  const st = rangeStats(byDay, range, today, acts)
  const { cur, best } = streaks(byDay, today)
  const { weeks, max: wmax } = lastWeeks(byDay, today, acts)
  const top = st.items[0]?.v ?? 1

  return (
    <main className={styles.stats}>
      <div className={cx(ui.head, styles.head)}>
        <span className={ui.label}>Statistik</span>
        <Seg label="Zeitraum" options={RANGES.map(({ r, label }) => ({ value: r, label }))} value={range} onChange={setRange} />
      </div>

      <div className={styles.kpis}>
        <div>
          <div className={styles.k} data-testid="kpi-total">{fmt(st.total)}</div>
          <div className={ui.label}>Lernzeit</div>
        </div>
        <div>
          <div className={styles.k} data-testid="kpi-days">{st.studyDays}</div>
          <div className={ui.label}>Lerntage</div>
        </div>
        <div>
          <div className={styles.k} data-testid="kpi-avg">{fmt(st.avg)}</div>
          <div className={ui.label}>Ø pro Lerntag</div>
        </div>
        <div>
          <div className={styles.k} data-testid="kpi-streak">{daysLabel(cur)}</div>
          <div className={ui.label}>
            Serie {best > 0 && <span className={styles.best}>· Rekord {best}</span>}
          </div>
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
              <i style={{ width: `${((it.v / top) * 100).toFixed(1)}%`, background: it.c }} />
            </div>
            <span className={styles.v}>{fmt(it.v)}</span>
            <span className={styles.p}>{pct(it.v, st.total)}%</span>
            <span className={styles.d}>{daysLabel(it.days)}</span>
          </div>
        ))}
      </div>

      <div className={cx(ui.head, styles.weeksHead)}>
        <span className={ui.label}>Letzte 12 Wochen</span>
      </div>
      <div className={styles.weeks}>
        {weeks.map((w) => (
          <div key={w.kw + '-' + w.monday.getTime()} className={cx(styles.wcol, w.current && styles.cur)} title={`KW ${w.kw}: ${fmt(w.total)}`}>
            <span className={styles.wt}>{hoursLabel(w.total)}</span>
            <div className={cx(styles.wstack, !w.total && styles.wempty)}>
              {w.segs
                .slice()
                .reverse()
                .map((s) => (
                  <span key={s.id} style={{ height: `${((s.v / wmax) * 100).toFixed(2)}%`, background: s.c }} />
                ))}
            </div>
            <span className={styles.wl}>{w.kw}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
