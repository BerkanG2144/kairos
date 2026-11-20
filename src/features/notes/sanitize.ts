/**
 * Bereinigt Notiz-HTML (aus dem Editor, aus der Zwischenablage oder aus einem importierten Backup)
 * zu einer kleinen, kanonischen Teilmenge: feste Tags, nur erlaubte Attribute, Text escaped.
 * Geparst wird in einem inerten Dokument (DOMParser) – dort laufen keine Skripte und es lädt nichts.
 *
 * Erlaubt: p h1 h2 h3 blockquote pre ul ol li hr | b i s u code a br
 * Checklisten: <ul data-type="todo"><li data-checked="true|false">…</li></ul>
 */

const BLOCK_ALIAS: Record<string, string> = {
  P: 'p', DIV: 'p', H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3',
  BLOCKQUOTE: 'blockquote', UL: 'ul', OL: 'ol', LI: 'li',
}
const INLINE_ALIAS: Record<string, string> = {
  B: 'b', STRONG: 'b', I: 'i', EM: 'i', S: 's', STRIKE: 's', DEL: 's', U: 'u', CODE: 'code',
}
/** Samt Inhalt verwerfen. */
const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'])
const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'blockquote', 'pre', 'ul', 'ol', 'hr'])

const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;')
const escAttr = (t: string): string => esc(t).replace(/"/g, '&quot;')

/** Nur http(s) und mailto; „www.x.de“ → https://www.x.de. Sonst null. */
export function safeUrl(raw: string): string | null {
  const u = raw.trim()
  if (!u) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`
  try {
    const p = new URL(withScheme)
    return p.protocol === 'http:' || p.protocol === 'https:' || p.protocol === 'mailto:' ? p.href : null
  } catch {
    return null
  }
}

const isTodoList = (el: Element): boolean => el.tagName === 'UL' && (el.getAttribute('data-type') === 'todo' || el.classList.contains('todo'))

/** Ein Knoten → kanonisches HTML ('' wenn nichts übrig bleibt). */
function node(n: Node, inTodo: boolean): string {
  if (n.nodeType === Node.TEXT_NODE) return esc(n.textContent ?? '')
  if (n.nodeType !== Node.ELEMENT_NODE) return ''
  const el = n as Element
  const tag = el.tagName.toUpperCase()
  if (DROP.has(tag)) return ''
  if (tag === 'BR') return '<br>'
  if (tag === 'HR') return '<hr>'
  if (tag === 'PRE') {
    const clone = el.cloneNode(true) as Element
    clone.querySelectorAll('br').forEach((b) => b.replaceWith('\n'))
    return `<pre>${esc(clone.textContent ?? '')}</pre>`
  }
  if (tag === 'A') {
    const href = safeUrl(el.getAttribute('href') ?? '')
    const inner = children(el, false)
    return href && inner ? `<a href="${escAttr(href)}">${inner}</a>` : inner
  }
  const inl = INLINE_ALIAS[tag]
  if (inl) {
    const inner = children(el, false)
    return inner ? `<${inl}>${inner}</${inl}>` : ''
  }
  const blk = BLOCK_ALIAS[tag]
  if (blk === 'ul' || blk === 'ol') {
    const todo = blk === 'ul' && isTodoList(el)
    const inner = children(el, todo)
    return inner ? `<${blk}${todo ? ' data-type="todo"' : ''}>${inner}</${blk}>` : ''
  }
  if (blk === 'li') {
    const inner = children(el, false) || '<br>'
    if (!inTodo) return `<li>${inner}</li>`
    return `<li data-checked="${el.getAttribute('data-checked') === 'true' ? 'true' : 'false'}">${inner}</li>`
  }
  // leere Blöcke behalten (Leerzeilen), aber mit <br>, damit sie Höhe haben und editierbar sind
  if (blk) return `<${blk}>${children(el, false) || '<br>'}</${blk}>`
  // span, font, section, … → nur der Inhalt
  return children(el, inTodo)
}

function children(el: Node, inTodo: boolean): string {
  let out = ''
  for (const c of Array.from(el.childNodes)) out += node(c, inTodo)
  return out
}

const startsBlock = (html: string): boolean => {
  const m = /^<([a-z0-9]+)/.exec(html)
  return !!m && (BLOCKS.has(m[1]!) || m[1] === 'li')
}

/**
 * Kanonisches HTML. Lose Inline-Inhalte auf oberster Ebene werden zu Absätzen zusammengefasst.
 * Ohne sichtbaren Inhalt (kein Text, keine Linie, keine Checkliste) → ''.
 */
export function sanitizeNotes(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html')
  let out = ''
  let run = ''
  const flush = () => {
    if (run.replace(/<br>/g, '').trim()) out += `<p>${run}</p>`
    run = ''
  }
  for (const c of Array.from(doc.body.childNodes)) {
    const h = node(c, false)
    if (!h) continue
    if (startsBlock(h)) {
      flush()
      out += h.startsWith('<li') ? `<ul>${h}</ul>` : h
    } else run += h
  }
  flush()
  const visible = out.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return visible || /<hr>|<li data-checked/.test(out) ? out : ''
}
