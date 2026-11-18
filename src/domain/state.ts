import type { State } from './types.ts'

export const emptyState = (): State => ({
  meta: { acts: [], run: null, last: null, u: 0 },
  months: {},
})
