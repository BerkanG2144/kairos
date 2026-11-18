import { clockStr } from '../domain/time.ts'
import { runInfo } from '../domain/tracker.ts'
import { Backup } from '../features/backup/Backup.tsx'
import { useAppState } from '../state/StoreProvider.tsx'
import { useNow } from '../state/useNow.ts'
import styles from './Header.module.css'
import { hrefOf, navigate, type Route } from './route.ts'

const TABS: { r: Route; label: string }[] = [
  { r: 'tracker', label: 'Tracker' },
  { r: 'statistik', label: 'Statistik' },
  { r: 'organisation', label: 'Organisation' },
]

/** Laufender Timer klein in der Kopfzeile (nur außerhalb des Trackers). */
function MiniTimer() {
  const state = useAppState()
  const info = runInfo(state)
  const now = useNow(!!info)
  const run = state.meta.run
  if (!info || !run) return null
  return (
    <button type="button" className={styles.mini} onClick={() => navigate('tracker')} title="Zum Tracker">
      <span className={styles.dot} style={{ background: info.color }} />
      <span>
        {clockStr(Math.max(0, now - run.t))} · {info.name}
      </span>
    </button>
  )
}

export function Header({ route }: { route: Route }) {
  return (
    <header className={`${styles.top} ${route === 'organisation' ? styles.wide : ''}`}>
      <nav className={styles.tabs}>
        {TABS.map(({ r, label }) => (
          <a
            key={r}
            href={hrefOf(r)}
            className={r === route ? styles.act : undefined}
            aria-current={r === route ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              navigate(r)
            }}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className={styles.right}>
        {route !== 'tracker' && <MiniTimer />}
        <Backup />
      </div>
    </header>
  )
}
