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
  // geplanter Eintrag von heute aus dem Kalender
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

test('Live-Block ist sofort da; vor 5 min beendet verschwindet er, danach bleibt er', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#tracker')
  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('Mathe')
  await page.keyboard.press('Enter')
  await page.getByRole('link', { name: 'Home' }).click()
  await add(page, 'Kurz')
  const card = page.getByTestId('home-open').locator('[data-task]', { hasText: 'Kurz' })
  const timeline = page.getByTestId('day-timeline')

  await card.hover()
  await card.getByRole('button', { name: 'Kurz starten' }).click()
  await page.getByRole('menuitemradio', { name: 'Mathe' }).click()
  await page.clock.runFor(1000)
  await expect(timeline.locator('[data-tracked="live"]')).toHaveAccessibleName('Getrackt: Kurz 15:00–jetzt')

  await page.clock.runFor(3 * 60_000)
  await card.getByRole('button', { name: 'Kurz stoppen' }).click()
  await expect(timeline.locator('[data-tracked]')).toHaveCount(0)

  // nach 2 min Pause neu starten (≤ 1 min Lücke würde mit der kurzen Session verschmelzen)
  await page.clock.runFor(2 * 60_000)
  await card.getByRole('button', { name: 'Kurz starten' }).click()
  await page.clock.runFor(6 * 60_000)
  await card.getByRole('button', { name: 'Kurz stoppen' }).click()
  await expect(timeline.locator('[data-tracked="done"]')).toHaveAccessibleName('Getrackt: Kurz 15:05–15:11')
})

test('Nachts getrackte Zeit ist im Tageskalender sichtbar (00:30)', async ({ page }) => {
  await freezeAt(page, new Date('2026-11-19T00:30:00+01:00'))
  await page.goto('/#tracker')
  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('LA 2')
  await page.keyboard.press('Enter')
  await page.getByRole('link', { name: 'Home' }).click()
  await add(page, 'MINT Blatt')
  const card = page.getByTestId('home-open').locator('[data-task]', { hasText: 'MINT Blatt' })
  await card.hover()
  await card.getByRole('button', { name: 'MINT Blatt starten' }).click()
  await page.getByRole('menuitemradio', { name: 'LA 2' }).click()
  await page.clock.runFor(10 * 60_000)
  await page.reload() // Kalender scrollt beim Öffnen zur aktuellen Uhrzeit
  const live = page.getByTestId('day-timeline').locator('[data-tracked="live"]')
  await expect(live).toHaveAccessibleName('Getrackt: MINT Blatt 00:30–jetzt')
  await expect(live).toBeInViewport()
})

test.describe('Animation', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('Abhaken: Karte wird grau und fliegt nach unten in „Erledigt“', async ({ page }) => {
    await freezeAt(page)
    await page.goto('/')
    await page.getByRole('radio', { name: '↓ Unten' }).click()
    await add(page, 'Erster', 'Zweiter', 'Dritter')
    const first = page.getByTestId('home-open').locator('[data-task]', { hasText: 'Erster' })
    await first.getByRole('checkbox', { name: 'Erster erledigt' }).click()
    const card = page.getByTestId('home-done').locator('[data-task]', { hasText: 'Erster' })
    await expect(card).toHaveAttribute('data-done', 'true')
    // läuft gerade eine Bewegung von oben nach unten (Start oberhalb der Endposition)?
    const anim = await card.evaluate((el) =>
      el
        .getAnimations()
        .map((a) => ({ transform: String((a.effect as KeyframeEffect).getKeyframes()[0]?.transform), delay: a.effect!.getTiming().delay }))
        .filter((a) => a.transform.startsWith('translate')),
    )
    expect(anim).toHaveLength(1)
    expect(anim[0]!.transform).toMatch(/translate\(0px, -\d+(\.\d+)?px\)/)
    expect(anim[0]!.delay).toBeGreaterThan(0)
    // ausgegraut (nach dem Übergang; Maus weg, sonst greift der Hover-Zustand)
    await page.mouse.move(5, 5)
    await page.clock.runFor(1000)
    await expect.poll(() => card.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.5')
  })
})

test('Hover über getrackten Block: Details, Stoppen, Löschen mit Rückfrage', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/')
  await importBackup(page)
  await add(page, 'Blatt 1')
  const card = page.getByTestId('home-open').locator('[data-task]', { hasText: 'Blatt 1' })
  await card.hover()
  await card.getByRole('button', { name: 'Blatt 1 starten' }).click()
  await page.getByRole('menuitemradio', { name: 'Mathe' }).click()
  await page.clock.runFor(12 * 60_000)

  const timeline = page.getByTestId('day-timeline')
  const pop = page.getByRole('dialog', { name: 'Getrackt: Blatt 1' })
  await timeline.locator('[data-tracked="live"]').hover()
  await page.clock.runFor(200)
  await expect(pop).toBeVisible()
  await expect(pop).toContainText('Mathe')
  await expect(pop).toContainText('Mi 15:00 – jetzt · 12m')
  await pop.getByRole('button', { name: '■ Stoppen' }).click()
  await expect(card.getByRole('button', { name: 'Blatt 1 starten' })).toBeAttached()

  // beendeter Block: Löschen erst nach Rückfrage; Maus kann vom Block in die Karte wandern
  const block = timeline.getByLabel('Getrackt: Blatt 1 15:00–15:12')
  await page.mouse.move(5, 5)
  await page.clock.runFor(300)
  await expect(pop).toHaveCount(0)
  await block.hover()
  await page.clock.runFor(200)
  await expect(pop).toContainText('Mi 15:00 – 15:12 · 12m')
  await pop.getByRole('button', { name: 'Löschen' }).hover()
  await page.clock.runFor(400)
  await pop.getByRole('button', { name: 'Löschen' }).click()
  const before = await page.getByTestId('home-today').textContent()
  await pop.getByRole('button', { name: 'Wirklich löschen' }).click()
  await expect(block).toHaveCount(0)
  await expect(pop).toHaveCount(0)
  await expect(page.getByTestId('home-today')).not.toHaveText(before!)
  // Task bleibt, nur die Zeit ist weg
  await expect(card).toBeVisible()
})
