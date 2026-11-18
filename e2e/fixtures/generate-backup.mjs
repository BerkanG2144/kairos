// Erzeugt ein deterministisches Beispiel-Backup im Legacy-Format (inkl. altem meta.exams).
// Nutzung: node e2e/fixtures/generate-backup.mjs > e2e/fixtures/backup-legacy.json
// Zeitzone: Europe/Berlin (TZ=Europe/Berlin setzen).

let seed = 42
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const pad = (n) => String(n).padStart(2, '0')
const sec = (y, m, d, h, mi) => Math.floor(new Date(y, m - 1, d, h, mi).getTime() / 1000)

const acts = [
  { id: 'a1', name: 'Mathe', c: '#c7b8f2' },
  { id: 'a2', name: 'Physik', c: '#a9e5c8' },
  { id: 'a3', name: 'Info', c: '#a8c8ec' },
  { id: 'a4', name: 'Französisch', c: '#f6c6a0', del: true },
  { id: 'a5', name: 'Chemie', c: '#f2a9bd' },
]
const months = {}
const push = (a, t0, t1) => {
  const d = new Date(t0 * 1000)
  const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  ;(months[k] ??= { s: [], u: 1763000000000 }).s.push([a, t0, t1])
}

// 1. Sept – 17. Nov 2026, an ~75 % der Tage gelernt
for (let day = new Date(2026, 8, 1); day < new Date(2026, 10, 18); day.setDate(day.getDate() + 1)) {
  if (rnd() < 0.25) continue
  const y = day.getFullYear(), m = day.getMonth() + 1, d = day.getDate()
  let t = sec(y, m, d, 9 + Math.floor(rnd() * 4), Math.floor(rnd() * 60))
  const blocks = 1 + Math.floor(rnd() * 4)
  for (let b = 0; b < blocks; b++) {
    const pool = day < new Date(2026, 9, 1) ? ['a1', 'a2', 'a4'] : ['a1', 'a2', 'a3', 'a5']
    const a = pool[Math.floor(rnd() * pool.length)]
    const len = 600 + Math.floor(rnd() * 5400)
    push(a, t, t + len)
    t += len
    if (b < blocks - 1) {
      const p = 120 + Math.floor(rnd() * 900)
      push('_p', t, t + p)
      t += p
    }
  }
}
// Session über Mitternacht und über Monatsgrenze
push('a1', sec(2026, 10, 31, 23, 20), sec(2026, 11, 1, 1, 5))

// Plan-Items
const p = (o) => {
  const k = o.d.slice(0, 7)
  ;((months[k] ??= { s: [], u: 1763000000000 }).p ??= []).push(o)
}
p({ id: 'p1', type: 'abgabe', title: 'Übungsblatt 5', act: 'a1', d: '2026-11-19', t: '12:00' })
p({ id: 'p2', type: 'abgabe', title: 'Praktikum', act: 'a3', d: '2026-11-16', t: '23:59' })
p({ id: 'p3', type: 'abgabe', title: 'Protokoll', act: 'a2', d: '2026-11-18', t: '10:00', done: true })
p({ id: 'p4', type: 'termin', title: 'Sprechstunde', d: '2026-11-18', t: '14:00', e: '15:00' })
for (let i = 0; i < 6; i++) {
  const d = new Date(2026, 10, 16 + 7 * i)
  p({ id: 'pb' + i, type: 'block', title: 'Mathe', act: 'a1', d: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, t: '10:00', e: '12:00', g: 'g1' })
}
p({ id: 'p5', type: 'block', title: 'Physik', act: 'a2', d: '2026-11-18', t: '11:00', e: '12:30' })

const data = {
  meta: {
    acts,
    run: null,
    last: 'a1',
    u: 1763000000000,
    exams: [
      { id: 'e1', name: 'HM I', d: '2027-02-15', t: '08:00' },
      { id: 'e2', name: 'Experimentalphysik', d: '2027-02-24' },
    ],
  },
  months,
}
process.stdout.write(JSON.stringify({ app: 'lernzeit', format: 1, exportedAt: '2026-11-17T20:15:00.000Z', data }, null, 1) + '\n')
