import { expect, test, type Page } from '@playwright/test'
import { freezeAt, importBackup, storedPlan } from './helpers.ts'

const PX = 54
const H0 = 0

/** y-Koordinate einer Uhrzeit in einer Tagesspalte. */
async function at(page: Page, day: string, h: number, m = 0) {
  const box = (await page.locator(`[data-col="${day}"]`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + (h - H0 + m / 60) * PX }
}

test.describe('Organisation (Maus)', () => {
  test.skip(({ isMobile }) => isMobile, 'Drag & Drop nur mit Maus')

  test.beforeEach(async ({ page }) => {
    await freezeAt(page)
    await page.goto('/#organisation')
    await page.getByRole('button', { name: 'Woche' }).click()
    await page.getByTestId('week-scroll').evaluate((el) => (el.scrollTop = 6 * 54)) // ab 06:00 sichtbar
  })

  test('Block per Drag anlegen und verschieben', async ({ page }) => {
    const a = await at(page, '2026-11-19', 7)
    const b = await at(page, '2026-11-19', 9)
    await page.mouse.move(a.x, a.y + 2)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 6 })
    await expect(page.getByTestId('drag-ghost')).toHaveText('07:00–09:00')
    await page.mouse.up()

    const dlg = page.getByRole('dialog')
    await expect(dlg.locator('input[type=time]').first()).toHaveValue('07:00')
    await expect(dlg.locator('input[type=time]').nth(1)).toHaveValue('09:00')
    await dlg.getByLabel('Titel').fill('Lernblock')
    await dlg.getByRole('button', { name: 'Speichern' }).click()
    const blk = page.locator('[data-col="2026-11-19"] [data-item]')
    await expect(blk).toContainText('07:00–09:00')

    // auf Freitag, eine Stunde später ziehen
    const box = (await blk.boundingBox())!
    const fri = await at(page, '2026-11-20', 8)
    await page.mouse.move(box.x + 10, box.y + 10)
    await page.mouse.down()
    await page.mouse.move(fri.x, box.y + 10 + PX, { steps: 8 })
    await page.mouse.up()
    await expect(page.locator('[data-col="2026-11-19"] [data-item]')).toHaveCount(0)
    await expect(page.locator('[data-col="2026-11-20"] [data-item]')).toContainText('08:00–10:00')

    // unteren Rand 30 min nach unten
    const fb = (await page.locator('[data-col="2026-11-20"] [data-item]').boundingBox())!
    await page.mouse.move(fb.x + 10, fb.y + fb.height - 2)
    await page.mouse.down()
    await page.mouse.move(fb.x + 10, fb.y + fb.height - 2 + PX / 2, { steps: 5 })
    await page.mouse.up()
    await expect(page.locator('[data-col="2026-11-20"] [data-item]')).toContainText('08:00–10:30')

    expect((await storedPlan(page)).map((i) => [i.title, i.d, i.t, i.e])).toEqual([['Lernblock', '2026-11-20', '08:00', '10:30']])
  })

  test('Serie anlegen und „alle folgenden“ löschen', async ({ page }) => {
    const p = await at(page, '2026-11-21', 10, 20)
    await page.mouse.click(p.x, p.y)
    const dlg = page.getByRole('dialog')
    await expect(dlg.locator('input[type=time]').first()).toHaveValue('10:15')
    await dlg.getByRole('button', { name: 'Termin' }).click()
    await dlg.getByLabel('Titel').fill('Tutorium')
    await dlg.getByRole('checkbox').check()
    await dlg.getByLabel('Letzter Termin der Serie').fill('2026-12-12')
    await dlg.getByRole('button', { name: 'Speichern' }).click()

    let plan = await storedPlan(page)
    expect(plan.map((i) => i.d).sort()).toEqual(['2026-11-21', '2026-11-28', '2026-12-05', '2026-12-12'])
    expect(new Set(plan.map((i) => i.g)).size).toBe(1)

    await page.getByRole('button', { name: 'Weiter' }).click()
    await page.locator('[data-col="2026-11-28"] [data-item]').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Nur diesen' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Alle folgenden' }).click()

    plan = await storedPlan(page)
    expect(plan.map((i) => i.d)).toEqual(['2026-11-21'])
    await expect(page.locator('[data-col="2026-11-28"] [data-item]')).toHaveCount(0)
  })
})

