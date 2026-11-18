import type { ReactNode } from 'react'
import { cx } from './cx.ts'
import ui from './ui.module.css'

type Props = {
  prev: () => void
  next: () => void
  prevLabel: string
  nextLabel: string
  /** Klick aufs Label → heute */
  onLabel?: () => void
  labelTitle?: string
  children?: ReactNode
  className?: string
  labelClassName?: string
}

/** ‹ Label › */
export function Nav({ prev, next, prevLabel, nextLabel, onLabel, labelTitle, children, className, labelClassName }: Props) {
  return (
    <div className={cx(ui.nav, className)}>
      <button type="button" onClick={prev} aria-label={prevLabel}>
        ‹
      </button>
      {children != null && (
        <button type="button" className={cx(ui.navLabel, labelClassName)} onClick={onLabel} title={labelTitle}>
          {children}
        </button>
      )}
      <button type="button" onClick={next} aria-label={nextLabel}>
        ›
      </button>
    </div>
  )
}
