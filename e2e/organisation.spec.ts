import { expect, test, type Page } from '@playwright/test'
import { freezeAt, storedPlan } from './helpers.ts'

const PX = 54
const H0 = 6

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
    await page.getByTestId('week-scroll').evaluate((el) => (el.scrollTop = 0))
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
