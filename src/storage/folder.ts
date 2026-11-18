/**
 * Schreibt Sicherungen in einen vom Nutzer gewählten Ordner (File System Access API,
 * Chrome/Edge am Desktop). Nur die Methoden, die wir brauchen – so lässt sich das
 * mit einem Fake-Ordner testen.
 */
import { CURRENT_FILE, dailyFile, filesToPrune } from '../domain/autosave.ts'

type Perm = 'granted' | 'denied' | 'prompt'

export interface FolderDir {
  readonly name: string
  getFileHandle(name: string, opts: { create: true }): Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>
  removeEntry(name: string): Promise<void>
  keys(): AsyncIterable<string>
  queryPermission(opts: { mode: 'readwrite' }): Promise<Perm>
  requestPermission(opts: { mode: 'readwrite' }): Promise<Perm>
}

type Picker = (opts: { id: string; mode: 'readwrite'; startIn: 'documents' }) => Promise<FolderDir>

const picker = (): Picker | undefined => (globalThis as { showDirectoryPicker?: Picker }).showDirectoryPicker

/** Firefox und Safari (auch iPhone) können das nicht. */
export const folderSupported = (): boolean => typeof picker() === 'function'

/** Ordnerauswahl; null bei Abbruch. Fragt dabei gleich nach Schreibrecht. */
export async function pickFolder(): Promise<FolderDir | null> {
  const pick = picker()
  if (!pick) return null
  try {
    return await pick({ id: 'kairos-sicherung', mode: 'readwrite', startIn: 'documents' })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    throw e
  }
}

async function writeFile(dir: FolderDir, name: string, text: string) {
  const fh = await dir.getFileHandle(name, { create: true })
  // createWritable schreibt in eine Temp-Datei und tauscht erst bei close() –
  // ein Absturz mittendrin hinterlässt nie eine halbe Datei.
  const w = await fh.createWritable()
  await w.write(text)
  await w.close()
}

/** Aktuellen Stand + Tageskopie schreiben, alte Tageskopien aufräumen. */
export async function writeFolderBackup(dir: FolderDir, json: string, now: Date): Promise<void> {
  await writeFile(dir, CURRENT_FILE, json)
  await writeFile(dir, dailyFile(now), json)
  const names: string[] = []
  for await (const n of dir.keys()) names.push(n)
  for (const n of filesToPrune(names)) await dir.removeEntry(n).catch(() => {})
}
