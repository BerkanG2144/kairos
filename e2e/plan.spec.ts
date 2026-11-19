import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectNoHorizontalScroll, freezeAt, importBackup, NOW } from './helpers.ts'

// NOW = Mi, 18.11.2026 15:00
const col = (page: Page, day: string) => page.locator(`[data-plan-day="${day}"]`)
const titles = (c: Locator) => c.locator('[data-task] > button:first-child').allTextContents()

async function add(page: Page, day: string, label: string, ...names: string[]) {
  const input = col(page, day).getByRole('textbox', { name: `Task hinzufügen am ${label}` })
  for (const n of names) {
    await input.fill(n)
    await input.press('Enter')
  }
}

/** Maus-Drag von einer Karte auf einen Punkt (Mitte einer anderen Karte, oder in eine Spalte). */
async function dragTo(page: Page, from: Locator, x: number, y: number) {
  const b = (await from.boundingBox())!
  await page.mouse.move(b.x + 30, b.y + 12)
  await page.mouse.down()
  await page.mouse.move(b.x + 40, b.y + 20)
  await page.mouse.move(x, y, { steps: 6 })
  await expect(page.getByTestId('task-ghost')).toBeVisible()
  await page.mouse.up()
}

test('Plan: Band mit heute, vergangene Tage ohne Eingabe', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#plan')
  await expect(page.getByRole('link', { name: 'Plan', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByTestId('plan-month')).toHaveText('November 2026')
  await expect(col(page, '2026-11-18')).toContainText('Heute')
  await expect(col(page, '2026-11-18').getByRole('textbox')).toBeVisible()
  await expect(col(page, '2026-11-17').getByRole('textbox')).toHaveCount(0)
  await expect(col(page, '2026-11-19')).toBeInViewport()
  await expectNoHorizontalScroll(page)
})

test('Tasks anlegen, Timer am Task, verschieben, abhaken, bleibt nach Neuladen', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#plan')
  await importBackup(page)
  const today = col(page, '2026-11-18')
  const tomorrow = col(page, '2026-11-19')

  await add(page, '2026-11-18', '18.11.', 'Blatt 3', 'Skript lesen', 'Altklausur')
  expect(await titles(today)).toEqual(['Blatt 3', 'Skript lesen', 'Altklausur'])

  // ▶ ohne Fach → Fach wählen → läuft
  const blatt = today.locator('[data-task]', { hasText: 'Blatt 3' })
  await blatt.hover()
  await blatt.getByRole('button', { name: 'Blatt 3 starten' }).click()
  await page.getByRole('menu', { name: 'Fach zum Starten' }).getByRole('menuitemradio', { name: 'Mathe' }).click()
  await expect(blatt.getByRole('button', { name: 'Blatt 3 stoppen' })).toBeVisible()
  await expect(blatt).toContainText('Mathe')
  await page.clock.runFor(65_000)
  await expect(blatt.getByTestId('task-time')).toHaveText('00:01:05')
  await expect(page).toHaveTitle('00:01:05 · Blatt 3')
  // Im Tracker ist es dieselbe Zeit beim Fach Mathe
  await page.getByRole('link', { name: 'Tracker' }).click()
  await expect(page.getByRole('timer')).toHaveText('00:01:05')
  await expect(page.getByRole('button', { name: 'Mathe', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: 'Plan', exact: true }).click()

  // umsortieren: Altklausur nach ganz oben – geht nur bis unter den laufenden Task
  const alt = today.locator('[data-task]', { hasText: 'Altklausur' })
  const top = (await blatt.boundingBox())!
  await dragTo(page, alt, top.x + 60, top.y + 4)
  await expect.poll(() => titles(today)).toEqual(['Blatt 3', 'Altklausur', 'Skript lesen'])

  // auf morgen verschieben
  const tb = (await tomorrow.boundingBox())!
  await dragTo(page, today.locator('[data-task]', { hasText: 'Skript lesen' }), tb.x + 100, tb.y + 140)
  await expect.poll(() => titles(tomorrow)).toEqual(['Skript lesen'])
  expect(await titles(today)).toEqual(['Blatt 3', 'Altklausur'])

  // in die Vergangenheit geht nicht
  const yb = (await col(page, '2026-11-17').boundingBox())!
  await dragTo(page, today.locator('[data-task]', { hasText: 'Altklausur' }), yb.x + 100, yb.y + 140)
  expect(await titles(today)).toEqual(['Blatt 3', 'Altklausur'])

  // abhaken stoppt den Timer, Zeit bleibt am Task (≥ 5 min – Kürzeres zählt nicht)
  await page.clock.runFor(5 * 60_000)
  await blatt.getByRole('checkbox', { name: 'Blatt 3 erledigt' }).click()
  await expect(blatt.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  await expect(blatt.getByTestId('task-time')).toHaveText('6m')
  await expect(page).toHaveTitle('Kairos')

  await page.reload()
  expect(await titles(col(page, '2026-11-18'))).toEqual(['Altklausur', 'Blatt 3']) // erledigt → unten
  expect(await titles(col(page, '2026-11-19'))).toEqual(['Skript lesen'])
})

test('Bearbeiten: umbenennen, Fach, anderer Tag, löschen', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#plan')
  await importBackup(page)
  await add(page, '2026-11-18', '18.11.', 'Zusammenfassung')
  await col(page, '2026-11-18').getByRole('button', { name: 'Zusammenfassung', exact: true }).click()
  const dlg = page.getByRole('dialog', { name: 'Task bearbeiten' })
  await dlg.getByLabel('Titel').fill('Zusammenfassung Kap. 4')
  await dlg.getByRole('radio', { name: 'Physik' }).click()
  await dlg.getByLabel('Tag').fill('2026-11-20')
  await dlg.getByRole('button', { name: 'Speichern' }).click()
  const card = col(page, '2026-11-20').locator('[data-task]', { hasText: 'Zusammenfassung Kap. 4' })
  await expect(card).toContainText('Physik')
  await expect(col(page, '2026-11-18').locator('[data-task]')).toHaveCount(0)

  await card.getByRole('button', { name: 'Zusammenfassung Kap. 4', exact: true }).click()
  await dlg.getByRole('button', { name: 'Löschen' }).click()
  await dlg.getByRole('button', { name: 'Löschen' }).click()
  await expect(page.locator('[data-task]')).toHaveCount(0)
})

test('Offene Tasks von gestern stehen am nächsten Tag oben', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#plan')
  await add(page, '2026-11-18', '18.11.', 'Offen', 'Erledigt')
  await add(page, '2026-11-19', '19.11.', 'Morgen geplant')
  await col(page, '2026-11-18').getByRole('checkbox', { name: 'Erledigt erledigt' }).click()

  await page.clock.setSystemTime(new Date(NOW.getTime() + 24 * 3600_000))
  await page.reload()
  await expect(col(page, '2026-11-19')).toContainText('Heute')
  expect(await titles(col(page, '2026-11-19'))).toEqual(['Offen', 'Morgen geplant'])
  expect(await titles(col(page, '2026-11-18'))).toEqual(['Erledigt'])
})

