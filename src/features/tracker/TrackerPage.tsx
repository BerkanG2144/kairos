import { TimerPanel } from './TimerPanel.tsx'
import styles from './Tracker.module.css'

/** Nur der Timer, mittig. Tages-/Zeitraum-Auswertungen stehen in der Statistik. */
export function TrackerPage() {
  return (
    <main className={styles.wrap}>
      <TimerPanel className={styles.timer} />
    </main>
  )
}
