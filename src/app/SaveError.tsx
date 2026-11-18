import { useSaveStatus } from '../state/StoreProvider.tsx'
import styles from './SaveError.module.css'

/** Kleiner Punkt unten rechts, nur wenn Speichern fehlschlägt (oder nur flüchtig gespeichert wird). */
export function SaveError({ volatile }: { volatile: boolean }) {
  const status = useSaveStatus()
  if (status === 'ok' && !volatile) return null
  const title = volatile
    ? 'Speicher nicht verfügbar – Daten gehen beim Schließen verloren. Bitte Backup machen.'
    : 'Speichern fehlgeschlagen – bitte Backup machen.'
  return <div className={styles.dot} title={title} role="status" aria-label={title} />
}
