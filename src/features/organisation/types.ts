import type { PlanItem, PlanType } from '../../domain/types.ts'

/** Callbacks der Organisation an ihre Ansichten. */
export type OrgActions = {
  /** Bestehenden Eintrag bearbeiten */
  open: (it: PlanItem) => void
  /** Neuen Eintrag anlegen (Editor vorausgefüllt) */
  create: (d: string, type: PlanType, t?: string, e?: string) => void
  toggleDone: (id: string) => void
}
