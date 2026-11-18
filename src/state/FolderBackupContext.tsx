import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { FolderBackup, FolderStatus } from './folderBackup.ts'

const Ctx = createContext<FolderBackup | null>(null)

export function FolderBackupProvider({ backup, children }: { backup: FolderBackup; children: ReactNode }) {
  return <Ctx.Provider value={backup}>{children}</Ctx.Provider>
}

export function useFolderBackup(): [FolderStatus, FolderBackup] {
  const fb = useContext(Ctx)
  if (!fb) throw new Error('useFolderBackup außerhalb von <FolderBackupProvider>')
  return [useSyncExternalStore(fb.subscribe, fb.get), fb]
}
