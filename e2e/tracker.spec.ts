import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, freezeAt, NOW, revealRemove } from './helpers.ts'

const NOW_PLUS = (min: number) => NOW.getTime() + min * 60_000

test('Fach anlegen → Timer → Pause → Weiter → Neuladen läuft weiter', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/')
  const timer = page.getByRole('timer')
  await expect(timer).toHaveText('00:00:00')

  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('Mathe')
  await page.keyboard.press('Enter')
  const mathe = page.getByRole('button', { name: 'Mathe', exact: true })
  await expect(mathe).toBeVisible()

  await mathe.click()
  await expect(mathe).toHaveAttribute('aria-pressed', 'true')
  await page.clock.runFor(65_000)
  await expect(timer).toHaveText('00:01:05')
  await expect(page).toHaveTitle('00:01:05 · Mathe')

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await page.clock.runFor(30_000)
  await expect(timer).toHaveText('00:00:30')

  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(mathe).toHaveAttribute('aria-pressed', 'true')
  await page.clock.runFor(10_000)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Mathe', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.clock.runFor(2_000)
  await expect(timer).toHaveText('00:00:12')

  await page.getByRole('button', { name: 'Stopp' }).click()
  await expect(timer).toHaveText('00:00:00')
  await expect(page.getByRole('button', { name: 'Stopp' })).toHaveCount(0)
  // 65 s + 12 s Lernzeit, 30 s Pause
  await expect(page.getByTestId('day-total')).toHaveText('1m')
  await expectNoHorizontalScroll(page)
})

test('Fach löschen mit Bestätigung, gleicher Name reaktiviert', async ({ page, isMobile }) => {
  await freezeAt(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('Physik')
  await page.keyboard.press('Enter')

  await revealRemove(page, 'Physik', isMobile)
  await page.getByRole('button', { name: 'Physik entfernen' }).click()
  await page.getByRole('button', { name: 'nein' }).click()
  await expect(page.getByRole('button', { name: 'Physik', exact: true })).toBeVisible()

  // Nach langem Drücken muss ein normaler Tipp wieder starten (kein „hängendes“ Flag)
  if (isMobile) {
    await revealRemove(page, 'Physik', isMobile)
    await page.getByRole('button', { name: 'Physik', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Physik', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Stopp' }).click()
  }

  await revealRemove(page, 'Physik', isMobile)
  await page.getByRole('button', { name: 'Physik entfernen' }).click()
  await page.getByRole('button', { name: 'ja' }).click()
  await expect(page.getByRole('button', { name: 'Physik', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('physik')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Physik', exact: true })).toBeVisible()
})

test('Lücken-Erkennung: Seite war zu → rückwirkend stoppen', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('Info')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Info', exact: true }).click()
  await page.clock.runFor(10 * 60_000) // 10 min, Lebenszeichen alle 5 s

  // Seite „schließen“ und 20 min später wieder öffnen
  await page.goto('about:blank')
  await page.clock.setSystemTime(new Date(NOW_PLUS(30)))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Seite war 20 Min. zu – der Timer lief weiter.')
  await page.getByRole('button', { name: 'Um 15:10 stoppen' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('timer')).toHaveText('00:00:00')
  await expect(page.getByTestId('day-total')).toHaveText('10m')
})
