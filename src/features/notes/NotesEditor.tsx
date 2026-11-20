/**
 * Notiz-Editor im Stil von Notion: ein contentEditable-Bereich mit Toolbar, Markdown-Kürzeln
 * am Zeilenanfang und Checklisten. Unkontrolliert – der Inhalt wird beim Öffnen einmal gesetzt
 * (Komponente per key je Eintrag neu mounten) und verzögert, bereinigt über onSave gespeichert.
 *
 * Kürzel: „# “ „## “ „### “ Überschriften · „- “/„* “ Liste · „1. “ Nummeriert · „[] “ Checkliste
 *         „> “ Zitat · „---“ Trennlinie · „```“ Code-Block
 * Tasten: Strg+B/I/U · Strg+Shift+S durchgestrichen · Strg+E Code · Strg+K Link · Tab/Shift+Tab
 *         einrücken · Strg+Klick öffnet einen Link
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { cx, vars } from '../../components/cx.ts'
import { safeUrl, sanitizeNotes } from './sanitize.ts'
import styles from './NotesEditor.module.css'

type BlockTag = 'p' | 'h1' | 'h2' | 'h3' | 'blockquote' | 'pre'
type ListKind = 'ul' | 'ol' | 'todo'

const BLOCK_OPTIONS: { value: BlockTag; label: string }[] = [
  { value: 'p', label: 'Text' },
  { value: 'h1', label: 'Überschrift 1' },
  { value: 'h2', label: 'Überschrift 2' },
  { value: 'h3', label: 'Überschrift 3' },
  { value: 'blockquote', label: 'Zitat' },
  { value: 'pre', label: 'Code-Block' },
]

type Fmt = { block: BlockTag; b: boolean; i: boolean; s: boolean; code: boolean; link: boolean; list: ListKind | null; inPre: boolean }
const NO_FMT: Fmt = { block: 'p', b: false, i: false, s: false, code: false, link: false, list: null, inPre: false }

/** Wartezeit nach der letzten Eingabe bis zum Speichern. */
export const NOTES_SAVE_DELAY_MS = 400

const exec = (cmd: string, val?: string): boolean => document.execCommand(cmd, false, val)
const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const TODO = 'ul[data-type="todo"]'

/** Element an der Einfügemarke (Textknoten → Elternelement), nur innerhalb von root. */
function caretEl(root: HTMLElement): Element | null {
  const sel = getSelection()
  if (!sel?.rangeCount) return null
  const r = sel.getRangeAt(0)
  let n: Node | null = r.startContainer
  if (n === root) n = root.childNodes[Math.min(r.startOffset, root.childNodes.length - 1)] ?? root
  if (n && n.nodeType !== Node.ELEMENT_NODE) n = n.parentNode
  return n && root.contains(n) ? (n as Element) : null
}

const within = (root: HTMLElement, el: Element | null, sel: string): Element | null => {
  const f = el?.closest(sel)
  return f && f !== root && root.contains(f) ? f : null
}

/** Direktes Kind von root, das n enthält. */
function topBlock(root: HTMLElement, n: Node): Element | null {
  let x: Node | null = n
  while (x && x.parentNode !== root) x = x.parentNode
  return x && x.nodeType === Node.ELEMENT_NODE ? (x as Element) : null
}

/** Text vom Anfang des Blocks bis zur Einfügemarke (als Range zum Löschen). */
function rangeToCaret(block: Element): Range | null {
  const sel = getSelection()
  if (!sel?.rangeCount || !sel.isCollapsed) return null
  const r = document.createRange()
  r.setStart(block, 0)
  r.setEnd(sel.anchorNode!, sel.anchorOffset)
  return r
}

const isEmpty = (root: HTMLElement): boolean => !root.textContent && !root.querySelector('hr,li,pre')

const listKind = (l: Element): ListKind => (l.tagName === 'OL' ? 'ol' : l.matches(TODO) ? 'todo' : 'ul')

function newList(kind: ListKind): HTMLElement {
  const l = document.createElement(kind === 'ol' ? 'ol' : 'ul')
  if (kind === 'todo') l.setAttribute('data-type', 'todo')
  return l
}

function newItem(kind: ListKind): HTMLElement {
  const li = document.createElement('li')
  if (kind === 'todo') li.setAttribute('data-checked', 'false')
  return li
}

