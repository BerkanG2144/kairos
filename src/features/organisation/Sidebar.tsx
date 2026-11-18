import { cx, vars } from '../../components/cx.ts'
import ui from '../../components/ui.module.css'
import { dueItems, examRows, todayItems, whenLabel } from '../../domain/agenda.ts'
import { allPlan, isTimed, itemColor, TYPES } from '../../domain/plan.ts'
import type { Act, PlanItem, State } from '../../domain/types.ts'
import { Check } from '../../components/Check.tsx'
import styles from './Sidebar.module.css'
import type { OrgActions } from './types.ts'

type RowOpts = { time?: boolean; when?: boolean; go?: (actId: string) => void }

function Row({ it, acts, actions, today, opts }: { it: PlanItem; acts: Act[]; actions: OrgActions; today: Date; opts: RowOpts }) {
  const c = itemColor(it, acts)
  const a = it.act ? acts.find((x) => x.id === it.act) : undefined
  const sub = [
    opts.time ? (isTimed(it) ? `${it.t}–${it.e}` : (it.t ?? '')) : '',
    it.type !== 'block' ? TYPES[it.type].label : '',
    a && a.name !== it.title ? a.name : '',
  ].filter(Boolean)
  const w = opts.when ? whenLabel(it, today) : null

  return (
    <div
      role="button"
      tabIndex={0}
      className={cx(styles.li, it.done && styles.done)}
      onClick={() => actions.open(it)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') actions.open(it)
      }}
      data-item={it.id}
    >
      {it.type === 'abgabe' ? (
        <Check on={!!it.done} color={c} label={`${it.title} erledigt`} onToggle={() => actions.toggleDone(it.id)} />
      ) : (
        <span className={cx(ui.dot, styles.dot)} style={{ background: c }} />
      )}
      <span className={styles.tt}>
        <b>{it.title}</b>
        {sub.length > 0 && <small>{sub.join(' · ')}</small>}
      </span>
      {w ? (
        <span className={cx(styles.when, w.tone === 'hot' && styles.hot, w.tone === 'warm' && styles.warm)}>{w.text}</span>
      ) : opts.go && a && !a.del ? (
        <button
          type="button"
          className={styles.go}
          style={vars({ '--c': a.c })}
          title={`${a.name} starten`}
          aria-label={`${a.name} starten`}
          onClick={(e) => {
            e.stopPropagation()
            opts.go?.(a.id)
          }}
        >
          ▶
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

type Props = { state: State; today: Date; actions: OrgActions; onGo: (actId: string) => void; className?: string }

export function Sidebar({ state, today, actions, onGo, className }: Props) {
  const all = allPlan(state)
  const acts = state.meta.acts
  const tdy = todayItems(all, today)
  const due = dueItems(all, today)
  const exams = examRows(all, today)

  return (
    <aside className={cx(styles.side, className)}>
      <section aria-label="Heute">
        <span className={cx(ui.label, styles.label)}>Heute</span>
        {tdy.length ? (
          tdy.map((it) => <Row key={it.id} it={it} acts={acts} actions={actions} today={today} opts={{ time: true, go: onGo }} />)
        ) : (
          <div className={styles.none}>Nichts geplant.</div>
        )}
      </section>
      <section aria-label="Fällig">
        <span className={cx(ui.label, styles.label)}>Fällig</span>
        {due.length ? (
          due.map((it) => <Row key={it.id} it={it} acts={acts} actions={actions} today={today} opts={{ when: true }} />)
        ) : (
          <div className={styles.none}>Keine offenen Abgaben in den nächsten 14 Tagen.</div>
        )}
      </section>
      <section aria-label="Klausuren">
        <span className={cx(ui.label, styles.label)}>Klausuren</span>
        <div className={styles.exs}>
          {exams.length ? (
            exams.map((r) => (
              <div
                key={r.it.id}
                role="button"
                tabIndex={0}
                className={cx(styles.exr, r.tone === 'urgent' && styles.urgent, r.tone === 'soon' && styles.soon)}
                onClick={() => actions.open(r.it)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') actions.open(r.it)
                }}
                data-item={r.it.id}
              >
                {r.word ? (
                  <div className={cx(styles.n, styles.word)}>{r.word}</div>
                ) : (
                  <div className={styles.n}>
                    {r.n}
                    <small>T</small>
                  </div>
                )}
                <div className={styles.exInfo}>
                  <b>{r.it.title}</b>
                  <small>{r.date}</small>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.none}>Keine anstehenden Klausuren.</div>
          )}
        </div>
      </section>
    </aside>
  )
}
