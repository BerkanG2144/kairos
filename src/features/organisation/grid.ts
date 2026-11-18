/** Wochenraster: 06–24 Uhr, 54 px pro Stunde. */
export const H0 = 6
export const H1 = 24
export const PX = 54

/** Minuten seit Mitternacht → Pixel im Raster. */
export const minToPx = (m: number): number => ((m - H0 * 60) / 60) * PX
