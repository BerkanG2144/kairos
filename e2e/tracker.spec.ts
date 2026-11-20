import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalScroll, freezeAt, importBackup, NOW, revealRemove } from './helpers.ts'

/** Gelernte Zeit heute laut Tagesbilanz (Statistik → Heute). */
async function dayTotal(page: Page): Promise<string | null> {
  await page.getByRole('link', { name: 'Statistik' }).click()
  await page.getByRole('group', { name: 'Zeitraum' }).getByRole('button', { name: 'Heute' }).click()
  const t = await page.getByTestId('day-total').textContent()
  await page.getByRole('link', { name: 'Tracker' }).click()
  return t
}

const NOW_PLUS = (min: number) => NOW.getTime() + min * 60_000

test('Fach anlegen → Timer → Pause → Weiter → Neuladen läuft weiter', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#tracker')
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
  await expectNoHorizontalScroll(page)
  // 65 s + 12 s Lernzeit, 30 s Pause – alles unter 5 min zählt nicht
  await expect.poll(() => dayTotal(page)).toBe('0m')
})

test('Fach löschen mit Bestätigung, gleicher Name reaktiviert', async ({ page, isMobile }) => {
  await freezeAt(page)
  await page.goto('/#tracker')
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
  await page.goto('/#tracker')
  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('Info')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Info', exact: true }).click()
  await page.clock.runFor(10 * 60_000) // 10 min, Lebenszeichen alle 5 s

  // Seite „schließen“ und 20 min später wieder öffnen
  await page.goto('about:blank')
  await page.clock.setSystemTime(new Date(NOW_PLUS(30)))
  await page.goto('/#tracker')
  await expect(page.getByRole('alert')).toContainText('Seite war 20 Min. zu – der Timer lief weiter.')
  await page.getByRole('button', { name: 'Um 15:10 stoppen' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('timer')).toHaveText('00:00:00')
  await expect.poll(() => dayTotal(page)).toBe('10m')
})

test('Tracker: nur Timer, mittig; Statistik ohne Serie und Wochen-Diagramm', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#tracker')
  await importBackup(page)
  await expect(page.getByRole('region', { name: 'Tagesbilanz' })).toHaveCount(0)
  await expect(page.getByTestId('week-total')).toHaveCount(0)
  await expect(page.getByText('November 2026')).toHaveCount(0) // kein Monatskalender
  // Timer steht mittig
  const t = (await page.getByRole('timer').boundingBox())!
  const vw = page.viewportSize()!.width
  expect(Math.abs(t.x + t.width / 2 - vw / 2)).toBeLessThan(20)
  await page.getByRole('link', { name: 'Statistik' }).click()
  await page.getByRole('group', { name: 'Zeitraum' }).getByRole('button', { name: 'Diese Woche' }).click()
  await expect(page.getByTestId('kpi-total')).toBeVisible()
  await expect(page.getByText(/Serie|Rekord/)).toHaveCount(0)
  await expect(page.getByText('Letzte 12 Wochen')).toHaveCount(0)
})

test('Statistik: „Heute“ zeigt die Tagesbilanz', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#statistik')
  await importBackup(page)
  const seg = page.getByRole('group', { name: 'Zeitraum' })
  await seg.getByRole('button', { name: 'Heute' }).click()
  const day = page.getByRole('region', { name: 'Tagesbilanz' })
  await expect(day).toBeVisible()
  await expect(page.getByTestId('kpi-total')).toHaveCount(0)
  await expect(day.getByTestId('day-total')).toHaveText('0m')
  await day.getByRole('button', { name: 'Voriger Tag' }).click()
  await expect(day.getByTestId('day-total')).toHaveText('2h 28m')
  // Auswahl „Heute“ bleibt gemerkt
  await page.getByRole('link', { name: 'Tracker' }).click()
  await page.getByRole('link', { name: 'Statistik' }).click()
  await expect(page.getByRole('region', { name: 'Tagesbilanz' })).toBeVisible()
  await seg.getByRole('button', { name: 'Diese Woche' }).click()
  await expect(page.getByTestId('kpi-total')).toBeVisible()
})

test('Unter 5 min: nirgends sichtbar (Home, Plan, Statistik, Kalender, Task); ab 5 min überall', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#tracker')
  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('Mathe')
  await page.keyboard.press('Enter')
  await page.getByRole('link', { name: 'Home' }).click()
  const input = page.getByRole('textbox', { name: 'Task für heute hinzufügen' })
  await input.fill('Kurz')
  await input.press('Enter')
  const card = page.locator('[data-task]', { hasText: 'Kurz' })
  await card.hover()
  await card.getByRole('button', { name: 'Kurz starten' }).click()
  await page.getByRole('menuitemradio', { name: 'Mathe' }).click()
  await page.clock.runFor(4 * 60_000)
  await card.getByRole('button', { name: 'Kurz stoppen' }).click()

  const check = async (expected: { home: string; stats: string; task: number; blocks: number }) => {
    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page.getByTestId('home-today')).toHaveText(expected.home)
    await expect(page.getByTestId('home-week')).toHaveText(expected.home.replace('heute', 'diese Woche'))
    await expect(card.getByTestId('task-time')).toHaveCount(expected.task)
    await expect(page.getByTestId('day-timeline').locator('[data-tracked]')).toHaveCount(expected.blocks)
    await page.getByRole('link', { name: 'Plan', exact: true }).click()
    await expect(page.getByTestId('plan-week')).toHaveText(expected.home.replace('heute', 'diese Woche'))
    await page.getByRole('link', { name: 'Statistik' }).click()
    await page.getByRole('group', { name: 'Zeitraum' }).getByRole('button', { name: 'Diese Woche' }).click()
    await expect(page.getByTestId('kpi-total')).toHaveText(expected.stats)
    await page.getByRole('link', { name: 'Kalender' }).click()
    await page.getByRole('button', { name: 'Woche' }).click()
    await expect(page.locator('[data-col="2026-11-18"] [data-tracked]')).toHaveCount(expected.blocks)
  }
  await check({ home: '0h 00m heute', stats: '0m', task: 0, blocks: 0 })

  // 10 min später noch einmal 6 min → zählt
  await page.clock.runFor(10 * 60_000)
  await page.getByRole('link', { name: 'Home' }).click()
  await card.hover()
  await card.getByRole('button', { name: 'Kurz starten' }).click()
  await page.clock.runFor(6 * 60_000)
  await card.getByRole('button', { name: 'Kurz stoppen' }).click()
  await check({ home: '0h 06m heute', stats: '6m', task: 1, blocks: 1 })
})
