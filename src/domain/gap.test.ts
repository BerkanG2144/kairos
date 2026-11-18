import { describe, expect, it } from 'vitest'
import { detectGap, gapTexts } from './gap.ts'

const T = new Date('2026-11-18T10:00:00').getTime()
const run = { a: 'a', t: Math.floor(T / 1000) }

describe('detectGap', () => {
  it('keine Lücke ohne Timer oder ohne Lebenszeichen', () => {
    expect(detectGap(null, T, T + 3600_000)).toBeNull()
    expect(detectGap(run, null, T + 3600_000)).toBeNull()
  })
  it('≤ 5 min ist keine Lücke', () => {
    expect(detectGap(run, T + 60_000, T + 60_000 + 5 * 60_000)).toBeNull()
  })
  it('> 5 min → letztes Lebenszeichen als Schnittpunkt', () => {
    const seen = T + 10 * 60_000
    expect(detectGap(run, seen, seen + 6 * 60_000)).toBe(seen / 1000)
  })
  it('Lebenszeichen vor Timer-Start → keine Lücke', () => {
    expect(detectGap(run, T - 60_000, T + 3600_000)).toBeNull()
  })
})

describe('gapTexts', () => {
  const cut = Math.floor(new Date('2026-11-18T10:07:00').getTime() / 1000)
  it('Minuten', () => {
    expect(gapTexts(cut, cut + 12 * 60)).toEqual({
      text: 'Seite war 12 Min. zu – der Timer lief weiter.',
      cut: 'Um 10:07 stoppen',
    })
  })
  it('ab einer Stunde im h/m-Format', () => {
    expect(gapTexts(cut, cut + 95 * 60).text).toBe('Seite war 1h 35m zu – der Timer lief weiter.')
  })
})
