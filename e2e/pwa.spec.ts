import { expect, test } from '@playwright/test'

// Hier soll der Service Worker laufen (in den übrigen Specs ist er blockiert).
test.use({ serviceWorkers: 'allow' })
test.skip(({ isMobile }) => isMobile, 'Offline-Verhalten ist unabhängig von der Bildschirmgröße')

test('Manifest und Icons sind erreichbar', async ({ page, request }) => {
  await page.goto('/#tracker')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const res = await request.get(new URL(href!, page.url()).href)
  expect(res.ok()).toBe(true)
  const manifest = await res.json()
  expect(manifest).toMatchObject({ name: 'Kairos', short_name: 'Kairos', display: 'standalone', lang: 'de' })
  for (const icon of manifest.icons as { src: string }[]) {
    const r = await request.get(new URL(icon.src, page.url()).href)
    expect(r.ok(), icon.src).toBe(true)
    expect(r.headers()['content-type']).toContain('image/png')
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  expect((await request.get(new URL(apple!, page.url()).href)).ok()).toBe(true)
})

test('App startet offline mit gespeicherten Daten', async ({ page, context }) => {
  await page.goto('/#tracker')
  // Warten, bis der Service Worker aktiv ist und die App-Shell vorgeladen hat.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await page.getByRole('button', { name: 'Fach hinzufügen' }).click()
  await page.getByLabel('Neues Fach').fill('Physik')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Physik', exact: true })).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Physik', exact: true })).toBeVisible()
  // Alle Seiten funktionieren offline (Hash-Routing, keine Nachladevorgänge).
  await page.getByRole('link', { name: 'Statistik' }).click()
  await expect(page.getByTestId('kpi-total')).toBeVisible()
  await page.getByRole('link', { name: 'Organisation' }).click()
  await expect(page.getByRole('region', { name: 'Heute' })).toBeVisible()
  // Schriften kommen aus dem Cache.
  expect(await page.evaluate(() => document.fonts.check('16px "Space Grotesk"'))).toBe(true)
  await context.setOffline(false)
})
