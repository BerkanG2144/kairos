# Umzug: Legacy-HTML → Web-App

Referenz-Implementierung: `legacy/lernzeit-legacy.html` (vollständiger Stand, ~1400 Zeilen).
Bei Unklarheiten gilt: **so verhalten wie die Legacy-Datei.** Den Code dort, der `claude.use('db')`
bzw. `claude.use('user')` aufruft, ignorieren – das war nur Cloud-Sync der Claude-Artifact-Version.

## Phase 1 – Funktionsgleicher Port

Ziel: Berkan exportiert in der alten Datei ein Backup, importiert es in der neuen App und hat
exakt denselben Stand. Erst dann wird die alte Datei abgelöst.

### Tracker (Startseite)
- Fächer als Pills; „+“ legt ein Fach an (Farbe = erste unbenutzte aus der Palette). Gleicher Name
  wie ein gelöschtes Fach → wird reaktiviert. Löschen: × beim Hover (Touch: lange drücken),
  dann Inline-Bestätigung „löschen? ja / nein“. Soft delete (`del: true`), Historie bleibt.
- Klick auf Fach: startet Timer; Klick auf das laufende: stoppt; anderes Fach: wechselt
  (beendet die alte Session, startet neue). Session < 1 s wird verworfen.
- Pause-Button: startet Pause (`'_p'`), heißt dann „Weiter“ und setzt das letzte Fach fort.
  „Stopp“ nur sichtbar, wenn etwas läuft.
- Großer Timer HH:MM:SS, Tab-Titel zeigt Zeit + Fach.
- Laufender Timer überlebt Schließen/Neuladen (Start ist gespeichert).
- Lücken-Erkennung: War die Seite > 5 min zu bzw. der Rechner im Schlaf, während ein Timer lief,
  erscheint ein Toast: „Seite war X Min. zu – der Timer lief weiter.“ mit
  „Behalten“ / „Um HH:MM stoppen“ (stoppt rückwirkend zum letzten Lebenszeichen).
  Lebenszeichen alle 5 s + bei pagehide/visibilitychange.
- **Tagesbilanz** (dominant, unter dem Timer): Gesamtzeit, Kreisdiagramm, Liste mit Zeit und %
  pro Fach, Pause separat (zählt nicht als Lernzeit). Navigation ‹ › pro Tag, Klick aufs Label → heute.
- **Monatskalender** rechts: Tage mit ≥ 60 s Lernzeit grün, Deckkraft
  `0.32 + 0.68 * min(1, sek / 4h)`. Heute gelb umrandet, ausgewählter Tag weiß umrandet,
  aktuelle Woche leicht hinterlegt. Klick auf Tag → Tagesbilanz + Woche springen dorthin.
- **Woche** (kompakt, unter dem Kalender): Summe, dünner Farbbalken, kleine Liste.
- Sessions über Mitternacht werden für Tagesstatistiken am Tageswechsel aufgeteilt.

### Statistik
- Zeitraum: 7 Tage / 30 Tage / Jahr / Gesamt (gemerkt).
- KPIs: Lernzeit, Lerntage (≥ 60 s), Ø pro Lerntag, aktuelle Serie (ab heute oder gestern
  rückwärts) + Rekord-Serie (immer über alle Zeit).
- Pro Fach: Balken (relativ zum größten), Zeit, %, Anzahl Tage.
- Letzte 12 Wochen als gestapelte Säulen in Fachfarben, KW-Beschriftung, aktuelle Woche gelb.
- Läuft ein Timer, zeigt die Kopfzeile ihn klein an; Klick → Tracker.

### Organisation
- Ansichten Woche / Monat (gemerkt), Navigation ‹ › und Klick aufs Label → heute.
- **Woche**: Raster 06–24 Uhr, 54 px pro Stunde, Raster 15 min.
  - Ziehen auf freier Fläche → neuer Block (Editor öffnet sich vorausgefüllt); einfacher Klick → 1 h.
  - Block ziehen → verschieben (auch auf andere Tage); unterer Rand → Länge ändern;
    Klick → bearbeiten. Touch: nur Tippen (kein Drag, damit Scrollen geht).
  - Überlappende Blöcke nebeneinander (Lanes). Termin = gestrichelter Rahmen.
  - Rote Jetzt-Linie; beim Öffnen wird zur aktuellen Uhrzeit gescrollt.
  - Zeile „fällig“ über dem Raster für Abgaben, Klausuren und Einträge ohne Zeitspanne;
    Abgaben mit Checkbox. Spalten von Kopf, Fällig-Zeile und Raster müssen bündig sein.
- **Monat**: max. 3 Chips pro Tag + „+n weitere“, „+“ beim Hover legt Abgabe an,
  Klick auf Tag → Woche dieses Tages.
- **Editor** (Modal, mobil Bottom-Sheet): Typ, Titel, Fach, Datum, Von/Bis bzw. „Fällig um“
  (Default 23:59) / „Uhrzeit“. Leerer Titel → Fachname. Neue Einträge: „Wöchentlich bis“
  (Default +12 Wochen, max. 60). Löschen bei Serien: „Nur diesen“ / „Alle folgenden“.
- **Seitenleiste**:
  - Heute: alle Einträge von heute, Blöcke mit Fach haben ▶ (startet Timer, wechselt zum Tracker).
  - Fällig: offene Abgaben bis +14 Tage inkl. überfälliger, nach Datum; heute erledigte unten
    durchgestrichen. Label: überfällig / heute HH:MM / morgen HH:MM / Wochentag / „in n T“.
    Rosa ≤ 1 Tag, gelb ≤ 3 Tage.
  - Klausuren: Countdown in Tagen („Heute“/„Morgen“), gelb ≤ 7, rosa ≤ 1.
- Migration: `meta.exams` → Plan-Items vom Typ `klausur`, danach `exams` entfernen.

### Backup
- Kopfzeile rechts: „Backup“ (lädt JSON herunter) und „Import“ (Datei wählen → Bestätigungsleiste
  mit Datum, Anzahl Fächer/Einträge → ersetzt Daten).

### Abnahme Phase 1
- Echtes Backup aus der Legacy-Datei importiert → Tracker, Statistik und Organisation zeigen
  dieselben Zahlen wie die Legacy-Datei.
- Unit-Tests: Tages-Splitting über Mitternacht, Streaks, Wochen/KW, Fälligkeits-Labels,
  Lane-Layout, Migration `exams`, Backup-Parsing (beide Formate, ungültige Datei).
- E2E: Fach anlegen → Timer → Pause → Weiter → Neuladen (läuft weiter); Block per Drag anlegen
  und verschieben; Serie anlegen und „alle folgenden“ löschen; Import.
- Desktop und 390 px breit ohne horizontales Scrollen.

## Phase 2 – PWA & Hosting
- Manifest, Icons, Offline-Cache; GitHub Pages via Actions (Vite `base` setzen).
- Auf dem iPhone über Safari „Zum Home-Bildschirm“ testen.

## Phase 3 – Später
- Sync zwischen Geräten (Supabase o. ä., mit Login), Konfliktstrategie pro Monat/Item.
- Ideen, die Berkan noch einbringen will.
