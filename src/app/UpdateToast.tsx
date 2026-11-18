import { useRegisterSW } from 'virtual:pwa-register/react'
import { Toast } from '../components/Toast.tsx'
import { useStore } from '../state/StoreProvider.tsx'

/** Hinweis, wenn eine neue App-Version bereitliegt (Service Worker wartet). */
export function UpdateToast() {
  const store = useStore()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Installierte App bleibt oft tagelang offen → stündlich nach Updates sehen.
      if (reg) setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })
  if (!needRefresh) return null
  return (
    <Toast
      primary={{
        label: 'Neu laden',
        onClick: async () => {
          // Ausstehende Schreibvorgänge erst abschließen, dann neu starten.
          await store.flush()
          await updateServiceWorker(true)
        },
      }}
      secondary={{ label: 'Später', onClick: () => setNeedRefresh(false) }}
    >
      Neue Version von Kairos verfügbar.
    </Toast>
  )
}
