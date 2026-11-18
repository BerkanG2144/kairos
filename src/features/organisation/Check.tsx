import { cx, vars } from '../../components/cx.ts'
import styles from './Check.module.css'

/** Checkbox für Abgaben (Farbe über --c). */
export function Check({ on, color, onToggle, small, label }: { on: boolean; color: string; onToggle: () => void; small?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      className={cx(styles.ck, on && styles.on, small && styles.small)}
      style={vars({ '--c': color })}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}
