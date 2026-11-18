import { describe, expect, it } from 'vitest'
import { createRange, moveRange, resizeEnd, snap } from './drag.ts'

describe('Drag-Mathematik', () => {
  it('snap auf 15 min', () => {
    expect(snap(607)).toBe(600)
    expect(snap(608)).toBe(615)
  })

  it('createRange: Klick → 1 h; Ziehen in beide Richtungen; Mindestlänge', () => {
    expect(createRange(600, 600, false)).toEqual({ s: 600, e: 660 })
    expect(createRange(600, 690, true)).toEqual({ s: 600, e: 690 })
    expect(createRange(690, 600, true)).toEqual({ s: 600, e: 690 })
    expect(createRange(600, 600, true)).toEqual({ s: 600, e: 615 })
  })

  it('moveRange: Dauer bleibt, Grenzen 06–24', () => {
    expect(moveRange(640, 10, 120, 6, 24)).toEqual({ s: 630, e: 750 })
    expect(moveRange(200, 0, 60, 6, 24)).toEqual({ s: 360, e: 420 })
    expect(moveRange(1430, 0, 120, 6, 24)).toEqual({ s: 1320, e: 1440 })
  })

  it('resizeEnd: mindestens 15 min, höchstens 24:00', () => {
    expect(resizeEnd(600, 700, 6, 24)).toBe(705)
    expect(resizeEnd(600, 580, 6, 24)).toBe(615)
    expect(resizeEnd(600, 2000, 6, 24)).toBe(1440)
  })
})