test('Abgabe abhaken in der Seitenleiste', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#organisation')
  await page.getByRole('button', { name: '+ Eintrag' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByRole('button', { name: 'Abgabe', pressed: true })).toBeVisible()
  await dlg.getByLabel('Titel').fill('Blatt 5')
  await dlg.getByRole('button', { name: 'Speichern' }).click()

  const due = page.getByRole('region', { name: 'Fällig' })
  await expect(due).toContainText('heute 23:59')
  await due.getByRole('checkbox', { name: 'Blatt 5 erledigt' }).click()
  await expect(due.getByRole('checkbox', { name: 'Blatt 5 erledigt' })).toHaveAttribute('aria-checked', 'true')
  await expect(due).toContainText('✓')
})

test('Getrackte Zeit erscheint live im Kalender und bleibt danach stehen', async ({ page }) => {
  await freezeAt(page) // Mi 18.11. 15:00
  await page.goto('/#tracker')
  await importBackup(page)
  await page.getByRole('button', { name: 'Mathe', exact: true }).click()
  await page.clock.runFor(45 * 60_000)

  await page.getByRole('link', { name: 'Organisation' }).click()
  await page.getByRole('button', { name: 'Woche' }).click()
  const today = page.locator('[data-col="2026-11-18"]')
  const live = today.locator('[data-tracked="live"]')
  await expect(live).toHaveAccessibleName('Getrackt: Mathe 15:00–jetzt')
  const h1 = (await live.boundingBox())!.height
  expect(h1).toBeGreaterThan(PX * 0.7) // ~45 min

  // wächst mit
  await page.clock.runFor(30 * 60_000)
  await expect.poll(async () => (await live.boundingBox())!.height).toBeGreaterThan(h1 + PX * 0.4)

  // Timer stoppen → fester Block mit Endzeit
  await page.getByRole('link', { name: 'Tracker' }).click()
  await page.getByRole('button', { name: 'Stopp' }).click()
  await page.getByRole('link', { name: 'Organisation' }).click()
  await expect(today.locator('[data-tracked="live"]')).toHaveCount(0)
  await expect(today.locator('[data-tracked="done"]', { hasText: '15:00–16:15' })).toHaveAccessibleName('Getrackt: Mathe 15:00–16:15')
  // frühere Sessions der Woche aus dem Backup sind ebenfalls da
  expect(await page.locator('[data-tracked="done"]').count()).toBeGreaterThan(1)
})

test('Hover-Karte im Wochenkalender: ↗ öffnet den Task, Klick legt keinen Eintrag an', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/')
  await importBackup(page)
  const input = page.getByRole('textbox', { name: 'Task für heute hinzufügen' })
  await input.fill('Blatt 1')
  await input.press('Enter')
  const card = page.locator('[data-task]', { hasText: 'Blatt 1' })
  await card.hover()
  await card.getByRole('button', { name: 'Blatt 1 starten' }).click()
  await page.getByRole('menuitemradio', { name: 'Mathe' }).click()
  await page.clock.runFor(10 * 60_000)
  await card.getByRole('button', { name: 'Blatt 1 stoppen' }).click()

  await page.goto('/#organisation')
  const before = (await storedPlan(page)).length
  await page.getByLabel('Getrackt: Blatt 1 15:00–15:10').hover()
  await page.clock.runFor(200)
  const pop = page.getByRole('dialog', { name: 'Getrackt: Blatt 1' })
  await expect(pop).toContainText('Mi 15:00 – 15:10 · 10m')
  await pop.getByRole('button', { name: 'Löschen' }).click()
  await pop.getByRole('button', { name: 'Abbrechen' }).click()
  await pop.getByRole('button', { name: 'Task öffnen' }).click()
  const editor = page.getByRole('dialog', { name: 'Task bearbeiten' })
  await expect(editor).toBeVisible()
  await editor.getByRole('textbox').first().click()
  await page.keyboard.press('Escape')
  await expect(editor).toHaveCount(0)
  expect((await storedPlan(page)).length).toBe(before)
  await expect(page.getByLabel('Getrackt: Blatt 1 15:00–15:10')).toBeVisible()
})
