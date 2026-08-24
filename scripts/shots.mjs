/**
 * Capture every variant at fixed points in its reveal.
 *
 * Uses the debug URL params (?v=&p=) so each frame is pinned exactly rather than
 * approximated by a scroll position, which makes the output comparable run to run.
 *
 * Playwright is resolved from the npx cache via NODE_PATH — it's a verification
 * tool, not a dependency of the prototype. See scripts/shots.sh.
 */
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

// ESM ignores NODE_PATH, so resolve relative to PW_BASE instead.
const require = createRequire(process.env.PW_BASE ?? import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = process.env.OUT ?? '.context/shots'
const STEPS = (process.env.STEPS ?? '0,0.35,0.5,0.65,1').split(',').map(Number)
const VARIANTS = (process.env.VARIANTS ?? '1,2,3,4,5').split(',').map(Number)
const EXTRA = process.env.EXTRA ?? ''

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: {
    width: Number(process.env.W ?? 1440),
    height: Number(process.env.H ?? 900),
  },
  deviceScaleFactor: 1,
  reducedMotion: process.env.REDUCED === '1' ? 'reduce' : 'no-preference',
})

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

for (const v of VARIANTS) {
  for (const p of STEPS) {
    const url = `${BASE}/?v=${v}&p=${p}${EXTRA}`
    await page.goto(url, { waitUntil: 'networkidle' })
    // Both photographs are gated on decode(); wait that out rather than guessing.
    await page.waitForFunction(() => !document.querySelector('.loading'), null, {
      timeout: 15000,
    })
    await page.waitForTimeout(250)
    const tag = `v${v}-p${String(p).replace('.', '')}${process.env.SUFFIX ?? ''}`
    // FULL=1 includes the chrome (switcher, background picker); default is the stage
    // alone, so frames are comparable and the panel can't overlap them.
    await (process.env.FULL === '1' ? page : page.locator('.stage')).screenshot({
      path: `${OUT}/${tag}.png`,
    })
    process.stdout.write(`${tag} `)
  }
}

console.log('\n' + (errors.length ? `errors:\n${errors.join('\n')}` : 'no console errors'))
await browser.close()
