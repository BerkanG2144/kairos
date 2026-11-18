import { useSyncExternalStore } from 'react'

export type Route = 'plan' | 'tracker' | 'statistik' | 'organisation'

/** '#tracker', '#statistik', '#organisation' (alt: '#klausuren'), sonst Plan (Startseite). */
export function parseHash(hash: string): Route {
  if (hash === '#tracker') return 'tracker'
  if (hash === '#statistik') return 'statistik'
  if (hash === '#organisation' || hash === '#klausuren') return 'organisation'
  return 'plan'
}

export const hrefOf = (r: Route): string => (r === 'plan' ? '#' : `#${r}`)

export function navigate(r: Route): void {
  if (r === 'plan') {
    // Kein leeres '#' in der Adresszeile stehen lassen
    history.pushState(null, '', location.pathname + location.search)
    dispatchEvent(new HashChangeEvent('hashchange'))
  } else location.hash = r
}

const subscribe = (fn: () => void) => {
  addEventListener('hashchange', fn)
  addEventListener('popstate', fn)
  return () => {
    removeEventListener('hashchange', fn)
    removeEventListener('popstate', fn)
  }
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseHash(location.hash))
}
