import { expect, test, type Page } from '@playwright/test'
import { freezeAt, importBackup } from './helpers.ts'

// NOW = Mi, 18.11.2026 15:00
const openTitles = (page: Page) => page.getByTestId('home-open').locator('[data-task] > button:first-child').allTextContents()
const doneTitles = (page: Page) => page.getByTestId('home-done').locator('[data-task] > button:first-child').allTextContents()

async function add(page: Page, ...names: string[]) {
  const input = page.getByRole('textbox', { name: 'Task für heute hinzufügen' })
  for (const n of names) {
    await input.fill(n)
    await input.press('Enter')
  }
}

test('Home ist Startseite: Datum, Stunden, Tageskalender mit geplanten Einträgen', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/')
  await importBackup(page)
  await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Mittwoch, 18. November' })).toBeVisible()
  await expect(page.getByTestId('home-week')).not.toHaveText(/^0h 00m/)
  // geplanter Eintrag von heute aus Organisation
  await expect(page.getByTestId('day-timeline').getByLabel('Physik 11:00–12:30')).toBeVisible()
})

test('Tasks oben/unten anlegen, umsortieren, Timer → Live-Block + Stunden, erledigt → unten', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/')
  await importBackup(page)
  const today0 = await page.getByTestId('home-today').textContent()

  await add(page, 'A', 'B') // Standard: oben
  expect(await openTitles(page)).toEqual(['B', 'A'])
  await page.getByRole('radio', { name: '↓ Unten' }).click()
  await add(page, 'C')
  expect(await openTitles(page)).toEqual(['B', 'A', 'C'])

  // C nach ganz oben ziehen
  const c = page.getByTestId('home-open').locator('[data-task]', { hasText: /^C/ })
  const top = (await page.getByTestId('home-open').locator('[data-task]').first().boundingBox())!
  const b = (await c.boundingBox())!
  await page.mouse.move(b.x + 40, b.y + 12)
  await page.mouse.down()
  await page.mouse.move(b.x + 50, b.y + 20)
  await page.mouse.move(top.x + 60, top.y + 4, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => openTitles(page)).toEqual(['C', 'B', 'A'])

  // Timer für C (Fach wählen) → nach 6 min Live-Block im Tageskalender, Stunden steigen
  await c.hover()
  await c.getByRole('button', { name: 'C starten' }).click()
  await page.getByRole('menuitemradio', { name: 'Mathe' }).click()
  await page.clock.runFor(6 * 60_000)
  await expect(page.getByTestId('day-timeline').locator('[data-tracked="live"]')).toHaveAccessibleName('Getrackt: C 15:00–jetzt')
  await expect(page.getByTestId('home-today')).not.toHaveText(today0!)

  // erledigt → wandert in „Erledigt“, Timer stoppt
  await c.getByRole('checkbox', { name: 'C erledigt' }).click()
  expect(await openTitles(page)).toEqual(['B', 'A'])
  expect(await doneTitles(page)).toEqual(['C'])
  await expect(page.getByTestId('day-timeline').locator('[data-tracked="live"]')).toHaveCount(0)
  await expect(page.getByTestId('day-timeline').getByLabel('Getrackt: C 15:00–15:06')).toBeVisible()

  // einklappen bleibt nach Neuladen
  await page.getByRole('button', { name: /Erledigt · 1/ }).click()
  await expect(page.getByTestId('home-done')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('home-done')).toHaveCount(0)
  expect(await openTitles(page)).toEqual(['B', 'A'])

  // gleiche Tasks im Plan
  await page.getByRole('link', { name: 'Plan', exact: true }).click()
  await expect(page.locator('[data-plan-day="2026-11-18"] [data-task]')).toHaveCount(3)
})
