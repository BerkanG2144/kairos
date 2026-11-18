import { useMemo, useState } from 'react'
import { byDay as computeByDay } from '../../domain/sessions.ts'
import { addDays, mondayOf, startOfDay } from '../../domain/time.ts'
import { useAppState } from '../../state/StoreProvider.tsx'
import { useNow } from '../../state/useNow.ts'
import { DayBalance } from './DayBalance.tsx'
import { MonthCalendar } from './MonthCalendar.tsx'
import { TimerPanel } from './TimerPanel.tsx'
import styles from './Tracker.module.css'
import { WeekSummary } from './WeekSummary.tsx'

/** Monat, in dem der Donnerstag der Woche liegt (wie Legacy). */
const viewOfWeek = (monday: Date) => {
  const th = addDays(monday, 3)
  return { y: th.getFullYear(), m: th.getMonth() }
}

export function TrackerPage() {
  const state = useAppState()
  // Statistiken bei laufendem Timer alle 20 s aktualisieren (wie Legacy).
  const now = useNow(!!state.meta.run, 20_000)
  const byDay = useMemo(() => computeByDay(state, now), [state, now])
  const acts = state.meta.acts

  const [sel, setSel] = useState(() => startOfDay(new Date()))
  const [week, setWeek] = useState(() => mondayOf(new Date()))
  const [view, setView] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))

  const selectDay = (d: Date) => {
    const s = startOfDay(d)
    setSel(s)
    setWeek(mondayOf(s))
    setView({ y: s.getFullYear(), m: s.getMonth() })
  }

  const pickInCalendar = (d: Date) => {
    setSel(startOfDay(d))
    setWeek(mondayOf(d))
  }

  const shiftWeek = (delta: number | null) => {
    const w = delta == null ? mondayOf(new Date()) : addDays(week, delta)
    setWeek(w)
    setView(viewOfWeek(w))
  }

  return (
    <main className={styles.wrap}>
      <TimerPanel className={styles.timer} />
      <DayBalance className={styles.dayArea} byDay={byDay} acts={acts} sel={sel} onSelect={selectDay} />
      <aside className={styles.cal}>
        <MonthCalendar byDay={byDay} view={view} onView={setView} sel={sel} week={week} onPick={pickInCalendar} />
        <WeekSummary byDay={byDay} acts={acts} week={week} onWeek={shiftWeek} />
      </aside>
    </main>
  )
}
