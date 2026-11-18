# Kairos – Projektkontext

Kairos (früher „Lernzeit“) ist die persönliche Lern- und Organisations-App von Berkan (Student, KIT). Ursprünglich eine einzelne
HTML-Datei (`legacy/lernzeit-legacy.html`), wird jetzt zu einer strukturierten Web-App (PWA)
umgebaut. Der Umzug ist in `PLAN.md` beschrieben.

Kommunikation mit Berkan auf Deutsch. UI-Texte auf Deutsch.

Interne Kennungen bleiben bewusst `lernzeit` (Backup-Feld `app: 'lernzeit'`, IndexedDB-Name,
localStorage-Keys), damit Backups mit der Legacy-Datei austauschbar bleiben.

## Stack

- Vite + React + TypeScript (strict)
- Styles: CSS Modules pro Komponente + eine globale `tokens.css`. **Keine globalen Klassennamen
  in Komponenten-CSS.** (In der Legacy-Datei hat genau das zu Fehlern geführt: Kalender-Klassen
  `.wk` und `.ghost` haben Tracker-Elemente überschrieben.)
- Persistenz: IndexedDB über eine kleine Storage-Schicht (`src/storage/`), hinter einem Interface,
  damit später ein Sync-Backend (z. B. Supabase) ergänzt werden kann
- PWA: `vite-plugin-pwa` (offline, installierbar auf iPhone und Desktop)
- Tests: Vitest (Logik) + Playwright (E2E)
- Hosting: GitHub Pages via GitHub Actions
- Möglichst wenige weitere Abhängigkeiten. Datumslogik selbst schreiben oder `date-fns`.

## Design

Minimalistisch, dunkel („Batman“), Pastell-Akzente. Kein Schnickschnack – nur was gebraucht wird.

```
--bg:#0c0d11  --panel:#14161c  --panel2:#1b1e25  --line:#23262e  --line2:#353945
--text:#e9e6df  --mute:#777b86  --dim:#3e424c
--signal:#f1e2a2 (gelb, Akzent/heute)  --mint:rgb(169,229,200) (Lerntage)  --pause:#b9b6c9
Dringend/überfällig: #f2a9bd
Fach-Farben (Reihenfolge der Vergabe):
#c7b8f2 #a9e5c8 #a8c8ec #f6c6a0 #f2a9bd #f1e2a2 #b3e0e6 #dcc3ea #cfe3a6
```

- Fonts: Space Grotesk (400/500) für Text, JetBrains Mono (200/300/400) für Zahlen/Zeiten.
  Lokal einbinden (`@fontsource/*`), damit die App offline funktioniert.
- Hintergrund: zwei sehr schwache radiale Verläufe (gelb oben rechts, lila unten links).
- Labels: 11 px, Großbuchstaben, letter-spacing .24em, `--mute`.
- Tracker/Statistik: max-width ~1120 px. Organisation: breiter (~1640 px), Schrift ~2 px größer,
  Seitenleiste 360 px mit Trennlinie. Berkan legt Wert darauf, dass es dort nicht gequetscht wirkt.
- Mobile ab < 880 px: einspaltig; in Organisation steht die Seitenleiste oben.

## Datenmodell (muss kompatibel zum Legacy-Backup bleiben)

```ts
type State = {
  meta: {
    acts: { id: string; name: string; c: string; del?: true }[]  // Fächer; del = soft delete
    run: { a: string; t: number } | null   // laufender Timer: Fach-ID oder '_p' (Pause), Start in Unix-Sekunden
    last: string | null                    // zuletzt gelerntes Fach (für "Weiter" nach Pause)
    u: number                              // updated-at (ms)
    exams?: { id; name; d; t? }[]          // LEGACY, wird zu Plan-Items migriert und entfernt
  }
  months: Record<'YYYY-MM', {
    s: [actId: string, startSec: number, endSec: number][]  // Sessions; '_p' = Pause
    p?: PlanItem[]                                          // Kalender-Einträge dieses Monats (nach Datum d)
    u: number
  }>
}
type PlanItem = {
  id: string
  type: 'block' | 'abgabe' | 'klausur' | 'termin'
  title: string
  act?: string            // Fach-ID → Farbe
  d: 'YYYY-MM-DD'
  t?: 'HH:MM'             // Start bzw. Fälligkeit
  e?: 'HH:MM'             // Ende (nur block/termin)
  done?: true             // nur abgabe
  g?: string              // Serien-ID (wöchentliche Wiederholung)
}
```

Backup-Datei (Export/Import): `{ app: 'lernzeit', format: 1, exportedAt: ISO, data: State }`.
Import muss auch ein nacktes `State`-Objekt akzeptieren.

Neues Schema bekommt eine Versionsnummer. Jede Schemaänderung = Migration mit Test. Alte Daten
dürfen nie verloren gehen.

## Konventionen

- Fachliche Logik (Statistik, Tages-Splitting, Streaks, Fälligkeiten, Migration) als reine
  Funktionen in `src/domain/`, mit Unit-Tests. Komponenten bleiben dünn.
- Zeitstempel von Sessions in Sekunden, lokale Zeitzone für alle Tagesgrenzen.
- Vor jedem Commit: `npm run test` und `npm run build` müssen grün sein.
