/**
 * Icons für Notizseiten (Linien-Icons in der Fachfarbe).
 * Pfade nach Lucide (https://lucide.dev), ISC-Lizenz, © Lucide Contributors.
 */
import type { ReactNode } from 'react'

export const NOTE_ICONS: Record<string, { label: string; svg: ReactNode }> = {
  rocket: {
    label: 'Rakete',
    svg: (
      <>
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </>
    ),
  },
  book: {
    label: 'Buch',
    svg: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
  },
  sigma: {
    label: 'Summe',
    svg: <path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2" />,
  },
  calculator: {
    label: 'Rechner',
    svg: (
      <>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
      </>
    ),
  },
  flask: {
    label: 'Kolben',
    svg: (
      <>
        <path d="M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.07-10.13A2 2 0 0 1 14 9.53V2" />
        <path d="M8.5 2h7M7 16h10" />
      </>
    ),
  },
  atom: {
    label: 'Atom',
    svg: (
      <>
        <circle cx="12" cy="12" r="1" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)" />
      </>
    ),
  },
  code: { label: 'Code', svg: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /> },
  cpu: {
    label: 'Chip',
    svg: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
      </>
    ),
  },
  chart: { label: 'Diagramm', svg: <path d="M3 3v16a2 2 0 0 0 2 2h16M19 9l-5 5-4-4-3 3" /> },
  globe: {
    label: 'Globus',
    svg: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
      </>
    ),
  },
  pencil: {
    label: 'Stift',
    svg: (
      <>
        <path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
        <path d="m15 5 4 4" />
      </>
    ),
  },
  cap: {
    label: 'Abschluss',
    svg: (
      <>
        <path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z" />
        <path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
      </>
    ),
  },
  zap: {
    label: 'Blitz',
    svg: <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
  },
  target: {
    label: 'Ziel',
    svg: (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
  },
}

/** Icon (falls bekannt) sonst Anfangsbuchstabe – Farbe über currentColor. */
export function NoteIcon({ ic, letter, size }: { ic?: string; letter: string; size: number }) {
  const def = ic ? NOTE_ICONS[ic] : undefined
  if (!def) return <span aria-hidden="true">{letter}</span>
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {def.svg}
    </svg>
  )
}
