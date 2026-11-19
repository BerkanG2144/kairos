import { useLayoutEffect, type RefObject } from 'react'

/**
 * Element reicht bis zum unteren Fensterrand (Inhalt scrollt darin). Neu berechnet bei
 * Fenstergröße und wenn sich die Kopfzeile ändert (Umbruch, Mini-Timer erscheint).
 */
export function useFitHeight(ref: RefObject<HTMLElement | null>, min: number, gap = 20) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.height = `${Math.max(min, window.innerHeight - el.getBoundingClientRect().top - window.scrollY - gap)}px`
    }
    fit()
    window.addEventListener('resize', fit)
    const header = document.querySelector('header')
    const ro = header && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    if (header) ro?.observe(header)
    return () => {
      window.removeEventListener('resize', fit)
      ro?.disconnect()
    }
  }, [ref, min, gap])
}
