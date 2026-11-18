import type { FolderDir } from './folder.ts'

/** Ordner im Speicher – für Tests. */
export function fakeFolder(name = 'Kairos', perm: 'granted' | 'prompt' = 'granted') {
  const files = new Map<string, string>()
  const state = { perm, failWith: null as string | null, writes: 0 }
  const dir: FolderDir = {
    name,
    async getFileHandle(file) {
      return {
        async createWritable() {
          let buf = ''
          return {
            async write(d: string) {
              buf += d
            },
            async close() {
              if (state.failWith) throw new DOMException('fail', state.failWith)
              files.set(file, buf)
              state.writes++
            },
          }
        },
      }
    },
    async removeEntry(file) {
      files.delete(file)
    },
    async *keys() {
      yield* [...files.keys()]
    },
    async queryPermission() {
      return state.perm
    },
    async requestPermission() {
      state.perm = 'granted'
      return state.perm
    },
  }
  return { dir, files, state }
}
