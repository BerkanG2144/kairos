import { expect, test } from '@playwright/test'
import { freezeAt, importBackup } from './helpers.ts'

test('Organisation: Klausur anlegen → Karte mit Countdown und Fortschritt; bearbeiten, löschen', async ({ page }) => {
  await freezeAt(page) // Mi 18.11.2026 15:00
  await page.goto('/#organisation')
  await importBackup(page)
  const form = page.getByRole('form', { name: 'Klausur hinzufügen' })
  const add = form.getByRole('button', { name: '+ Klausur' })
  await expect(add).toBeDisabled()

  await form.getByLabel('Name der Klausur').fill('Analysis I')
  await form.getByLabel('Fach').selectOption({ label: 'Mathe' })
  await form.getByLabel('Datum').fill('2026-11-28')
  await form.getByLabel('Uhrzeit').fill('09:00')
  await add.click()
  await expect(form.getByLabel('Name der Klausur')).toHaveValue('')

  const card = page.getByRole('button', { name: 'Klausur Analysis I' })
  await expect(card).toContainText('Mathe · Sa, 28. Nov 2026 · 09:00')
  await expect(card.getByTestId('exam-count')).toHaveText('10 Tage')
  const week0 = await card.getByTestId('exam-week').textContent()
  expect(week0).toMatch(/^\d+,\dh$/)

  // 30 min Mathe lernen → Woche und Gesamt steigen um 0,5h
  await page.getByRole('link', { name: 'Tracker' }).click()
  await page.getByRole('button', { name: 'Mathe', exact: true }).click()
  await page.clock.runFor(30 * 60_000)
  await page.getByRole('button', { name: 'Stopp' }).click()
  await page.getByRole('link', { name: 'Organisation' }).click()
  const plus = (s: string) => `${(Number(s.replace('h', '').replace(',', '.')) + 0.5).toFixed(1).replace('.', ',')}h`
  await expect(card.getByTestId('exam-week')).toHaveText(plus(week0!))

  // steht auch im Kalender (als Klausur am 28.11.)
  await page.getByRole('link', { name: 'Kalender' }).click()
  await page.getByRole('button', { name: 'Monat' }).click()
  await expect(page.getByRole('region', { name: 'Kalender' })).toContainText('Analysis I')

  // Karte anklicken → bearbeiten → löschen
  await page.getByRole('link', { name: 'Organisation' }).click()
  await card.click()
  const dlg = page.getByRole('dialog', { name: 'Eintrag bearbeiten' })
  await expect(dlg.getByLabel('Titel')).toHaveValue('Analysis I')
  await dlg.getByRole('button', { name: 'Löschen' }).click()
  await dlg.getByRole('button', { name: /Wirklich löschen|Löschen/ }).last().click()
  await expect(card).toHaveCount(0)
})

test('Organisation: nur Fach gewählt → Name = Fach; ohne Fach Hinweis statt Fortschritt', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#organisation')
  await importBackup(page)
  const form = page.getByRole('form', { name: 'Klausur hinzufügen' })
  await form.getByLabel('Fach').selectOption({ label: 'Physik' })
  await form.getByLabel('Datum').fill('2026-11-19')
  await form.getByRole('button', { name: '+ Klausur' }).click()
  const phys = page.getByRole('button', { name: 'Klausur Physik' })
  await expect(phys.getByTestId('exam-count')).toHaveText('Morgen')

  await form.getByLabel('Name der Klausur').fill('Ohne Fach')
  await form.getByLabel('Fach').selectOption('')
  await form.getByLabel('Datum').fill('2026-12-01')
  await form.getByRole('button', { name: '+ Klausur' }).click()
  await expect(page.getByRole('button', { name: 'Klausur Ohne Fach' })).toContainText('Kein Fach verknüpft')
  // nächste zuerst
  const names = await page.locator('[data-exam][data-upcoming] b').allTextContents()
  expect(names.indexOf('Physik')).toBeLessThan(names.indexOf('Ohne Fach'))
})
