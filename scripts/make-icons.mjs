// Erzeugt die App-Icons in public/ aus einem SVG-Entwurf.
// Aufruf: node scripts/make-icons.mjs  (nutzt das Chromium von Playwright)
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const BG = '#0c0d11'
const RING = '#353945'
const SIGNAL = '#f1e2a2'

/**
 * Ring mit gelbem Bogen (12 → ~4 Uhr) und Punkt am Bogenende.
 * full = randlos (iOS/maskable rundet selbst), sonst abgerundetes Quadrat.
 * Inhalt liegt innerhalb von 40 % Radius → sicher für maskable Icons.
 */
function icon({ full, stroke }) {
  const c = 256
  const r = 150
  const a = (110 - 90) * (Math.PI / 180)
  const ex = (c + r * Math.cos(a)).toFixed(2)
  const ey = (c + r * Math.sin(a)).toFixed(2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512"${full ? '' : ' rx="112"'} fill="${BG}"/>
<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${RING}" stroke-width="${stroke}"/>
<path d="M${c} ${c - r} A${r} ${r} 0 0 1 ${ex} ${ey}" fill="none" stroke="${SIGNAL}" stroke-width="${stroke}" stroke-linecap="round"/>
<circle cx="${c}" cy="${c}" r="${stroke * 1.1}" fill="${SIGNAL}"/>
</svg>
`
}

writeFileSync('public/favicon.svg', icon({ full: false, stroke: 44 }))
const master = icon({ full: true, stroke: 26 })

const targets = [
  ['public/pwa-192.png', 192],
  ['public/pwa-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]

const browser = await chromium.launch()
for (const [file, size] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${master}`)
  await page.screenshot({ path: file })
  await page.close()
  console.log(file)
}
await browser.close()
