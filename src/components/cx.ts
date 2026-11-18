/** Klassennamen verbinden, falsy wird ignoriert. */
export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ')

/** CSS-Custom-Properties typsicher als style übergeben: style={vars({ '--c': color })} */
export const vars = (o: Record<`--${string}`, string>): import('react').CSSProperties => o as import('react').CSSProperties
