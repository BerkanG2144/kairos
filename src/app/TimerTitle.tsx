import { useEffect } from 'react'
import { clockStr } from '../domain/time.ts'
import { runInfo } from '../domain/tracker.ts'
import { useAppState } from '../state/StoreProvider.tsx'
import { useNow } from '../state/useNow.ts'

/** Tab-Titel: „00:12:34 · Mathe“ bzw. „Lernzeit“. */
export function TimerTitle() {
  const state = useAppState()
  const run = state.meta.run
  const info = runInfo(state)
  const now = useNow(!!run)
  const title = run && info ? `${clockStr(Math.max(0, now - run.t))} · ${info.name}` : 'Lernzeit'
  useEffect(() => {
    document.title = title
  }, [title])
  return null
}
