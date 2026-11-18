import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/jetbrains-mono/latin-200.css'
import '@fontsource/jetbrains-mono/latin-300.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import './styles/tokens.css'
import './styles/base.css'

import { App } from './App.tsx'
import { FolderBackup } from './state/folderBackup.ts'
import { FolderBackupProvider } from './state/FolderBackupContext.tsx'
import { StoreProvider } from './state/StoreProvider.tsx'
import { Store } from './state/store.ts'
import { IdbDeviceSettings, MemoryDeviceSettings, type DeviceSettings } from './storage/device.ts'
import { folderSupported, pickFolder, writeFolderBackup } from './storage/folder.ts'
import { IdbStorage } from './storage/idb.ts'
import { MemoryStorage } from './storage/memory.ts'

async function boot() {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root fehlt in index.html')

  let store: Store
  let volatile = false
  try {
    store = await Store.open(new IdbStorage())
  } catch (e) {
    console.error('[kairos] IndexedDB nicht verfügbar – nur flüchtiger Speicher', e)
    store = await Store.open(new MemoryStorage())
    volatile = true
  }
  // Zusätzliche Kopie in einem Ordner auf dem Rechner (Chrome/Edge am Desktop).
  let settings: DeviceSettings
  try {
    settings = new IdbDeviceSettings()
  } catch {
    settings = new MemoryDeviceSettings()
  }
  const folder = new FolderBackup(store, { settings, supported: folderSupported(), pick: pickFolder, write: writeFolderBackup })
  void folder.init()
  // Beim Verlassen/Verstecken ausstehende Sicherung sofort schreiben.
  const flushFolder = () => void folder.flush()
  window.addEventListener('pagehide', flushFolder)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushFolder()
  })

  // Browser bitten, die Daten nicht automatisch zu löschen (wichtig v. a. auf iOS).
  void navigator.storage?.persist?.().catch(() => {})

  createRoot(root).render(
    <StrictMode>
      <StoreProvider store={store}>
        <FolderBackupProvider backup={folder}>
          <App volatile={volatile} />
        </FolderBackupProvider>
      </StoreProvider>
    </StrictMode>,
  )
}

void boot()
