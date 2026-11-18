import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

export type DragState = {
  id: string
  /** Zeiger (Viewport) */
  x: number
  y: number
  /** Griffpunkt innerhalb der Karte und ihre Größe – für die mitlaufende Karte */
  offX: number
  offY: number
  w: number
  h: number
  /** Ziel: Tag und Position (null = hier nicht ablegbar) */
  day: string | null
  index: number
}

type Opts = {
  band: RefObject<HTMLElement | null>
  canDrop: (day: string) => boolean
  /** kleinste erlaubte Position an einem Tag (z. B. hinter dem laufenden Task) */
  minIndex?: (day: string) => number
  onDrop: (id: string, day: string, index: number) => void
}

const LONG_PRESS_MS = 320
const SLOP_TOUCH = 8
const SLOP_MOUSE = 4
const EDGE = 64

/** Spalte und Einfügeposition unter dem Zeiger. Gezählt werden die Karten, deren Mitte über dem Zeiger liegt. */
function targetAt(x: number, y: number, id: string, o: Pick<Opts, 'canDrop' | 'minIndex'>): { day: string | null; index: number } {
  const col = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-plan-day]')
  const day = col?.dataset.planDay
  if (!col || !day || !o.canDrop(day)) return { day: null, index: 0 }
  let index = 0
  for (const c of col.querySelectorAll<HTMLElement>('[data-task]')) {
    if (c.dataset.task === id) continue
    const r = c.getBoundingClientRect()
    if (r.top + r.height / 2 < y) index++
  }
  return { day, index: Math.max(index, o.minIndex?.(day) ?? 0) }
}

/**
 * Tasks ziehen: Maus ab 4 px Bewegung, Touch nach langem Drücken (sonst scrollt die Seite normal).
 * Am Rand des Bands bzw. einer Spalte wird automatisch gescrollt.
 */
export function useTaskDrag(opts: Opts) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const optsRef = useRef(opts)
  const suppressClick = useRef(false)
  const pointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    optsRef.current = opts
  })

  // Während eines Touch-Drags darf die Seite nicht scrollen.
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault()
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => window.removeEventListener('touchmove', onTouchMove)
  }, [])

  const set = (d: DragState | null) => {
    dragRef.current = d
    setDrag(d)
  }

  const update = () => {
    const d = dragRef.current
    if (!d) return
    const { x, y } = pointer.current
    set({ ...d, x, y, ...targetAt(x, y, d.id, optsRef.current) })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-nodrag]')) return
    suppressClick.current = false
    const card = e.currentTarget.getBoundingClientRect()
    const sx = e.clientX
    const sy = e.clientY
    const pid = e.pointerId
    const touch = e.pointerType !== 'mouse'
    pointer.current = { x: sx, y: sy }
    let started = false
    let raf = 0

    const autoScroll = () => {
      const b = optsRef.current.band.current
      const { x, y } = pointer.current
      if (b && dragRef.current) {
        const r = b.getBoundingClientRect()
        let dx = 0
        if (x < r.left + EDGE) dx = -Math.ceil((r.left + EDGE - x) / 4)
        else if (x > r.right - EDGE) dx = Math.ceil((x - (r.right - EDGE)) / 4)
        if (dx) b.scrollLeft += dx
        let dy = 0
        const list = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-plan-list]')
        if (list) {
          const lr = list.getBoundingClientRect()
          if (y < lr.top + 40) dy = -8
          else if (y > lr.bottom - 40) dy = 8
          if (dy) list.scrollTop += dy
        }
        if (dx || dy) update()
      }
      raf = requestAnimationFrame(autoScroll)
    }

    const begin = () => {
      started = true
      suppressClick.current = true
      const { x, y } = pointer.current
      set({ id, x, y, offX: sx - card.left, offY: sy - card.top, w: card.width, h: card.height, ...targetAt(x, y, id, optsRef.current) })
      if (touch) navigator.vibrate?.(8)
      raf = requestAnimationFrame(autoScroll)
    }

    const timer = touch ? setTimeout(begin, LONG_PRESS_MS) : undefined

    const cleanup = () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cleanup)
      window.removeEventListener('keydown', key)
      set(null)
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      pointer.current = { x: ev.clientX, y: ev.clientY }
      if (started) return update()
      const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy)
      if (touch) {
        if (dist > SLOP_TOUCH) cleanup() // Wischen → normal scrollen
      } else if (dist > SLOP_MOUSE) begin()
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      const d = dragRef.current
      cleanup()
      if (started && d?.day) optsRef.current.onDrop(d.id, d.day, d.index)
    }
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cleanup()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cleanup)
    window.addEventListener('keydown', key)
  }

  /** Nach einem Drag kommt noch ein click – den schlucken. */
  const consumeClick = (): boolean => {
    const s = suppressClick.current
    suppressClick.current = false
    return s
  }

  return { drag, onPointerDown, consumeClick }
}
