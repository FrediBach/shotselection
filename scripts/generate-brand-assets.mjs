import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const publicDir = new URL('../public/', import.meta.url)
const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (process.platform === 'darwin' && existsSync(systemChrome) ? systemChrome : undefined)

// Keep social artwork as editable vector geometry; publish PNGs for crawler compatibility.
function socialImage(square) {
  const height = square ? 1200 : 630
  const tableTransform = square ? 'translate(202 620) scale(1.5)' : 'translate(614 191) rotate(-9 240 150)'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}">
    <defs>
      <radialGradient id="background"><stop stop-color="#29372c"/><stop offset="1" stop-color="#141715"/></radialGradient>
      <linearGradient id="felt" x2="0" y2="1"><stop stop-color="#48765d"/><stop offset="1" stop-color="#28513d"/></linearGradient>
      <radialGradient id="cue" cx="30%" cy="25%"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#c7c9bb"/></radialGradient>
      <radialGradient id="gold" cx="30%" cy="25%"><stop stop-color="#f9d58a"/><stop offset="1" stop-color="#c18a38"/></radialGradient>
      <radialGradient id="red" cx="30%" cy="25%"><stop stop-color="#d3786b"/><stop offset="1" stop-color="#8e3d35"/></radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-opacity=".4"/></filter>
    </defs>
    <rect width="1200" height="${height}" fill="#141715"/>
    <rect width="1200" height="${height}" fill="url(#background)"/>
    <path d="M64 140H1136" stroke="#ffffff" stroke-opacity=".12"/>
    <g transform="translate(64 64)" fill="none" stroke="#e6ba7a">
      <circle cx="23" cy="23" r="22" stroke-width="1.8"/>
      <circle cx="23" cy="23" r="9" fill="#e6ba7a" stroke="none"/>
      <path d="M29 17 48 1" stroke-width="2"/>
    </g>
    <g font-family="Arial, Helvetica, sans-serif">
      <text x="126" y="99" fill="#eaece5" font-size="36" letter-spacing="-1.6"><tspan font-weight="700">shot</tspan><tspan>selection</tspan><tspan fill="#e6ba7a">.</tspan></text>
      <text x="64" y="${square ? 222 : 210}" fill="#a7b39e" font-size="15" font-weight="700" letter-spacing="3">A GAME OF BETTER CHOICES</text>
      <text x="60" y="${square ? 338 : 304}" fill="#eaece5" font-size="${square ? 100 : 72}" font-weight="700" letter-spacing="-3">Play the</text>
      <text x="60" y="${square ? 446 : 384}" fill="#e6ba7a" font-size="${square ? 100 : 72}" font-weight="700" letter-spacing="-3">percentages.</text>
      <text x="64" y="${square ? 520 : 443}" fill="#b8c3b0" font-size="${square ? 29 : 23}">Read the table. Trust the percentages.</text>
      <text x="64" y="${square ? 563 : 479}" fill="#b8c3b0" font-size="${square ? 29 : 23}">Choose the most reliable shot.</text>
      <text x="64" y="${height - 48}" fill="#e6ba7a" font-size="19" letter-spacing="1">shotselection.app</text>
      <text x="1136" y="${height - 48}" text-anchor="end" fill="#a7b39e" font-size="13" letter-spacing="2">POOL. PHYSICS. PROBABILITY.</text>
    </g>
    <g transform="${tableTransform}">
      <rect x="0" y="0" width="530" height="318" rx="30" fill="#222923" stroke="#63725d" stroke-width="2" filter="url(#shadow)"/>
      <rect x="16" y="16" width="498" height="286" rx="19" fill="#152d21" stroke="#b3925d" stroke-width="2"/>
      <rect x="34" y="34" width="462" height="250" rx="9" fill="url(#felt)" stroke="#527e5e" stroke-width="8"/>
      <g fill="#0e1712" stroke="#77816a" stroke-width="2">
        <circle cx="37" cy="37" r="15"/><circle cx="265" cy="31" r="14"/><circle cx="493" cy="37" r="15"/>
        <circle cx="37" cy="281" r="15"/><circle cx="265" cy="287" r="14"/><circle cx="493" cy="281" r="15"/>
      </g>
      <g fill="#b9b8a0"><circle cx="148" cy="13" r="2"/><circle cx="382" cy="13" r="2"/><circle cx="148" cy="305" r="2"/><circle cx="382" cy="305" r="2"/><circle cx="13" cy="159" r="2"/><circle cx="517" cy="159" r="2"/></g>
      <path d="M140 226 311 134 484 42" fill="none" stroke="#e6ba7a" stroke-width="2.5" stroke-dasharray="7 6"/>
      <path d="m468 44 16-2-7 14" fill="none" stroke="#e6ba7a" stroke-width="2.5"/>
      <g fill="#000" opacity=".2"><ellipse cx="143" cy="233" rx="15" ry="12"/><ellipse cx="314" cy="141" rx="15" ry="12"/><ellipse cx="387" cy="224" rx="15" ry="12"/></g>
      <circle cx="140" cy="226" r="13" fill="url(#cue)"/>
      <circle cx="311" cy="134" r="13" fill="url(#gold)"/>
      <circle cx="311" cy="134" r="6" fill="#f4efda"/>
      <text x="311" y="137.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#223326">1</text>
      <circle cx="384" cy="217" r="13" fill="url(#red)"/>
      <circle cx="384" cy="217" r="6" fill="#f4efda"/>
      <text x="384" y="220.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#223326">3</text>
    </g>
  </svg>`
}

const browser = await chromium.launch({ executablePath })
try {
  async function render(svg, width, height, filename, background = 'transparent') {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    await page.setContent(`<html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${background}}svg{display:block;width:100%;height:100%}</style></head><body>${svg}</body></html>`)
    await page.screenshot({ path: fileURLToPath(new URL(filename, publicDir)), omitBackground: true })
    await page.close()
    console.log(`Generated ${filename} (${width} × ${height})`)
  }
  await render(socialImage(false), 1200, 630, 'og-image.png')
  await render(socialImage(true), 1200, 1200, 'og-image-square.png')
  const icon = await readFile(new URL('favicon.svg', publicDir), 'utf8')
  for (const [size, filename] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
    await render(icon, size, size, filename, '#e4b879')
  }
  // The central ball stays inside the maskable icon's 80%-diameter safe zone.
  await render(icon, 512, 512, 'icon-maskable-512.png', '#e4b879')
} finally {
  await browser.close()
}
