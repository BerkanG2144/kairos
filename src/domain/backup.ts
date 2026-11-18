/**
 * Backup-Datei: { app: 'lernzeit', format: 1, exportedAt: ISO, data: State }.
 * Zusätzlich `schema` (unsere Schema-Version) – die Legacy-Datei ignoriert das Feld.
 * Import akzeptiert auch ein nacktes State-Objekt.
 */
import { MONTHS_SHORT } from './constants.ts'
import { migrate, SCHEMA_VERSION } from './migrate.ts'
import { normalizeState } from './normalize.ts'
import { dayKey, pad } from './time.ts'
import type { State } from './types.ts'

export type BackupFile = {
  app: 'lernzeit'
  format: 1
  schema: number
  exportedAt: string
  data: State
}

export function makeBackup(s: State, now: Date): { filename: string; json: string } {
  const file: BackupFile = { app: 'lernzeit', format: 1, schema: SCHEMA_VERSION, exportedAt: now.toISOString(), data: s }
  return {
    filename: `kairos-backup-${dayKey(now)}_${pad(now.getHours())}${pad(now.getMinutes())}.json`,
    json: JSON.stringify(file, null, 1),
  }
}

export type ParsedBackup = {
  state: State
  exportedAt: Date | null
  /** aktive Fächer */
  acts: number
  sessions: number
  items: number
  tasks: number
  /** verworfene, unbrauchbare Einzeleinträge */
  skipped: number
}

export type ParseResult = { ok: true; backup: ParsedBackup } | { ok: false; error: string }

export function parseBackup(text: string, nowMs: number): ParseResult {
  let o: unknown
  try {
    o = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Ungültige Datei' }
  }
  const env = typeof o === 'object' && o !== null ? (o as Record<string, unknown>) : null
  const wrapped = env != null && 'data' in env && env.data != null
  const raw = wrapped ? env.data : o
  const n = normalizeState(raw)
  if (!n) return { ok: false, error: 'Ungültige Datei' }

  const schema = wrapped && typeof env.schema === 'number' ? env.schema : 1
  if (schema > SCHEMA_VERSION) return { ok: false, error: 'Backup ist neuer als die App' }
  const state = migrate(n.state, schema, nowMs)

  let exportedAt: Date | null = null
  if (wrapped && typeof env.exportedAt === 'string') {
    const d = new Date(env.exportedAt)
    if (!Number.isNaN(d.getTime())) exportedAt = d
  }

  let sessions = 0
  let items = 0
  let tasks = 0
  for (const k in state.months) {
    sessions += state.months[k]!.s.length
    items += state.months[k]!.p?.length ?? 0
    tasks += state.months[k]!.k?.length ?? 0
  }
  return {
    ok: true,
    backup: {
      state,
      exportedAt,
      acts: state.meta.acts.filter((a) => !a.del).length,
      sessions,
      items,
      tasks,
      skipped: n.skipped,
    },
  }
}

/** Text für die Bestätigungsleiste (wie Legacy). */
export function importSummary(b: ParsedBackup): string {
  const w = b.exportedAt
  const when = w ? ` vom ${w.getDate()}. ${MONTHS_SHORT[w.getMonth()]} ${pad(w.getHours())}:${pad(w.getMinutes())}` : ''
  const skipped = b.skipped ? ` (${b.skipped} unlesbare Einträge übersprungen)` : ''
  const tasks = b.tasks ? `, ${b.tasks} Tasks` : ''
  return `Backup${when} laden? ${b.acts} Fächer, ${b.sessions} Einträge${tasks}${skipped} – ersetzt die aktuellen Daten.`
}