/** DOM umbauen, ohne dass die Einfügemarke verloren geht (verschobene Knoten setzen sie sonst zurück). */
function keepSelection(fn: () => Node | void) {
  const sel = getSelection()
  const saved = sel?.rangeCount ? { a: sel.anchorNode, ao: sel.anchorOffset, f: sel.focusNode, fo: sel.focusOffset } : null
  const fallback = fn()
  if (!sel) return
  if (saved?.a?.isConnected && saved.f?.isConnected) {
    try {
      sel.setBaseAndExtent(saved.a, saved.ao, saved.f, saved.fo)
      return
    } catch {
      /* Knoten passt nicht mehr */
    }
  }
  // Einfügemarke lag in einem entfernten Knoten → an den Anfang des neuen Blocks
  if (fallback?.isConnected) sel.collapse(fallback, 0)
}

/** Ganze Liste in eine andere Art umwandeln (ul ↔ ol ↔ Checkliste). */
function retagList(list: Element, kind: ListKind) {
  let l = list
  const tag = kind === 'ol' ? 'OL' : 'UL'
  if (l.tagName !== tag) {
    l = newList(kind)
    l.append(...Array.from(list.childNodes))
    list.replaceWith(l)
  }
  if (kind === 'todo') l.setAttribute('data-type', 'todo')
  else l.removeAttribute('data-type')
  for (const li of Array.from(l.children)) {
    if (li.tagName !== 'LI') continue
    if (kind === 'todo') {
      if (!li.hasAttribute('data-checked')) li.setAttribute('data-checked', 'false')
    } else li.removeAttribute('data-checked')
  }
}

/** Einen Listenpunkt zu normalem Text machen; die Liste wird dort geteilt (wie Notion). Gibt den neuen Block zurück. */
function liToParagraph(li: Element): Element {
  const list = li.parentElement!
  const after = Array.from(list.children).slice(Array.from(list.children).indexOf(li) + 1)
  const p = document.createElement('p')
  const nested = Array.from(li.children).filter((c) => c.tagName === 'UL' || c.tagName === 'OL')
  p.append(...Array.from(li.childNodes).filter((n) => !nested.includes(n as Element)))
  if (!p.firstChild) p.innerHTML = '<br>'
  const parentLi = list.parentElement?.closest('li')
  if (parentLi) {
    // verschachtelt: eine Ebene höher statt ganz aus der Liste
    const item = document.createElement('li')
    if (parentLi.parentElement?.matches(TODO)) item.setAttribute('data-checked', 'false')
    item.append(...Array.from(p.childNodes), ...nested)
    parentLi.after(item)
    if (after.length) {
      const rest = list.cloneNode(false) as Element
      rest.append(...after)
      item.append(rest)
    }
    li.remove()
    if (!list.children.length) list.remove()
    return item
  }
  list.after(p)
  p.after(...nested)
  if (after.length) {
    const rest = list.cloneNode(false) as Element
    rest.append(...after)
    ;(nested.at(-1) ?? p).after(rest)
  }
  li.remove()
  if (!list.children.length) list.remove()
  return p
}

/** Tab: Punkt wird Unterpunkt des Punkts davor (gleiche Listenart). */
function indentItem(li: Element) {
  const prev = li.previousElementSibling
  if (prev?.tagName !== 'LI') return
  let sub = Array.from(prev.children).findLast((c) => c.tagName === 'UL' || c.tagName === 'OL')
  if (!sub) {
    sub = li.parentElement!.cloneNode(false) as Element
    prev.append(sub)
  }
  sub.append(li)
  // eigene Unterpunkte bleiben direkt darunter
  const own = Array.from(li.children).filter((c) => c.tagName === 'UL' || c.tagName === 'OL')
  for (const o of own) {
    li.after(...Array.from(o.children))
    o.remove()
  }
}

/**
 * Struktur aufräumen, die Chrome beim Bearbeiten erzeugt: Blöcke in Absätzen (<p><ul>…</ul></p>)
 * werden herausgelöst, leere Listen entfernt.
 */
