import { useMemo, useState } from 'react'
import { byDay as computeByDay } from '../../domain/sessions.ts'
import { useAppState } from '../../state/StoreProvider.tsx'
import { useNow } from '../../state/useNow.ts'
import { MonthCalendar } from './MonthCalendar.tsx'
import { TimerPanel } from './TimerPanel.tsx'
import styles from './Tracker.module.css'

/** Timer und Monatskalender (Lerntage als Heatmap). Tages-/Zeitraum-Auswertungen stehen in der Statistik. */
export function TrackerPage() {
  const state = useAppState()
  // Kalender bei laufendem Timer alle 20 s aktualisieren.
  const now = useNow(!!state.meta.run, 20_000)
  const byDay = useMemo(() => computeByDay(state, now), [state, now])
  const [view, setView] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))

  return (
    <main className={styles.wrap}>
      <TimerPanel className={styles.timer} />
      <aside className={styles.cal}>
        <MonthCalendar byDay={byDay} view={view} onView={setView} />
      </aside>
    </main>
  )
}