test('Navigationsleiste steht auf allen Seiten an derselben Stelle', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#plan')
  const pos: number[] = []
  for (const name of ['Home', 'Plan', 'Tracker', 'Statistik', 'Kalender', 'Organisation']) {
    await page.getByRole('link', { name, exact: true }).click()
    await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page')
    pos.push((await page.getByRole('link', { name: 'Home' }).boundingBox())!.x)
  }
  expect(new Set(pos).size).toBe(1)
})

test('Plan zeigt die Stunden dieser Woche – gleich wie Home', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/')
  await importBackup(page)
  const home = await page.getByTestId('home-week').textContent()
  expect(home).toMatch(/^\d+h \d\dm diese Woche$/)
  expect(home).not.toMatch(/^0h 00m/)
  await page.getByRole('link', { name: 'Plan', exact: true }).click()
  await expect(page.getByTestId('plan-week')).toHaveText(home!)
})

test('Laufender Task rückt nach oben und ist dort fix', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#plan')
  await importBackup(page)
  const today = col(page, '2026-11-18')
  await add(page, '2026-11-18', '18.11.', 'A', 'B', 'C')
  const c = today.locator('[data-task]', { hasText: /^C/ })
  await c.hover()
  await c.getByRole('button', { name: 'C starten' }).click()
  await page.getByRole('menuitemradio', { name: 'Mathe' }).click()
  await expect.poll(() => titles(today)).toEqual(['C', 'A', 'B'])

  // die laufende Karte lässt sich nicht ziehen
  const cb = (await c.boundingBox())!
  const bb = (await today.locator('[data-task]', { hasText: /^B/ }).boundingBox())!
  await page.mouse.move(cb.x + 30, cb.y + 12)
  await page.mouse.down()
  await page.mouse.move(bb.x + 40, bb.y + bb.height - 4, { steps: 6 })
  await expect(page.getByTestId('task-ghost')).toHaveCount(0)
  await page.mouse.up()
  expect(await titles(today)).toEqual(['C', 'A', 'B'])

  // gestoppt → wieder frei
  await c.getByRole('button', { name: 'C stoppen' }).click()
  await dragTo(page, today.locator('[data-task]', { hasText: /^B/ }), cb.x + 60, cb.y + 4)
  await expect.poll(() => titles(today)).toEqual(['B', 'C', 'A'])
})
