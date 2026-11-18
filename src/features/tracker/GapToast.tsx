import { Toast } from '../../components/Toast.tsx'
import { gapTexts } from '../../domain/gap.ts'
import { stopAt } from '../../domain/tracker.ts'
import { useAppState, useStore } from '../../state/StoreProvider.tsx'
import { useGapDetection } from '../../state/useGapDetection.ts'

/** „Seite war X Min. zu – der Timer lief weiter.“ – Behalten / Um HH:MM stoppen */
export function GapToast() {
  const store = useStore()
  const run = useAppState().meta.run
  const [gap, dismiss] = useGapDetection(store)
  // Wurde inzwischen gestartet/gestoppt, ist der Hinweis hinfällig.
  if (!gap || !run || run.t !== gap.runT) return null
  const { text, cut } = gapTexts(gap.cutAt, gap.detectedAt)
  return (
    <Toast
      primary={{ label: 'Behalten', onClick: dismiss }}
      secondary={{
        label: cut,
        onClick: () => {
          store.dispatch((s, n) => stopAt(s, gap.cutAt, n))
          dismiss()
        },
      }}
    >
      {text}
    </Toast>
  )
}