function tidy(root: HTMLElement) {
  const bad = Array.from(root.querySelectorAll('p')).filter((p) => p.querySelector(':scope > :is(p,ul,ol,h1,h2,h3,blockquote,pre,hr)'))
  if (!bad.length) return
  keepSelection(() => {
    for (const p of bad) {
      let run: HTMLElement | null = null
      for (const c of Array.from(p.childNodes)) {
        if (c.nodeType === Node.ELEMENT_NODE && (c as Element).matches('p,ul,ol,h1,h2,h3,blockquote,pre,hr')) {
          run = null
          p.before(c)
        } else {
          if (!run) {
            if (c.nodeType === Node.TEXT_NODE && !c.textContent?.trim()) continue
            run = document.createElement('p')
            p.before(run)
          }
          run.append(c)
        }
      }
      p.remove()
    }
  })
}

function readFmt(root: HTMLElement): Fmt | null {
  const el = caretEl(root)
  if (!el) return null
  const blk = within(root, el, 'pre') ?? within(root, el, 'blockquote') ?? within(root, el, 'h1,h2,h3')
  const list = within(root, el, 'ul,ol')
  return {
    block: (blk?.tagName.toLowerCase() as BlockTag | undefined) ?? 'p',
    b: document.queryCommandState('bold'),
    i: document.queryCommandState('italic'),
    s: document.queryCommandState('strikeThrough'),
    code: !!within(root, el, 'code'),
    link: !!within(root, el, 'a'),
    list: !list ? null : list.tagName === 'OL' ? 'ol' : list.matches(TODO) ? 'todo' : 'ul',
    inPre: blk?.tagName === 'PRE',
  }
}

type Props = {
  /** gespeicherter Inhalt beim Öffnen */
  html: string
  /** Akzentfarbe (Fach) für Checkboxen und Zitate */
  color: string
  onSave: (html: string) => void
}

