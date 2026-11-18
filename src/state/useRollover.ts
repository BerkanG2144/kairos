import { useEffect } from 'react'
import { rollover } from '../domain/tasks.ts'
import { dayKey } from '../domain/time.ts'
import { useStore } from './StoreProvider.tsx'

/** Offene Tasks vergangener Tage nach heute holen – beim Start, jede Minute und beim Zurückkehren zur App. */
export function useRollover() {
  const store = useStore()
  useEffect(() => {
    const run = () => store.dispatch((s, n) => rollover(s, dayKey(new Date(n)), n))
    run()
    const id = setInterval(run, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [store])
}
