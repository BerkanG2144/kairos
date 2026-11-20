import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { FIXTURE, freezeAt, importBackup, storedPlan } from './helpers.ts'

test('Klausur-Notizen: Kürzel, Toolbar, Checkliste – gespeichert und auf der Karte sichtbar', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#organisation')
  await importBackup(page)

  const card = page.getByRole('button', { name: 'Klausur HM I' })
  await card.click()
  const dlg = page.getByRole('dialog', { name: 'Notizen: HM I' })
  await expect(dlg.getByText('in 89 Tagen')).toBeVisible()

  // Eigenschaften: Fach zuordnen, Icon wählen
  await dlg.getByLabel('Fach').selectOption({ label: 'Mathe' })
  await dlg.getByRole('button', { name: 'Icon ändern' }).click()
  await dlg.getByRole('menuitemradio', { name: 'Rakete' }).click()

  const ed = dlg.getByRole('textbox', { name: 'Notizen' })
  await ed.click()
  const kb = page.keyboard
  await kb.type('# Themen')
  await kb.press('Enter')
  await kb.type('- Folgen')
  await kb.press('Enter')
  await kb.type('Reihen')
  await kb.press('Enter')
  await kb.press('Enter')
  await kb.type('[] Blatt 1')
  await kb.press('Enter')
  await kb.type('Blatt 2')
  await kb.press('Enter')
  await kb.press('Enter')
  await kb.type('Wichtig: ')
  await kb.press('Control+b')
  await kb.type('Epsilon')
  await kb.press('Control+b')

  await expect(ed.locator('h1')).toHaveText('Themen')
  await expect(ed.locator('ul:not([data-type]) > li')).toHaveText(['Folgen', 'Reihen'])
  const todos = ed.locator('ul[data-type="todo"] > li')
  await expect(todos).toHaveText(['Blatt 1', 'Blatt 2'])
  await expect(todos.first()).toHaveAttribute('data-checked', 'false')
  await expect(ed.locator('b')).toHaveText('Epsilon')
  await expect(dlg.getByRole('button', { name: 'Fett' })).toHaveAttribute('aria-pressed', 'false')

  // Checkbox anklicken → abgehakt
  const box = (await todos.first().boundingBox())!
  await page.mouse.click(box.x + 9, box.y + 12)
  await expect(todos.first()).toHaveAttribute('data-checked', 'true')

  // Toolbar: Zeile zur Überschrift 2, Trennlinie
  await ed.locator('p', { hasText: 'Wichtig' }).click()
  await dlg.getByLabel('Absatzformat').selectOption('h2')
  await expect(ed.locator('h2')).toContainText('Wichtig: Epsilon')
  await dlg.getByRole('button', { name: 'Trennlinie' }).click()
  await expect(ed.locator('hr')).toHaveCount(1)

  // Link per Strg+K
  await kb.type('Skript')
  await kb.press('Shift+Home')
  await kb.press('Control+k')
  await dlg.getByLabel('Link-Adresse').fill('example.org/hm1')
  await dlg.getByLabel('Link-Adresse').press('Enter')
  await expect(ed.locator('a')).toHaveAttribute('href', 'https://example.org/hm1')
  await expect(ed.locator('a')).toHaveText('Skript')

  // Verzögertes Speichern
  await page.clock.runFor(1000)
  await expect.poll(async () => (await storedPlan(page)).find((p) => p.id === 'e1') as { n?: string; ic?: string; act?: string } | undefined).toMatchObject({
    ic: 'rocket',
    n: expect.stringContaining('<ul data-type="todo"><li data-checked="true">Blatt 1</li><li data-checked="false">Blatt 2</li></ul>'),
  })

  // Schließen → Karte zeigt Icon, Checklisten-Stand und Vorschau
  await kb.press('Escape')
  await expect(dlg).toHaveCount(0)
  await expect(card.locator('svg').first()).toBeVisible()
  await expect(card.getByTestId('exam-notes')).toContainText('☑ 1/2')
  await expect(card.getByTestId('exam-notes')).toContainText('Themen Folgen Reihen')
  await expect(card).toContainText('Mathe · ')

  // Nach Neuladen alles noch da
  await page.reload()
  await page.getByRole('button', { name: 'Klausur HM I' }).click()
  const ed2 = page.getByRole('dialog', { name: 'Notizen: HM I' }).getByRole('textbox', { name: 'Notizen' })
  await expect(ed2.locator('h1')).toHaveText('Themen')
  await expect(ed2.locator('ul[data-type="todo"] > li').first()).toHaveAttribute('data-checked', 'true')
  await expect(ed2.locator('a')).toHaveAttribute('href', 'https://example.org/hm1')
})

test('Klausur-Notizen: Titel, Datum und Esc ohne Datenverlust; leere Notizen werden nicht gespeichert', async ({ page }) => {
  await freezeAt(page)
  await page.goto('/#organisation')
  await importBackup(page)
  await page.getByRole('button', { name: 'Klausur Experimentalphysik' }).click()
  const dlg = page.getByRole('dialog', { name: 'Notizen: Experimentalphysik' })
  await dlg.getByLabel('Titel').fill('Experimentalphysik I')
  await page.keyboard.press('Escape') // ohne blur – Titel muss trotzdem gespeichert werden
  await expect(dlg).toHaveCount(0)
  const card = page.getByRole('button', { name: 'Klausur Experimentalphysik I' })
  await expect(card).toBeVisible()
  await expect(card.getByTestId('exam-notes')).toHaveCount(0)

  // Datum in einen anderen Monat → Eintrag zieht um, Notizen bleiben
  await card.click()
  const dlg2 = page.getByRole('dialog', { name: 'Notizen: Experimentalphysik I' })
  await dlg2.getByRole('textbox', { name: 'Notizen' }).click()
  await page.keyboard.type('Optik wiederholen')
  await dlg2.getByLabel('Datum').fill('2027-03-03')
  await page.keyboard.press('Escape')
  await expect(card).toContainText('3. Mär 2027')
  await expect(card.getByTestId('exam-notes')).toContainText('Optik wiederholen')
  const stored = (await storedPlan(page)).find((p) => p.title === 'Experimentalphysik I') as { n?: string; d: string }
  expect(stored).toMatchObject({ d: '2027-03-03', n: '<p>Optik wiederholen</p>' })
})

test('Klausur-Notizen: HTML aus einem importierten Backup wird bereinigt', async ({ page }, info) => {
  const backup = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))
  backup.schema = 4
  backup.data.months['2027-01'] = {
    s: [],
    p: [
      {
        id: 'x1',
        type: 'klausur',
        title: 'Böse',
        d: '2027-01-20',
        n: '<p>ok<img src=x onerror="window.__xss=1"><script>window.__xss=2</script><a href="javascript:window.__xss=3">link</a><b onclick="x()">fett</b></p>',
      },
    ],
    u: 1,
  }
  const file = info.outputPath('backup-xss.json')
  fs.writeFileSync(file, JSON.stringify(backup))

  await freezeAt(page)
  await page.goto('/#organisation')
  await importBackup(page, file)
  await page.getByRole('button', { name: 'Klausur Böse' }).click()
  const ed = page.getByRole('dialog', { name: 'Notizen: Böse' }).getByRole('textbox', { name: 'Notizen' })
  await expect(ed).toContainText('oklinkfett')
  expect(await ed.innerHTML()).toBe('<p>ok' + 'link<b>fett</b></p>')
  expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
})
