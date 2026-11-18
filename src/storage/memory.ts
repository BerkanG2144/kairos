import type { State } from '../domain/types.ts'
import type { DocChanges, Storage, Stored } from './Storage.ts'

const copy = <T>(x: T): T => structuredClone(x)

/** Flüchtiger Speicher – für Tests und als Fallback, wenn IndexedDB fehlt. */
export class MemoryStorage implements Storage {
  private data: Stored | null

  constructor(initial: Stored | null = null) {
    this.data = initial && copy(initial)
  }

  async load(): Promise<Stored | null> {
    return this.data && copy(this.data)
  }

  async save(changes: DocChanges, schema: number): Promise<void> {
    const base: State = this.data?.state ?? { meta: { acts: [], run: null, last: null, u: 0 }, months: {} }
    const months = { ...base.months }
    for (const [k, v] of Object.entries(changes.months ?? {})) {
      if (v) months[k] = copy(v)
      else delete months[k]
    }
    this.data = { schema, state: { meta: changes.meta ? copy(changes.meta) : base.meta, months } }
  }

  async replaceAll(state: State, schema: number): Promise<void> {
    this.data = { schema, state: copy(state) }
  }
}
