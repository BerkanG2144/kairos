import { describe, expect, it } from 'vitest'
import { hrefOf, parseHash } from './route.ts'

describe('parseHash', () => {
  it.each([
    ['', 'tracker'],
    ['#', 'tracker'],
    ['#statistik', 'statistik'],
    ['#organisation', 'organisation'],
    ['#klausuren', 'organisation'],
    ['#unbekannt', 'tracker'],
  ] as const)('%s → %s', (h, r) => expect(parseHash(h)).toBe(r))

  it('hrefOf ist die Umkehrung', () => {
    for (const r of ['tracker', 'statistik', 'organisation'] as const) expect(parseHash(hrefOf(r))).toBe(r)
  })
})
