/**
 * Abnahme Phase 1: Dasselbe Backup in Legacy-Datei und neuer App → gleiche Zahlen.
 */
import { expect, test, type Page } from '@playwright/test'
import { FIXTURE, freezeAt, importBackup, LEGACY } from './helpers.ts'

test.skip(({ isMobile }) => isMobile, 'Vergleich einmal auf Desktop reicht')

type Snapshot = {
  kpis: Record<string, string[]>
  rows: string[]
  day: string
  dayLegend: string
  week: string[]
  weekLegend: string
  side: string[]
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

async function legacySnapshot(page: Page): Promise<Snapshot> {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
  await page.goto('file://' + LEGACY)
  await page.setInputFiles('#bFile', FIXTURE)
  await page.click('#impYes')
  await page.evaluate(() => (location.hash = '#statistik'))
  const kpis: Record<string, string[]> = {}
  for (const r of ['7', '30', '365', 'all']) {
    await page.click(`#range button[data-r="${r}"]`)
    kpis[r] = await page.evaluate(() => ['#sTotal', '#sDays', '#sAvg', '#sStreak', '#sBest'].map((s) => document.querySelector(s)!.textContent!.replace('· Rekord ', '')))
  }
  const rows = (await page.locator('#sRows .srow').allInnerTexts()).map(norm)
  await page.evaluate(() => (location.hash = ''))
  await page.click('#dPrev') // gestern (letzter Tag im Backup)
  const day = (await page.textContent('#dTotal'))!
  const dayLegend = norm(await page.innerText('#dLegend'))
  const week: string[] = []
  for (let i = 0; i < 4; i++) {
    week.push((await page.textContent('#wTotal'))!)
    await page.click('#wPrev')
  }
  const weekLegend = norm(await page.innerText('#legend'))
  await page.evaluate(() => (location.hash = '#organisation'))
  const side = await Promise.all(['#oToday', '#oDue', '#oExams'].map(async (s) => norm(await page.innerText(s))))
  return { kpis, rows, day, dayLegend, week, weekLegend, side }
}

async function appSnapshot(page: Page): Promise<Snapshot> {
  await page.goto('/#statistik')
  await importBackup(page)
  const kpis: Record<string, string[]> = {}
  for (const [r, label] of [['7', '7 Tage'], ['30', '30 Tage'], ['365', 'Jahr'], ['all', 'Gesamt']] as const) {
    await page.getByRole('button', { name: label }).click()
    const v = await Promise.all(['kpi-total', 'kpi-days', 'kpi-avg', 'kpi-streak'].map((id) => page.getByTestId(id).textContent()))
    const best = (await page.getByText(/· Rekord/).textContent().catch(() => '')) ?? ''
    kpis[r] = [...(v as string[]), best.replace('· Rekord ', '')]
  }
  const main = page.getByRole('main')
  const rows = (await main.locator('> div:nth-of-type(3) > div').allInnerTexts()).map(norm)
  await page.getByRole('link', { name: 'Tracker' }).click()
  await page.getByRole('button', { name: 'Voriger Tag' }).click()
  const day = (await page.getByTestId('day-total').textContent())!
  const dayLegend = norm(await page.getByRole('region', { name: 'Tagesbilanz' }).locator('svg + div').innerText())
  const week: string[] = []
  for (let i = 0; i < 4; i++) {
    week.push((await page.getByTestId('week-total').textContent())!)
    await page.getByRole('button', { name: 'Vorige Woche' }).click()
  }
  const weekLegend = norm(await page.getByTestId('week-total').locator('xpath=following-sibling::div[2]').innerText())
  await page.getByRole('link', { name: 'Organisation' }).click()
  const side = await Promise.all(
    ['Heute', 'Fällig', 'Klausuren'].map(async (name) => {
      const region = page.getByRole('region', { name })
      const label = await region.locator('> span').first().innerText()
      return norm((await region.innerText()).replace(label, ''))
    }),
  )
  return { kpis, rows, day, dayLegend, week, weekLegend, side }
}

test('Tracker, Statistik und Organisation zeigen dieselben Zahlen wie die Legacy-Datei', async ({ browser }) => {
  const ctxL = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin', viewport: { width: 1280, height: 900 } })
  const ctxA = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin', viewport: { width: 1280, height: 900 } })
  const pl = await ctxL.newPage()
  const pa = await ctxA.newPage()
  await freezeAt(pl)
  await freezeAt(pa)

  const legacy = await legacySnapshot(pl)
  const app = await appSnapshot(pa)
  expect(legacy.rows.length).toBeGreaterThan(0)
  expect(legacy.side[0]).toContain('Sprechstunde')
  expect(legacy.side[1]).toContain('überfällig')
  expect(legacy.side[2]).toContain('HM I')
  expect(app).toEqual(legacy)
  await ctxL.close()
  await ctxA.close()
})
