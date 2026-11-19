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
    kpis[r] = await page.evaluate(() => ['#sTotal', '#sDays', '#sAvg'].map((s) => document.querySelector(s)!.textContent!))
  }
  const rows = (await page.locator('#sRows .srow').allInnerTexts()).map(norm)
  await page.evaluate(() => (location.hash = ''))
  await page.click('#dPrev') // gestern (letzter Tag im Backup)
  const day = (await page.textContent('#dTotal'))!
  const dayLegend = norm(await page.innerText('#dLegend'))
  await page.evaluate(() => (location.hash = '#organisation'))
  const side = await Promise.all(['#oToday', '#oDue', '#oExams'].map(async (s) => norm(await page.innerText(s))))
  return { kpis, rows, day, dayLegend, side }
}

async function appSnapshot(page: Page): Promise<Snapshot> {
  await page.goto('/#statistik')
  await importBackup(page)
  const kpis: Record<string, string[]> = {}
  for (const [r, label] of [['7', '7 Tage'], ['30', '30 Tage'], ['365', 'Jahr'], ['all', 'Gesamt']] as const) {
    await page.getByRole('button', { name: label }).click()
    kpis[r] = (await Promise.all(['kpi-total', 'kpi-days', 'kpi-avg'].map((id) => page.getByTestId(id).textContent()))) as string[]
  }
  const main = page.getByRole('main')
  const rows = (await main.locator('> div:nth-of-type(3) > div').allInnerTexts()).map(norm)
  // Tagesbilanz steht jetzt in der Statistik („Heute“)
  await page.getByRole('group', { name: 'Zeitraum' }).getByRole('button', { name: 'Heute' }).click()
  await page.getByRole('button', { name: 'Voriger Tag' }).click()
  const day = (await page.getByTestId('day-total').textContent())!
  const dayLegend = norm(await page.getByRole('region', { name: 'Tagesbilanz' }).locator('svg + div').innerText())
  await page.getByRole('link', { name: 'Organisation' }).click()
  const side = await Promise.all(
    ['Heute', 'Fällig', 'Klausuren'].map(async (name) => {
      const region = page.getByRole('region', { name })
      const label = await region.locator('> span').first().innerText()
      return norm((await region.innerText()).replace(label, ''))
    }),
  )
  return { kpis, rows, day, dayLegend, side }
}

test('Statistik und Organisation zeigen dieselben Zahlen wie die Legacy-Datei', async ({ browser }) => {
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
