import { useMemo, useState } from 'react'
import { navigate } from '../../app/route.ts'
import { cx } from '../../components/cx.ts'
import { Nav } from '../../components/Nav.tsx'
import { Seg } from '../../components/Seg.tsx'
import ui from '../../components/ui.module.css'
import { MONTHS } from '../../domain/constants.ts'
import { newDraft, newId, planByDay, toggleDone } from '../../domain/plan.ts'
import { weekLabel } from '../../domain/summary.ts'
import { addDays, dayKey, mondayOf, startOfDay } from '../../domain/time.ts'
import { start } from '../../domain/tracker.ts'
import type { PlanItem } from '../../domain/types.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import { useNow } from '../../state/useNow.ts'
import { usePref } from '../../state/usePref.ts'
import { MonthView } from './MonthView.tsx'
import styles from './Org.module.css'
import { Sidebar } from './Sidebar.tsx'
import type { OrgActions } from './types.ts'
import { WeekView } from './WeekView.tsx'

type View = 'week' | 'month'
const isView = (x: unknown): x is View => x === 'week' || x === 'month'

export type Editing = { it: PlanItem; isNew: boolean }

export function OrgPage() {
  const state = useAppState()
  const dispatch = useDispatch()
  // Jede Minute neu zeichnen (Jetzt-Linie, „heute“, Fälligkeiten).
  const now = useNow(true, 60_000)
  const today = new Date(now * 1000)
  const [view, setView] = usePref<View>('lernzeit.oview', 'week', isView)
  const [date, setDate] = useState(() => startOfDay(new Date()))
  const [, setEditing] = useState<Editing | null>(null)

  const plan = useMemo(() => planByDay(state), [state])
  const acts = state.meta.acts
  const monday = mondayOf(date)

  const actions: OrgActions = {
    open: (it) => setEditing({ it, isNew: false }),
    create: (d, type, t, e) => setEditing({ it: newDraft(newId(), d, type, t, e), isNew: true }),
    toggleDone: (id) => dispatch((s, n) => toggleDone(s, id, n)),
  }

  const go = (actId: string) => {
    dispatch((s, n) => start(s, actId, n))
    navigate('tracker')
  }

  const shift = (dir: 1 | -1) =>
    setDate(view === 'week' ? addDays(date, 7 * dir) : new Date(date.getFullYear(), date.getMonth() + dir, 1))

  const onAdd = () => {
    const viewingOtherWeek = view === 'week' && dayKey(monday) !== dayKey(mondayOf(today))
    actions.create(dayKey(viewingOtherWeek ? monday : today), 'abgabe')
  }

  const wl = weekLabel(monday)

  return (
    <main className={styles.org}>
      <div className={styles.orghead}>
        <Seg
          label="Ansicht"
          className={styles.seg}
          options={[
            { value: 'week', label: 'Woche' },
            { value: 'month', label: 'Monat' },
          ]}
          value={view}
          onChange={setView}
        />
        <Nav
          prev={() => shift(-1)}
          next={() => shift(1)}
          prevLabel="Zurück"
          nextLabel="Weiter"
          onLabel={() => setDate(startOfDay(new Date()))}
          labelTitle="Zu heute"
          labelClassName={styles.navLabel}
        >
          {view === 'week' ? (
            <>
              {wl.text}
              <small>KW {wl.kw}</small>
            </>
          ) : (
            `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
          )}
        </Nav>
        <button type="button" className={cx(ui.pill, styles.addp)} onClick={onAdd}>
          + Eintrag
        </button>
      </div>
      <div className={styles.orggrid}>
        <section aria-label="Kalender">
          {view === 'week' ? (
            <WeekView monday={monday} plan={plan} acts={acts} actions={actions} now={now} />
          ) : (
            <MonthView
              y={date.getFullYear()}
              m={date.getMonth()}
              plan={plan}
              acts={acts}
              actions={actions}
              today={today}
              onPickDay={(d) => {
                setDate(startOfDay(d))
                setView('week')
              }}
            />
          )}
        </section>
        <Sidebar state={state} today={today} actions={actions} onGo={go} />
      </div>
    </main>
  )
}
