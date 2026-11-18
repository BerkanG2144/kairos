import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { IdbDeviceSettings } from './device.ts'

describe('IdbDeviceSettings', () => {
  it('get/set/del', async () => {
    const d = new IdbDeviceSettings(new IDBFactory())
    expect(await d.get('x')).toBeUndefined()
    await d.set('x', { a: 1 })
    expect(await d.get('x')).toEqual({ a: 1 })
    await d.del('x')
    expect(await d.get('x')).toBeUndefined()
  })
})
