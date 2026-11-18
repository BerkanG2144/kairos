import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import type { State } from '../domain/types.ts'
import { IdbStorage } from './idb.ts'

const state: State = {
  meta: { acts: [{ id: 'a1', name: 'Mathe', c: '#c7b8f2' }], run: { a: 'a1', t: 100 }, last: 'a1', u: 5 },
  months: {
    '2026-10': { s: [['a1', 1, 2]], u: 1 },
    '2026-11': { s: [], p: [{ id: 'p1', type: 'block', title: 'x', d: '2026-11-02', t: '10:00', e: '11:00' }], u: 2 },
  },
}

describe('IdbStorage', () => {
  it('leere DB → null', async () => {
    const db = new IdbStorage('t', new IDBFactory())
    expect(await db.load()).toBeNull()
  })

  it('replaceAll + load (auch nach erneutem Öffnen)', async () => {
    const f = new IDBFactory()
    const db = new IdbStorage('t', f)
    await db.replaceAll(state, 2)
    expect(await db.load()).toEqual({ state, schema: 2 })
    await db.close()
    expect(await new IdbStorage('t', f).load()).toEqual({ state, schema: 2 })
  })

  it('save schreibt nur geänderte Dokumente, null löscht einen Monat', async () => {
    const db = new IdbStorage('t', new IDBFactory())
    await db.replaceAll(state, 2)
    const meta = { ...state.meta, run: null, u: 9 }
    await db.save({ meta, months: { '2026-10': null, '2026-12': { s: [['a1', 5, 6]], u: 9 } } }, 2)
    expect(await db.load()).toEqual({
      schema: 2,
      state: { meta, months: { '2026-11': state.months['2026-11'], '2026-12': { s: [['a1', 5, 6]], u: 9 } } },
    })
  })

  it('replaceAll entfernt alte Monate', async () => {
    const db = new IdbStorage('t', new IDBFactory())
    await db.replaceAll(state, 2)
    await db.replaceAll({ meta: state.meta, months: {} }, 2)
    expect((await db.load())?.state.months).toEqual({})
  })
})
