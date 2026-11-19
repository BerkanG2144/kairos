import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { expectNoHorizontalScroll, freezeAt, importBackup } from './helpers.ts'

test('Import des Legacy-Backups, alle Seiten ohne horizontales Scrollen', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#tracker')
  await page.getByTestId('import-file').setInputFiles('e2e/fixtures/backup-legacy.json')
  await expect(page.getByRole('alert')).toHaveText(/Backup vom 17\. Nov 21:15 laden\? 4 Fächer, 220 Einträge – ersetzt die aktuellen Daten\./)
  await page.getByRole('button', { name: 'Importieren' }).click()

  await expect(page.getByRole('button', { name: 'Mathe', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Französisch', exact: true })).toHaveCount(0) // gelöscht
  await expectNoHorizontalScroll(page)

  await page.getByRole('link', { name: 'Statistik' }).click()
  await expect(page.getByTestId('kpi-days')).not.toHaveText('0')
  await expectNoHorizontalScroll(page)

  await page.getByRole('link', { name: 'Organisation' }).click()
  // migrierte Klausuren aus meta.exams
  await expect(page.getByRole('button', { name: 'Klausur HM I' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Klausur Experimentalphysik' })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.getByRole('link', { name: 'Kalender' }).click()
  await page.getByRole('button', { name: 'Monat' }).click()
  await expectNoHorizontalScroll(page)

  // bleibt nach Neuladen erhalten
  await page.getByRole('link', { name: 'Organisation' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Klausur HM I' })).toBeVisible()
})

test('Ungültige Datei wird abgelehnt, Daten bleiben', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#tracker')
  await importBackup(page)
  await page.getByTestId('import-file').setInputFiles({ name: 'kaputt.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') })
  await expect(page.getByRole('button', { name: 'Ungültige Datei' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mathe', exact: true })).toBeVisible()
})

test('Export → Import ergibt denselben Stand', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#tracker')
  await importBackup(page)
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Backup', exact: true }).click()
  const file = await dl
  expect(file.suggestedFilename()).toBe('kairos-backup-2026-11-18_1500.json')
  const json = JSON.parse(await readFile((await file.path())!, 'utf8'))
  expect(json).toMatchObject({ app: 'lernzeit', format: 1, schema: 3 })
  expect('exams' in json.data.meta).toBe(false)

  await page.getByRole('link', { name: 'Statistik' }).click()
  await page.getByRole('button', { name: 'Gesamt' }).click()
  const before = await page.getByTestId('kpi-total').textContent()

  await page.getByTestId('import-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) })
  await page.getByRole('button', { name: 'Importieren' }).click()
  await expect(page.getByTestId('kpi-total')).toHaveText(before!)
})
