import { cx } from '../../components/cx.ts'
import ui from '../../components/ui.module.css'
import { clockStr } from '../../domain/time.ts'
import { clickPause, runInfo, stop } from '../../domain/tracker.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import { useNow } from '../../state/useNow.ts'
import { ActPills } from './ActPills.tsx'
import styles from './TimerPanel.module.css'

export function TimerPanel({ className }: { className?: string }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const run = state.meta.run
  const info = runInfo(state)
  const now = useNow(!!run)
  const elapsed = run ? Math.max(0, now - run.t) : 0

  return (
    <section className={className}>
      <div className={styles.now}>
        {info && <span className={ui.dot} style={{ background: info.color }} />}
        <span className={ui.label}>{info?.name}</span>
        {info?.task && <span className={styles.task}>{info.task}</span>}
      </div>
      <div className={cx(styles.clock, !run && styles.idle, info?.isPause && styles.paused)} role="timer" aria-live="off">
        {clockStr(elapsed)}
      </div>
      <div className={styles.pills}>
        <ActPills />
      </div>
      <div className={styles.controls}>
        <button type="button" className={cx(ui.pill, styles.pause, info?.isPause && styles.pauseOn)} onClick={() => dispatch(clickPause)}>
          {info?.isPause ? 'Weiter' : 'Pause'}
        </button>
        {run && (
          <button type="button" className={cx(ui.pill, styles.stop)} onClick={() => dispatch(stop)}>
            <span className={styles.sq} />
            Stopp
          </button>
        )}
      </div>
    </section>
  )
}
