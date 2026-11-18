import { expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURE = path.join(here, 'fixtures', 'backup-legacy.json')
export const LEGACY = path.join(here, '..', 'legacy', 'lernzeit-legacy.html')

/** Fester „Jetzt“-Zeitpunkt passend zum Beispiel-Backup (Mi, 18.11.2026). */
export const NOW = new Date('2026-11-18T15:00:00+01:00')

/** Uhr anhalten (Zeit läuft nur über clock.runFor/fastForward/setSystemTime weiter). */
export async function freezeAt(page: Page, at: Date = NOW) {
  await page.clock.install({ time: new Date(at.getTime() - 1000) })
  await page.clock.pauseAt(at)
}

/** Fach-Pill: × einblenden – Maus per Hover, Touch per langem Drücken. */
export async function revealRemove(page: Page, name: string, isMobile: boolean) {
  const pill = page.locator('[data-pill]', { has: page.getByRole('button', { name, exact: true }) })
  if (!isMobile) return pill.hover()
  await pill.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, button: 0 })
  await page.clock.runFor(600)
  await pill.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, button: 0 })
}

export async function importBackup(page: Page, file = FIXTURE) {
  await page.getByTestId('import-file').setInputFiles(file)
  await expect(page.getByRole('alert')).toContainText('laden?')
  await page.getByRole('button', { name: 'Importieren' }).click()
  await expect(page.getByRole('button', { name: 'Importiert' })).toBeVisible()
}

/** Keine horizontale Scrollbar auf Seitenebene. */
export async function expectNoHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  expect(sw).toBeLessThanOrEqual(cw)
}

/** Plan-Items direkt aus IndexedDB lesen. */
export async function storedPlan(page: Page): Promise<{ id: string; title: string; d: string; t?: string; e?: string; g?: string }[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open('lernzeit')
      q.onsuccess = () => r(q.result)
    })
    const all = await new Promise<{ p?: unknown[] }[]>((r) => {
      const q = db.transaction('docs').objectStore('docs').getAll()
      q.onsuccess = () => r(q.result)
    })
    db.close()
    return all.flatMap((d) => (d.p ?? []) as { id: string; title: string; d: string }[])
  })
}
