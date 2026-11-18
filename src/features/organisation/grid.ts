/** Tagesraster (Woche + Home): ganzer Tag 00–24 Uhr – auch nachts getrackte Zeit ist sichtbar. 54 px pro Stunde. */
export const H0 = 0
export const H1 = 24
export const PX = 54

/** Minuten seit Mitternacht → Pixel im Raster. */
export const minToPx = (m: number): number => ((m - H0 * 60) / 60) * PX
