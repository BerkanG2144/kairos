/** Datums- und Formatierungs-Hilfen. Alle Tagesgrenzen in lokaler Zeitzone. */

export const pad = (n: number): string => String(n).padStart(2, '0')

export const nowSec = (): number => Math.floor(Date.now() / 1000)

/** Lokaler Tagesbeginn. */
export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Kalendertage addieren (DST-sicher, da über Datumsteile statt Millisekunden). */
export const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** 'YYYY-MM-DD' */
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 'YYYY-MM-DD' → lokales Datum 00:00 */
export function parseDayKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** Monats-Schlüssel 'YYYY-MM' eines Zeitpunkts (Sekunden). */
export const monthKeyOfSec = (sec: number): string => {
  const d = new Date(sec * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** Monats-Schlüssel 'YYYY-MM' aus 'YYYY-MM-DD'. */
export const monthKeyOfDay = (day: string): string => day.slice(0, 7)

/** Montag der Woche (lokal, 00:00). */
export function mondayOf(d: Date): Date {
  return addDays(startOfDay(d), -((d.getDay() + 6) % 7))
}

/** ISO-8601-Kalenderwoche. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7)
}

/** Dauer kompakt: '2h 05m', '12m', '<1m', '0m'. */
export function fmt(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h) return `${h}h ${pad(m)}m`
  if (m) return `${m}m`
  return sec > 0 ? '<1m' : '0m'
}

/** Dauer als Uhr: 'HH:MM:SS'. */
export const clockStr = (sec: number): string =>
  `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`

/** Uhrzeit eines Zeitpunkts (Sekunden): 'HH:MM'. */
export const hhmm = (sec: number): string => {
  const d = new Date(sec * 1000)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 'HH:MM' → Minuten seit Mitternacht (null bei leer). */
export function toMin(s: string | undefined): number | null {
  if (!s) return null
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Minuten → 'HH:MM', begrenzt auf 00:00–23:59. */
export function fromMin(m: number): string {
  const x = Math.max(0, Math.min(1439, Math.round(m)))
  return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`
}

/** Kalendertage von heute bis `day` ('YYYY-MM-DD'); negativ = Vergangenheit. DST-sicher. */
export function dayDiff(day: string, today: Date): number {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round((Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5)
}
