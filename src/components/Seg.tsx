import { cx } from './cx.ts'
import ui from './ui.module.css'

type Props<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}

/** Segment-Schalter (z. B. 7 Tage / 30 Tage / …). */
export function Seg<T extends string>({ options, value, onChange, label, className }: Props<T>) {
  return (
    <div className={cx(ui.seg, className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={cx(o.value === value && ui.segOn)} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
