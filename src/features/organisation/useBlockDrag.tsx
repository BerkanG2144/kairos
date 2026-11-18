/**
 * Drag & Drop im Wochenraster (Maus/Stift):
 *  - freie Fläche ziehen → neuer Block (Editor vorausgefüllt), einfacher Klick → 1 h
 *  - Block ziehen → verschieben (auch auf andere Tage), unterer Rand → Länge ändern
 *  - Block klicken → bearbeiten
 * Touch: nur Tippen. Bewegt sich der Finger > 5 px, wird abgebrochen, damit Scrollen geht.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { clampMin, createRange, moveRange, resizeEnd, snap } from '../../domain/drag.ts'
import { SNAP_MIN, type Placed } from '../../domain/lanes.ts'
import { findItem, saveItem } from '../../domain/plan.ts'
import { fromMin, toMin } from '../../domain/time.ts'
import type { PlanItem } from '../../domain/types.ts'
import { useStore } from '../../state/StoreProvider.tsx'
import { H0, H1, PX } from './grid.ts'
import type { OrgActions } from './types.ts'

const MOVE_THRESHOLD = 5

type Base = { x0: number; y0: number; moved: boolean; touch: boolean }
export type Drag =
  | (Base & { mode: 'create'; day: string; a: number; b: number })
  | (Base & { mode: 'move' | 'resize'; it: PlanItem; day: string; s: number; e: number; ns: number; ne: number; grab: number })

const rawMin = (col: Element, y: number) => H0 * 60 + ((y - col.getBoundingClientRect().top) / PX) * 60

export function useBlockDrag(container: RefObject<HTMLElement | null>, actions: OrgActions) {
  const store = useStore()
  const [drag, setDrag] = useState<Drag | null>(null)
  const ref = useRef<Drag | null>(null)
  const update = (d: Drag | null) => {
    ref.current = d
    setDrag(d)
  }
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const colEl = (day: string) => container.current?.querySelector(`[data-col="${day}"]`) ?? null
  const colAt = (x: number) =>
    [...(container.current?.querySelectorAll('[data-col]') ?? [])].find((c) => {
      const r = c.getBoundingClientRect()
      return x >= r.left && x < r.right
    })

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const g = ref.current
      if (!g) return
      let moved = g.moved
      if (!moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > MOVE_THRESHOLD) {
        if (g.touch) return update(null)
        moved = true
      }
      if (!moved) return
      if (g.mode === 'create') {
        const col = colEl(g.day)
        if (col) update({ ...g, moved, b: clampMin(snap(rawMin(col, e.clientY)), H0, H1) })
      } else if (g.mode === 'move') {
        const col = colAt(e.clientX) ?? colEl(g.day)
        if (!col) return
        const day = (col as HTMLElement).dataset.col ?? g.day
        const r = moveRange(rawMin(col, e.clientY), g.grab, g.e - g.s, H0, H1)
        update({ ...g, moved, day, ns: r.s, ne: r.e })
      } else {
        const col = colEl(g.day)
        if (col) update({ ...g, moved, ne: resizeEnd(g.s, rawMin(col, e.clientY), H0, H1) })
      }
    }
    const onUp = () => {
      const g = ref.current
      if (!g) return
      update(null)
      if (g.mode === 'create') {
        const { s, e } = createRange(g.a, g.b, g.moved)
        actionsRef.current.create(g.day, 'block', fromMin(s), fromMin(Math.min(e, 1439)))
      } else if (!g.moved) {
        actionsRef.current.open(g.it)
      } else {
        const moved: PlanItem = g.mode === 'move' ? { ...g.it, d: g.day, t: fromMin(g.ns), e: fromMin(g.ne) } : { ...g.it, e: fromMin(g.ne) }
        store.dispatch((s, n) => (findItem(s, g.it.id) ? saveItem(s, moved, n) : s))
      }
    }
    const onCancel = () => update(null)
    addEventListener('pointermove', onMove)
    addEventListener('pointerup', onUp)
    addEventListener('pointercancel', onCancel)
    return () => {
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onCancel)
    }
  }, [store]) // colEl/colAt lesen nur container.current

  const colProps = (day: string) => ({
    onPointerDown: (e: RPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const touch = e.pointerType === 'touch'
      const target = e.target as Element
      const blk = target.closest('[data-item]')
      const base = { x0: e.clientX, y0: e.clientY, moved: false, touch }
      if (blk) {
        const f = findItem(store.get(), (blk as HTMLElement).dataset.item ?? '')
        if (!f) return
        const s = toMin(f.it.t) ?? 0
        const en = Math.max(toMin(f.it.e) ?? 0, s + SNAP_MIN)
        update({ ...base, mode: target.closest('[data-resize]') ? 'resize' : 'move', it: f.it, day, s, e: en, ns: s, ne: en, grab: rawMin(e.currentTarget, e.clientY) - s })
      } else {
        const m = clampMin(Math.floor(rawMin(e.currentTarget, e.clientY) / SNAP_MIN) * SNAP_MIN, H0, H1)
        update({ ...base, mode: 'create', day, a: m, b: m })
      }
      if (!touch) e.preventDefault()
    },
  })

  /** Gezogener Block bzw. Vorschau des neuen Blocks (nur in der Spalte `day`). */
  const preview = (day: string): { kind: 'ghost'; s: number; e: number } | { kind: 'block'; x: Placed } | null => {
    if (!drag?.moved || drag.day !== day) return null
    if (drag.mode === 'create') {
      const { s, e } = createRange(drag.a, drag.b, true)
      return { kind: 'ghost', s, e }
    }
    const x: Placed =
      drag.mode === 'move'
        ? { it: { ...drag.it, t: fromMin(drag.ns), e: fromMin(drag.ne) }, s: drag.ns, e: drag.ne, lane: 0, n: 1 }
        : { it: { ...drag.it, e: fromMin(drag.ne) }, s: drag.s, e: drag.ne, lane: 0, n: 1 }
    return { kind: 'block', x }
  }

  /** Während des Ziehens wird der Block an seiner alten Stelle ausgeblendet. */
  const hiddenId = drag?.moved && drag.mode !== 'create' ? drag.it.id : null

  return { colProps, preview, hiddenId, dragging: !!drag?.moved }
}
