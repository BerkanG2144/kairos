import { useLayoutEffect, useRef, type RefObject } from 'react'

type Pos = { scroller: Element | null; x: number; y: number }

/** Lage einer Karte innerhalb ihrer scrollenden Liste – unabhängig von Scrollposition und laufender Animation. */
function posOf(el: HTMLElement): Pos {
  const r = el.getBoundingClientRect()
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
  const scroller = el.closest('[data-plan-list]')
  if (!scroller) return { scroller, x: r.left - m.m41, y: r.top - m.m42 }
  const s = scroller.getBoundingClientRect()
  return { scroller, x: r.left - m.m41 - s.left + scroller.scrollLeft, y: r.top - m.m42 - s.top + scroller.scrollTop }
}

/**
 * FLIP-Animation für Task-Karten ([data-task]) unter `root`: Ändert eine Karte ihren Platz
 * innerhalb derselben Liste (abhaken, umsortieren), gleitet sie von der alten an die neue Stelle.
 * Abgehakte Karten warten kurz (sichtbar ausgegraut) und „fliegen“ dann nach unten.
 */
export function useFlip(root: RefObject<HTMLElement | null>, enabled: boolean) {
  const prev = useRef(new Map<string, Pos>())
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, Pos>()
    const moves: { card: HTMLElement; dx: number; dy: number; flies: boolean }[] = []
    for (const card of el.querySelectorAll<HTMLElement>('[data-task]')) {
      const id = card.dataset.task!
      const p = posOf(card)
      next.set(id, p)
      const old = prev.current.get(id)
      if (!enabled || reduce || !old || old.scroller !== p.scroller) continue
      const dx = old.x - p.x
      const dy = old.y - p.y
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      moves.push({ card, dx, dy, flies: card.dataset.done === 'true' && dy < 0 })
    }
    // Wird etwas abgehakt, bleibt erst alles kurz stehen (Karte sichtbar grau), dann bewegt sich alles gemeinsam.
    const pause = moves.some((m) => m.flies) ? 220 : 0
    for (const { card, dx, dy, flies } of moves) {
      const from: Keyframe = { transform: `translate(${dx}px, ${dy}px)` }
      // die abgehakte Karte gleitet hinter den anderen nach unten
      if (flies) from.zIndex = '0'
      card.animate([from, { transform: 'none', zIndex: flies ? '0' : '1' }], {
        duration: flies ? 520 : 380,
        delay: pause,
        easing: 'cubic-bezier(.2, .8, .2, 1)',
        fill: 'backwards',
      })
    }
    prev.current = next
  })
}
