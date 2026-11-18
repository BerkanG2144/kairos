import { expect, test, type Page } from '@playwright/test'
import { freezeAt, importBackup } from './helpers.ts'

test.skip(({ isMobile }) => isMobile, 'Ordner-Sicherung gibt es nur am Desktop')

/** Ersetzt den Ordner-Dialog durch einen Ordner im Speicher (window.__files). */
async function mockFolderPicker(page: Page) {
  await page.addInitScript(() => {
    const files: Record<string, string> = {}
    ;(window as unknown as { __files: typeof files }).__files = files
    const dir = {
      name: 'Kairos',
      kind: 'directory',
      async getFileHandle(name: string) {
        return {
          async createWritable() {
            let buf = ''
            return {
              async write(d: string) {
                buf += d
              },
              async close() {
                files[name] = buf
              },
            }
          },
        }
      },
      async removeEntry(name: string) {
        delete files[name]
      },
      async *keys() {
        yield* Object.keys(files)
      },
      async queryPermission() {
        return 'granted'
      },
      async requestPermission() {
        return 'granted'
      },
    }
    ;(window as unknown as { showDirectoryPicker: () => Promise<typeof dir> }).showDirectoryPicker = async () => dir
  })
}

const files = (page: Page) => page.evaluate(() => (window as unknown as { __files: Record<string, string> }).__files)

test('Ordner wählen → Änderungen landen automatisch im Ordner', async ({ page }) => {
  await freezeAt(page)
  await mockFolderPicker(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Auto-Sicherung' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ordner-Sicherung' })
  await dialog.getByRole('button', { name: 'Ordner wählen' }).click()
  await expect(dialog.getByTestId('backup-folder')).toHaveText('Kairos')
  // Leere App schreibt nichts.
  await expect(dialog.getByTestId('backup-saved')).toHaveText('noch nicht')
  expect(await files(page)).toEqual({})
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('Mathe')
  await page.keyboard.press('Enter')
  await page.clock.runFor(2500)

  await expect.poll(async () => Object.keys(await files(page)).sort()).toEqual(['kairos-2026-11-18.json', 'kairos-aktuell.json'])
  const current = JSON.parse((await files(page))['kairos-aktuell.json']!)
  expect(current).toMatchObject({ app: 'lernzeit', format: 1, schema: 2 })
  expect(current.data.meta.acts.map((a: { name: string }) => a.name)).toEqual(['Mathe'])
  await expect(page.getByRole('button', { name: 'Gesichert' })).toBeVisible()

  // Import wird ebenfalls gesichert – und die Sicherung ist selbst wieder importierbar.
  await importBackup(page)
  await page.clock.runFor(2500)
  await expect.poll(async () => JSON.parse((await files(page))['kairos-aktuell.json']!).data.meta.acts.length).toBeGreaterThan(1)

  await page.getByRole('button', { name: 'Gesichert' }).click()
  await expect(dialog.getByTestId('backup-saved')).toHaveText('heute 15:00')
  await dialog.getByRole('button', { name: 'Ausschalten' }).click()
  await expect(page.getByRole('button', { name: 'Auto-Sicherung' })).toBeVisible()
})