export function NotesEditor({ html, color, onSave }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const saved = useRef(html)
  const timer = useRef<number | undefined>(undefined)
  const range = useRef<Range | null>(null)
  const linkRange = useRef<Range | null>(null)
  const onSaveRef = useRef(onSave)
  const [fmt, setFmt] = useState<Fmt>(NO_FMT)
  const [link, setLink] = useState<{ value: string; existing: boolean; bad?: boolean } | null>(null)

  useLayoutEffect(() => {
    onSaveRef.current = onSave
  })

  const flush = useCallback((el?: HTMLElement | null) => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    const root = el ?? ref.current
    if (!root) return
    const out = sanitizeNotes(root.innerHTML)
    if (out !== saved.current) {
      saved.current = out
      onSaveRef.current(out)
    }
  }, [])

  const refresh = useCallback(() => {
    const root = ref.current
    if (root) setFmt(readFmt(root) ?? NO_FMT)
  }, [])

  const changed = useCallback(() => {
    const root = ref.current
    if (!root) return
    root.toggleAttribute('data-empty', isEmpty(root))
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => flush(), NOTES_SAVE_DELAY_MS)
  }, [flush])

  // Inhalt einmal beim Öffnen setzen (danach gehört das DOM dem Browser).
  useLayoutEffect(() => {
    const root = ref.current!
    root.innerHTML = sanitizeNotes(saved.current) || '<p><br></p>'
    root.toggleAttribute('data-empty', isEmpty(root))
  }, [])

  // Auswahl merken (für Format-Menü und Link-Leiste), Toolbar-Zustand aktualisieren.
  useEffect(() => {
    // Beim Unmount ist ref.current schon null – Element hier merken, sonst ginge die letzte Eingabe verloren.
    const el = ref.current
    const onSel = () => {
      const root = ref.current
      const sel = getSelection()
      if (!root || !sel?.rangeCount || !root.contains(sel.anchorNode)) return
      range.current = sel.getRangeAt(0).cloneRange()
      refresh()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(el)
    }
    const onPageHide = () => flush(el)
    document.addEventListener('selectionchange', onSel)
    document.addEventListener('visibilitychange', onHide)
    addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('selectionchange', onSel)
      document.removeEventListener('visibilitychange', onHide)
      removeEventListener('pagehide', onPageHide)
      flush(el)
    }
  }, [flush, refresh])

  /** Fokus + letzte Auswahl wiederherstellen (nach Klick ins Format-Menü o. Ä.). */
  const restore = () => {
    const root = ref.current!
    const sel = getSelection()!
    if (document.activeElement === root && sel.rangeCount && root.contains(sel.anchorNode)) return
    root.focus({ preventScroll: true })
    sel.removeAllRanges()
    if (range.current && root.contains(range.current.startContainer)) sel.addRange(range.current)
    else {
      const r = document.createRange()
      r.selectNodeContents(root.lastElementChild ?? root)
      r.collapse(false)
      sel.addRange(r)
    }
  }

  /** Befehl ausführen, danach speichern und Toolbar aktualisieren. */
  const act = (fn: () => void) => {
    restore()
    exec('defaultParagraphSeparator', 'p')
    fn()
    tidy(ref.current!)
    changed()
    refresh()
  }

  const setBlock = (tag: BlockTag) => exec('formatBlock', `<${tag}>`)

  /**
   * Listen selbst aufbauen statt execCommand: Chrome legt Listen sonst in den Absatz (<p><ul>)
   * und verschmilzt sie mit einer direkt davor stehenden Liste (Aufzählung → Checkliste).
   */
  const toggleList = (kind: ListKind) => {
    const root = ref.current!
    const li = within(root, caretEl(root), 'li')
    const list = li?.parentElement
    if (li && list && root.contains(list)) {
      if (listKind(list) === kind) keepSelection(() => liToParagraph(li))
      else keepSelection(() => retagList(list, kind))
      return
    }
    const sel = getSelection()!
    if (!sel.rangeCount) return
    const r = sel.getRangeAt(0)
    const blocks = Array.from(root.children).filter((b) => b.matches('p,h1,h2,h3,blockquote') && r.intersectsNode(b))
    if (!blocks.length) return
    keepSelection(() => {
      const l = newList(kind)
      blocks[0]!.before(l)
      for (const b of blocks) {
        const item = newItem(kind)
        item.append(...Array.from(b.childNodes))
        if (!item.firstChild) item.innerHTML = '<br>'
        l.append(item)
        b.remove()
      }
    })
  }

  const toggleCode = () => {
    const root = ref.current!
    const el = caretEl(root)
    if (within(root, el, 'pre')) return
    const existing = within(root, el, 'code')
    if (existing) {
      existing.replaceWith(...Array.from(existing.childNodes))
      return
    }
    const sel = getSelection()!
    if (sel.isCollapsed || !sel.rangeCount) return
    const r = sel.getRangeAt(0)
    if (topBlock(root, r.startContainer) !== topBlock(root, r.endContainer)) return
    // Direkt im DOM statt insertHTML: sonst merkt Chrome sich die Code-Optik als „Typing Style“
    // und macht beim Weitertippen aus <code> ein <span style=…>, das beim Speichern verloren geht.
    const code = document.createElement('code')
    code.textContent = r.toString()
    r.deleteContents()
    r.insertNode(code)
    const after = document.createRange()
    after.setStartAfter(code)
    after.collapse(true)
    sel.removeAllRanges()
    sel.addRange(after)
  }

  /** Trennlinie unter dem aktuellen Block; auf leerer Zeile wird die Zeile selbst zur Linie. */
  const insertHr = () => {
    const root = ref.current!
    const sel = getSelection()!
    const top = sel.rangeCount ? topBlock(root, sel.getRangeAt(0).startContainer) : null
    const hr = document.createElement('hr')
    let target: Element
    if (!top) {
      root.append(hr)
      target = document.createElement('p')
      target.innerHTML = '<br>'
      root.append(target)
    } else if (!top.textContent && top.tagName === 'P') {
      top.before(hr)
      target = top
    } else {
      top.after(hr)
      target = hr.nextElementSibling?.tagName === 'P' && !hr.nextElementSibling.textContent ? hr.nextElementSibling : document.createElement('p')
      if (!target.isConnected) {
        target.innerHTML = '<br>'
        hr.after(target)
      }
    }
    const r = document.createRange()
    r.setStart(target, 0)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
  }

  const openLink = () => {
    const root = ref.current!
    restore()
    const sel = getSelection()!
    // Auswahl fest merken – solange die Link-Leiste den Fokus hat, gehört die Auswahl dem Eingabefeld
    if (sel.rangeCount) range.current = sel.getRangeAt(0).cloneRange()
    linkRange.current = range.current
    const a = within(root, caretEl(root), 'a')
    setLink({ value: a?.getAttribute('href') ?? '', existing: !!a })
  }

  /** Fokus zurück in den Editor, mit der Auswahl von vor dem Öffnen der Link-Leiste. */
  const restoreLinkRange = () => {
    if (linkRange.current) range.current = linkRange.current
    linkRange.current = null
    const root = ref.current!
    root.focus({ preventScroll: true })
    const sel = getSelection()!
    if (range.current && root.contains(range.current.startContainer)) {
      sel.removeAllRanges()
      sel.addRange(range.current)
    }
  }

  const applyLink = (e?: FormEvent) => {
    e?.preventDefault()
    if (!link) return
    const href = safeUrl(link.value)
    if (!href) return setLink({ ...link, bad: true })
    setLink(null)
    restoreLinkRange()
    act(() => {
      const root = ref.current!
      const a = within(root, caretEl(root), 'a')
      if (a) a.setAttribute('href', href)
      else if (getSelection()!.isCollapsed) exec('insertHTML', `<a href="${esc(href)}">${esc(link.value.trim())}</a>`)
      else exec('createLink', href)
    })
  }

  const removeLink = () => {
    setLink(null)
    restoreLinkRange()
    act(() => {
      const root = ref.current!
      const a = within(root, caretEl(root), 'a')
      if (!a) return
      a.replaceWith(...Array.from(a.childNodes))
    })
  }

  const closeLink = () => {
    setLink(null)
    restoreLinkRange()
  }

  /** Markdown-Kürzel am Zeilenanfang. true = angewendet. */
  const shortcut = (data: string | null): boolean => {
    const root = ref.current!
    const blk = within(root, caretEl(root), 'p,li,h1,h2,h3')
    if (!blk || blk.tagName !== 'P' || within(root, blk, 'li,blockquote')) return false
    const r = rangeToCaret(blk)
    if (!r) return false
    const t = r.toString().replace(/ /g, ' ')
    const MAP: Record<string, () => void> = {
      '# ': () => exec('formatBlock', '<h1>'),
      '## ': () => exec('formatBlock', '<h2>'),
      '### ': () => exec('formatBlock', '<h3>'),
      '- ': () => toggleList('ul'),
      '* ': () => toggleList('ul'),
      '1. ': () => toggleList('ol'),
      '[] ': () => toggleList('todo'),
      '[ ] ': () => toggleList('todo'),
      '> ': () => exec('formatBlock', '<blockquote>'),
      '---': insertHr,
      '```': () => exec('formatBlock', '<pre>'),
    }
    const fn = MAP[t]
    if (!fn || data?.replace(/\u00a0/g, ' ') !== t.at(-1)) return false
    const sel = getSelection()!
    sel.removeAllRanges()
    sel.addRange(r)
    exec('delete')
    fn()
    return true
  }

  const onInput = (e: FormEvent<HTMLDivElement>) => {
    const root = ref.current!
    const ev = e.nativeEvent as InputEvent
    // Ohne Block (alles gelöscht) → wieder in einen Absatz
    if (!root.firstElementChild && root.textContent) exec('formatBlock', '<p>')
    if (ev.inputType === 'insertText') shortcut(ev.data)
    if (ev.inputType === 'insertParagraph') {
      const el = caretEl(root)
      // neuer, leerer Checklisten-Punkt ist nie abgehakt
      const li = within(root, el, 'li')
      if (li?.parentElement?.matches(TODO) && !li.textContent) li.setAttribute('data-checked', 'false')
      // nach Zitat/Überschrift geht es mit normalem Text weiter (Shift+Enter = Zeilenumbruch im Zitat)
      const fmtBlock = within(root, el, 'blockquote,h1,h2,h3')
      if (fmtBlock && !fmtBlock.textContent) exec('formatBlock', '<p>')
      // neue Zeile erbt keinen leeren Inline-Code
      const code = within(root, el, 'code')
      if (code && !code.textContent) {
        const parent = code.parentElement!
        code.replaceWith(...Array.from(code.childNodes))
        if (!parent.firstChild) parent.innerHTML = '<br>'
        getSelection()!.collapse(parent, 0)
      }
    }
    tidy(root)
    changed()
    refresh()
  }

  // Tippen direkt hinter Inline-Code geht außerhalb des Codes weiter (Chrome würde den Code verlängern).
  useEffect(() => {
    const root = ref.current!
    const onBefore = (ev: InputEvent) => {
      if (ev.inputType !== 'insertText' || !ev.data) return
      const sel = getSelection()
      if (!sel?.isCollapsed || !sel.anchorNode) return
      const n = sel.anchorNode
      // Einfügemarke am Ende im Code – oder (je nach Chrome-Laune) im Elternelement direkt dahinter
      const before = n.nodeType === Node.ELEMENT_NODE ? n.childNodes[sel.anchorOffset - 1] : null
      let code = before?.nodeName === 'CODE' ? (before as Element) : within(root, n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement, 'code')
      if (!code || within(root, code, 'pre')) return
      if (code !== before) {
        const rest = document.createRange()
        rest.setStart(n, sel.anchorOffset)
        rest.setEnd(code, code.childNodes.length)
        if (rest.toString() !== '') code = null
      }
      if (!code) return
      ev.preventDefault()
      const next = code.nextSibling
      let t: Text
      if (next?.nodeType === Node.TEXT_NODE) {
        t = next as Text
        t.insertData(0, ev.data)
      } else {
        t = document.createTextNode(ev.data)
        code.after(t)
      }
      // Leerzeichen am Zeilenende wäre sonst unsichtbar
      if (t.data.endsWith(' ')) t.replaceData(t.length - 1, 1, ' ')
      sel.collapse(t, ev.data.length)
      changed()
    }
    root.addEventListener('beforeinput', onBefore)
    return () => root.removeEventListener('beforeinput', onBefore)
  }, [changed])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const root = ref.current!
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    // Alles markiert + löschen → wieder eine leere Seite (Chrome behielte das Format der ersten Zeile)
    if ((e.key === 'Backspace' || e.key === 'Delete') && !mod) {
      const sel = getSelection()
      if (sel && !sel.isCollapsed && root.textContent && sel.toString().replace(/\s/g, '') === root.innerText.replace(/\s/g, '')) {
        e.preventDefault()
        act(() => {
          root.innerHTML = '<p><br></p>'
          getSelection()!.collapse(root.firstChild!, 0)
        })
        return
      }
    }
    if (mod && !e.altKey) {
      if (k === 'k') {
        e.preventDefault()
        openLink()
      } else if (k === 'e') {
        e.preventDefault()
        act(toggleCode)
      } else if (e.shiftKey && (k === 's' || k === 'x')) {
        e.preventDefault()
        act(() => exec('strikeThrough'))
      }
      return
    }
    const el = caretEl(root)
    const li = within(root, el, 'li')
    if (e.key === 'Tab') {
      if (li) {
        e.preventDefault()
        // Shift+Tab nur bei verschachtelten Punkten (eine Ebene höher), Tab rückt unter den Punkt davor ein
        if (e.shiftKey) {
          if (li.parentElement?.parentElement?.tagName === 'LI') act(() => keepSelection(() => liToParagraph(li)))
        } else act(() => keepSelection(() => indentItem(li)))
      } else if (within(root, el, 'pre')) {
        e.preventDefault()
        act(() => exec('insertText', '  '))
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && within(root, el, 'pre')) {
      e.preventDefault()
      act(() => exec('insertLineBreak'))
      return
    }
    // Enter in leerem Listenpunkt → Liste verlassen (verschachtelt: eine Ebene höher)
    if (e.key === 'Enter' && !e.shiftKey && li && !li.textContent && !li.querySelector('ul,ol')) {
      e.preventDefault()
      act(() => keepSelection(() => liToParagraph(li)))
      return
    }
    if (e.key === 'Backspace' && getSelection()?.isCollapsed) {
      // Am Zeilenanfang: erst das Format entfernen (wie Notion), statt mit der Zeile davor zu verschmelzen
      const fmtBlock = within(root, el, 'h1,h2,h3,blockquote,pre')
      const blk = fmtBlock ?? li
      if (blk && rangeToCaret(blk)?.toString() === '') {
        e.preventDefault()
        act(() => (fmtBlock ? exec('formatBlock', '<p>') : keepSelection(() => liToParagraph(li!))))
      }
    }
  }

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const root = ref.current!
    const t = e.target as Element
    // Checkbox eines Checklisten-Punkts
    const li = t.closest?.('li')
    if (li && root.contains(li) && li.parentElement?.matches(TODO)) {
      const b = li.getBoundingClientRect()
      if (e.clientX - b.left < 26 && e.clientY - b.top < 26) {
        e.preventDefault()
        li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true')
        changed()
        return
      }
    }
    // Klick unter den letzten Block → neue leere Zeile (wie Notion)
    const last = root.lastElementChild
    if (t === root && last && e.clientY > last.getBoundingClientRect().bottom) {
      e.preventDefault()
      let p = last
      if (!(last.tagName === 'P' && !last.textContent)) {
        p = document.createElement('p')
        p.innerHTML = '<br>'
        root.append(p)
      }
      root.focus({ preventScroll: true })
      const r = document.createRange()
      r.setStart(p, 0)
      r.collapse(true)
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(r)
    }
  }

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as Element).closest?.('a')
    if (a && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      const href = safeUrl(a.getAttribute('href') ?? '')
      if (href) window.open(href, '_blank', 'noopener,noreferrer')
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const root = ref.current!
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    const inPre = !!within(root, caretEl(root), 'pre')
    const sel = getSelection()
    const url = /^https?:\/\/\S+$/.test(text.trim()) ? safeUrl(text) : null
    if (url && sel && !sel.isCollapsed && !inPre) exec('createLink', url)
    else if (html && !inPre) {
      const clean = sanitizeNotes(html)
      if (clean) exec('insertHTML', clean)
    } else if (text) exec('insertText', text)
    changed()
  }

  const btn = (label: string, title: string, on: boolean, run: () => void, content: ReactNode, cls?: string, disabled?: boolean) => (
    <button
      type="button"
      className={cx(styles.tb, on && styles.on, cls)}
      aria-label={label}
      aria-pressed={on}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => act(run)}
    >
      {content}
    </button>
  )

  return (
    <div className={styles.wrap} style={vars({ '--c': color })}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatierung">
        <select
          className={styles.block}
          aria-label="Absatzformat"
          value={fmt.block}
          onChange={(e) => {
            const v = e.target.value as BlockTag
            act(() => setBlock(v))
          }}
        >
          {BLOCK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={styles.sep} />
        {btn('Fett', 'Fett (Strg+B)', fmt.b, () => exec('bold'), 'B', styles.bold, fmt.inPre)}
        {btn('Kursiv', 'Kursiv (Strg+I)', fmt.i, () => exec('italic'), 'I', styles.italic, fmt.inPre)}
        {btn('Durchgestrichen', 'Durchgestrichen (Strg+Shift+S)', fmt.s, () => exec('strikeThrough'), 'S', styles.strike, fmt.inPre)}
        {btn('Code', 'Code (Strg+E)', fmt.code, toggleCode, '</>', styles.mono, fmt.inPre)}
        <button
          type="button"
          className={cx(styles.tb, (fmt.link || !!link) && styles.on)}
          aria-label="Link"
          aria-pressed={fmt.link}
          title="Link (Strg+K)"
          disabled={fmt.inPre}
          onMouseDown={(e) => e.preventDefault()}
          onClick={openLink}
        >
          ↗
        </button>
        <span className={styles.sep} />
        {btn('Aufzählung', 'Aufzählung („- “)', fmt.list === 'ul', () => toggleList('ul'), '•≡')}
        {btn('Nummerierte Liste', 'Nummerierte Liste („1. “)', fmt.list === 'ol', () => toggleList('ol'), '1.≡')}
        {btn('Checkliste', 'Checkliste („[] “)', fmt.list === 'todo', () => toggleList('todo'), '☑')}
        {btn('Trennlinie', 'Trennlinie („---“)', false, insertHr, '—')}
      </div>

      {link && (
        <form className={styles.linkBar} onSubmit={applyLink}>
          <input
            autoFocus
            className={cx(link.bad && styles.bad)}
            value={link.value}
            placeholder="https://…"
            aria-label="Link-Adresse"
            onChange={(e) => setLink({ ...link, value: e.target.value, bad: false })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                closeLink()
              }
            }}
          />
          <button type="submit">Übernehmen</button>
          {link.existing && (
            <button type="button" onClick={removeLink}>
              Entfernen
            </button>
          )}
          <button type="button" onClick={closeLink} aria-label="Abbrechen">
            ×
          </button>
        </form>
      )}

      <div
        ref={ref}
        className={styles.editor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Notizen"
        spellCheck
        data-placeholder="Notizen … Tippe # für Überschriften, - für Listen, [] für Checklisten"
        onInput={onInput}
        onKeyDown={onKeyDown}
        // Strg+B/I/U ändern die Auswahl nicht (kein selectionchange) – Toolbar trotzdem aktualisieren
        onKeyUp={refresh}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onPaste={onPaste}
        onDrop={(e) => {
          if (e.dataTransfer.files.length) e.preventDefault()
        }}
        onFocus={() => exec('defaultParagraphSeparator', 'p')}
      />
    </div>
  )
}
