import { useEffect, useRef, useState } from 'react'
import { Toast } from '../../components/Toast.tsx'
import { importSummary, makeBackup, parseBackup, type ParsedBackup } from '../../domain/backup.ts'
import { useStore } from '../../state/StoreProvider.tsx'
import styles from './Backup.module.css'

/** Kurzes Feedback im Button-Text (wie Legacy „flash“). */
function useFlash(): [string | null, (t: string) => void] {
  const [text, setText] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return [
    text,
    (t) => {
      clearTimeout(timer.current)
      setText(t)
      timer.current = setTimeout(() => setText(null), 1800)
    },
  ]
}

function download(filename: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function Backup() {
  const store = useStore()
  const file = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [expFlash, flashExp] = useFlash()
  const [impFlash, flashImp] = useFlash()

  const onExport = () => {
    const { filename, json } = makeBackup(store.get(), new Date())
    download(filename, json)
    flashExp('Gespeichert')
  }

  const onFile = async () => {
    const f = file.current?.files?.[0]
    if (!f) return
    const r = parseBackup(await f.text(), Date.now())
    if (r.ok) setPending(r.backup)
    else flashImp(r.error)
  }

  const onConfirm = async () => {
    if (!pending) return
    const { state } = pending
    setPending(null)
    await store.replace(state)
    flashImp(store.status === 'ok' ? 'Importiert' : 'Fehler beim Speichern')
  }

  return (
    <>
      <span className={styles.bk}>
        <button type="button" className={expFlash ? styles.ok : undefined} title="Alle Daten als Datei sichern" onClick={onExport}>
          {expFlash ?? 'Backup'}
        </button>
        <button
          type="button"
          className={impFlash ? styles.ok : undefined}
          title="Backup-Datei laden"
          onClick={() => {
            if (file.current) file.current.value = ''
            file.current?.click()
          }}
        >
          {impFlash ?? 'Import'}
        </button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={onFile} data-testid="import-file" />
      </span>
      {pending && (
        <Toast primary={{ label: 'Importieren', onClick: onConfirm }} secondary={{ label: 'Abbrechen', onClick: () => setPending(null) }}>
          {importSummary(pending)}
        </Toast>
      )}
    </>
  )
}
