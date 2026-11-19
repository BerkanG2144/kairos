import { useMemo, useState, type FormEvent } from 'react'
import { cx, vars } from '../../components/cx.ts'
import ui from '../../components/ui.module.css'
import { examRows, hoursDe, pastExamRows, progress, type ExamRow } from '../../domain/exams.ts'
import { allPlan, newId, saveItem } from '../../domain/plan.ts'
import { byDay as sessionsByDay } from '../../domain/sessions.ts'
import { dayKey } from '../../domain/time.ts'
import type { Act, ByDay } from '../../domain/types.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import { useNow } from '../../state/useNow.ts'
import { ItemEditor } from '../organisation/ItemEditor.tsx'
import styles from './Exams.module.css'

/** Verlauf der kumulierten Lernzeit (letzte 28 Tage) als kleine Linie mit Endpunkt. */
function Spark({ series, color }: { series: number[]; color: string }) {
  const W = 132
  const H = 38
  const max = Math.max(series.at(-1) ?? 0, 1)
  const min = series[0] ?? 0
  const span = Math.max(max - min, 1)
  const pts = series.map((v, i) => [(i / Math.max(series.length - 1, 1)) * (W - 4) + 2, H - 3 - ((v - min) / span) * (H - 8)] as const)
  const last = pts.at(-1)!
  return (
    <svg className={styles.spark} viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <polyline points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.8" fill={color} />
    </svg>
  )
}

function ExamCard({ r, act, byDay, today, past, onOpen }: { r: ExamRow; act?: Act; byDay: ByDay; today: Date; past?: boolean; onOpen: () => void }) {
  const color = act?.c ?? 'var(--mute)'
  const p = act ? progress(byDay, act.id, today) : null
  return (
    <button
      type="button"
      className={cx(styles.card, past && styles.past)}
      style={vars({ '--c': color })}
      onClick={onOpen}
      aria-label={`Klausur ${r.it.title}`}
      data-exam={r.it.id}
      data-upcoming={past ? undefined : ''}
    >
      <div className={styles.top}>
        <span className={styles.mono}>{(act?.name ?? r.it.title).slice(0, 1).toUpperCase()}</span>
        <span className={styles.titles}>
          <b>{r.it.title}</b>
          <small>
            {act ? `${act.name} · ` : ''}
            {r.date}
          </small>
        </span>
        <span className={cx(styles.count, r.tone === 'urgent' && styles.urgent, r.tone === 'soon' && styles.soon)} data-testid="exam-count">
          {past ? 'vorbei' : r.word ?? (
            <>
              {r.n}
              <small> Tage</small>
            </>
          )}
        </span>
      </div>
      {p ? (
        <div className={styles.bottom}>
          <div>
            <div className={styles.big} data-testid="exam-week">
              {hoursDe(p.week)}
            </div>
            <div className={ui.label}>Diese Woche</div>
          </div>
          <div className={styles.trend}>
            <Spark series={p.series} color={color} />
            <small data-testid="exam-total">{hoursDe(p.total)} insgesamt</small>
          </div>
        </div>
      ) : (
        <div className={styles.noact}>Kein Fach verknüpft – zum Zuordnen anklicken.</div>
      )}
    </button>
  )
}

/** Organisation: Klausuren anlegen; je Klausur eine Karte mit Countdown und Lern-Fortschritt im Fach. */
export function ExamsPage() {
  const state = useAppState()
  const dispatch = useDispatch()
  const now = useNow(true, state.meta.run ? 20_000 : 60_000)
  const today = new Date(now * 1000)
  const byDay = useMemo(() => sessionsByDay(state, now), [state, now])
  const all = allPlan(state)
  const upcoming = examRows(all, today)
  const past = pastExamRows(all, today)
  const acts = state.meta.acts.filter((a) => !a.del)
  const actOf = (id?: string) => state.meta.acts.find((a) => a.id === id)
  const [editing, setEditing] = useState<string | null>(null)
  const editItem = editing ? all.find((it) => it.id === editing) : undefined

  const [title, setTitle] = useState('')
  const [act, setAct] = useState('')
  const [d, setD] = useState('')
  const [t, setT] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const name = title.trim() || actOf(act)?.name || ''
    if (!name || !d) return
    dispatch((s, n) => saveItem(s, { id: newId(n), type: 'klausur', title: name.slice(0, 60), d, ...(t ? { t } : {}), ...(act ? { act } : {}) }, n))
    setTitle('')
    setAct('')
    setD('')
    setT('')
  }

  return (
    <main className={styles.page}>
      <div className={ui.head}>
        <span className={ui.label}>Organisation</span>
      </div>

      <form className={styles.form} onSubmit={onSubmit} autoComplete="off" aria-label="Klausur hinzufügen">
        <input className={styles.name} value={title} maxLength={60} placeholder="Klausur, z. B. HM I" aria-label="Name der Klausur" onChange={(e) => setTitle(e.target.value)} />
        <select value={act} aria-label="Fach" onChange={(e) => setAct(e.target.value)}>
          <option value="">Fach …</option>
          {acts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input type="date" value={d} aria-label="Datum" min={dayKey(today)} required onChange={(e) => setD(e.target.value)} />
        <input type="time" value={t} aria-label="Uhrzeit" onChange={(e) => setT(e.target.value)} />
        <button type="submit" className={styles.add} disabled={!d || !(title.trim() || act)}>
          + Klausur
        </button>
      </form>

      <div className={styles.sec}>
        <span className={ui.label}>Klausuren · {upcoming.length}</span>
      </div>
      {upcoming.length ? (
        <div className={styles.grid}>
          {upcoming.map((r) => (
            <ExamCard key={r.it.id} r={r} act={actOf(r.it.act)} byDay={byDay} today={today} onOpen={() => setEditing(r.it.id)} />
          ))}
        </div>
      ) : (
        <div className={ui.empty}>Keine anstehenden Klausuren. Oben anlegen – mit Fach, dann siehst du hier deinen Lernfortschritt.</div>
      )}

      {past.length > 0 && (
        <>
          <div className={styles.sec}>
            <span className={ui.label}>Vorbei · {past.length}</span>
          </div>
          <div className={styles.grid}>
            {past.map((r) => (
              <ExamCard key={r.it.id} r={r} act={actOf(r.it.act)} byDay={byDay} today={today} past onOpen={() => setEditing(r.it.id)} />
            ))}
          </div>
        </>
      )}

      {editItem && <ItemEditor key={editItem.id} it={editItem} isNew={false} onClose={() => setEditing(null)} />}
    </main>
  )
}
