/** Pseudo-Fach-ID für Pausen. Zählt nie als Lernzeit. */
export const PAUSE = '_p'

/** Fach-Farben in Vergabe-Reihenfolge. */
export const COLORS = [
  '#c7b8f2',
  '#a9e5c8',
  '#a8c8ec',
  '#f6c6a0',
  '#f2a9bd',
  '#f1e2a2',
  '#b3e0e6',
  '#dcc3ea',
  '#cfe3a6',
] as const

/** Ab dieser Lücke ohne Lebenszeichen (ms) fragt die App nach. */
export const GAP_MS = 5 * 60 * 1000

/** Ab so viel Lernzeit (s) gilt ein Tag als Lerntag. */
export const LEARN_DAY_MIN_SEC = 60

/** Maximale Länge eines Fachnamens. */
export const ACT_NAME_MAX = 28

export const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
] as const

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
] as const
