import { describe, expect, it } from 'vitest'
import { CURRENT_FILE, KEEP_DAYS } from '../domain/autosave.ts'
import { fakeFolder } from './fakeFolder.ts'
import { writeFolderBackup } from './folder.ts'

describe('writeFolderBackup', () => {
  it('schreibt aktuellen Stand und Tageskopie', async () => {
    const { dir, files } = fakeFolder()
    await writeFolderBackup(dir, '{"x":1}', new Date('2026-11-18T15:00:00+01:00'))
    expect(Object.fromEntries(files)).toEqual({ [CURRENT_FILE]: '{"x":1}', 'kairos-2026-11-18.json': '{"x":1}' })
  })

  it('räumt alte Tageskopien auf, fremde Dateien bleiben', async () => {
    const { dir, files } = fakeFolder()
    for (let i = 1; i <= KEEP_DAYS + 2; i++) files.set(`kairos-2026-09-${String(i).padStart(2, '0')}.json`, 'alt')
    files.set('meine-notiz.txt', 'bleibt')
    await writeFolderBackup(dir, 'neu', new Date('2026-11-18T15:00:00+01:00'))
    const daily = [...files.keys()].filter((n) => /^kairos-\d/.test(n)).sort()
    expect(daily).toHaveLength(KEEP_DAYS)
    expect(daily.at(-1)).toBe('kairos-2026-11-18.json')
    expect(daily[0]).toBe('kairos-2026-09-04.json')
    expect(files.get('meine-notiz.txt')).toBe('bleibt')
  })
})
