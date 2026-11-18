import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { State } from '../domain/types.ts'
import type { Action, Store } from './store.ts'

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ store, children }: { store: Store; children: ReactNode }) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore außerhalb von <StoreProvider>')
  return s
}

/** Aktueller State; rendert neu bei jeder Änderung. */
export function useAppState(): State {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.get)
}

export function useDispatch(): (a: Action) => void {
  return useStore().dispatch
}
