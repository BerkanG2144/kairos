/** Pseudo-Fach-ID für Pausen. Zählt nie als Lernzeit. */
export const PAUSE = '_p'

/** Fach-Farben in Vergabe-Reihenfolge (v5: kräftiger und im Farbton weiter auseinander). */
export const COLORS = [
  '#ba96f8',
  '#7edda6',
  '#71b2f4',
  '#f89462',
  '#f494b8',
  '#f6e46f',
  '#69d0d3',
  '#e3acec',
  '#b5dd7e',
] as const

/** Pastell-Palette bis v4 – gleiche Reihenfolge wie COLORS, für die Migration. */
export const OLD_COLORS = [
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
