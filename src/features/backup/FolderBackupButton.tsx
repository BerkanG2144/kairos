import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import { Modal } from '../../components/Modal.tsx'
import { CURRENT_FILE, KEEP_DAYS } from '../../domain/autosave.ts'
import { dayKey, hhmm } from '../../domain/time.ts'
import type { FolderStatus } from '../../state/folderBackup.ts'
import { useFolderBackup } from '../../state/FolderBackupContext.tsx'
import styles from './FolderBackup.module.css'

function savedText(ms: number | null): string {
  if (ms == null) return 'noch nicht'
  const d = new Date(ms)
  const time = hhmm(ms / 1000)
  return dayKey(d) === dayKey(new Date()) ? `heute ${time}` : `${d.toLocaleDateString('de-DE')} ${time}`
}

/** Status der Ordner-Sicherung in der Kopfzeile + Einstellungsdialog. */
export function FolderBackupButton() {
  const [st, fb] = useFolderBackup()
  const [open, setOpen] = useState(false)
  if (st.kind === 'unsupported' || st.kind === 'loading') return null

  // Pausiert: Klick holt die Erlaubnis direkt zurück (Browser verlangt dafür einen Klick).
  if (st.kind === 'paused')
    return (
      <button type="button" className={cx(styles.status, styles.warn)} title={`Sicherung in »${st.folder}« fortsetzen`} onClick={() => void fb.resume()}>
        <span className={styles.dot} />
        Sicherung fortsetzen
      </button>
    )

  const label = st.kind === 'off' ? 'Auto-Sicherung' : st.error ? 'Sicherung: Fehler' : 'Gesichert'
  const title =
    st.kind === 'off' ? 'Automatisch in einen Ordner sichern' : st.error ?? `In »${st.folder}« gesichert: ${savedText(st.savedAt)}`
  return (
    <>
      <button
        type="button"
        className={cx(styles.status, st.kind === 'active' && (st.error ? styles.err : styles.on))}
        title={title}
        onClick={() => setOpen(true)}
      >
        {st.kind === 'active' && <span className={styles.dot} />}
        {label}
      </button>
      {open && <Settings st={st} onClose={() => setOpen(false)} />}
    </>
  )
}

function Settings({ st, onClose }: { st: Exclude<FolderStatus, { kind: 'unsupported' | 'loading' | 'paused' }>; onClose: () => void }) {
  const [, fb] = useFolderBackup()
  return (
    <Modal label="Ordner-Sicherung" onClose={onClose}>
      <div className={styles.box}>
        <div className={styles.head}>Ordner-Sicherung</div>
        <p>
          Kairos legt nach jeder Änderung automatisch eine Kopie in einem Ordner auf deinem Rechner ab – zusätzlich zum Speicher im
          Browser. Gehen die Browserdaten verloren, holst du alles über „Import“ zurück.
        </p>
        <ul className={styles.files}>
          <li>
            <code>{CURRENT_FILE}</code> – immer der neueste Stand
          </li>
          <li>
            <code>kairos-JJJJ-MM-TT.json</code> – je Tag eine Kopie, die letzten {KEEP_DAYS} Tage
          </li>
        </ul>

        {st.kind === 'off' ? (
          <p className={styles.hint}>
            Am besten einen eigenen Ordner anlegen, z. B. <code>Dokumente/Kairos</code> (den Dokumente-Ordner selbst erlaubt Chrome
            nicht). Liegt er in Nextcloud, Dropbox o. Ä., ist die Sicherung gleich auch in der Cloud.
          </p>
        ) : (
          <dl className={styles.facts}>
            <dt>Ordner</dt>
            <dd data-testid="backup-folder">{st.folder}</dd>
            <dt>Zuletzt</dt>
            <dd data-testid="backup-saved">{savedText(st.savedAt)}</dd>
            {st.error && (
              <>
                <dt>Problem</dt>
                <dd className={styles.errText}>{st.error}</dd>
              </>
            )}
          </dl>
        )}
        {st.kind === 'active' && (
          <p className={styles.hint}>
            Fragt Chrome nach einem Neustart, ob Kairos den Ordner weiter bearbeiten darf: „Bei jedem Besuch erlauben“ wählen – danach
            läuft es dauerhaft ohne Rückfrage.
          </p>
        )}

        <div className={styles.acts}>
          {st.kind === 'active' && (
            <button type="button" className={cx(styles.btn, styles.dang)} onClick={() => void fb.disable().then(onClose)}>
              Ausschalten
            </button>
          )}
          <span className={styles.sp} />
          {st.kind === 'active' && (
            <>
              <button type="button" className={styles.btn} onClick={() => void fb.enable()}>
                Ordner ändern
              </button>
              <button type="button" className={cx(styles.btn, styles.pri)} onClick={() => void fb.saveNow()}>
                Jetzt sichern
              </button>
            </>
          )}
          {st.kind === 'off' && (
            <>
              <button type="button" className={styles.btn} onClick={onClose}>
                Abbrechen
              </button>
              <button type="button" className={cx(styles.btn, styles.pri)} onClick={() => void fb.enable()}>
                Ordner wählen
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
