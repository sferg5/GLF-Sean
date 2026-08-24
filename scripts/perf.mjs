/**
 * Does scrolling any variant trigger layout?
 *
 * That's the design question — every variant is meant to cost style + composite
 * and nothing else. Chrome's own counters answer it directly, and unlike an fps
 * number they're meaningful in headless, where there's no real vsync or GPU.
 *
 * A real DevTools Performance recording is still the final word on frame rate.
 *
 *   scripts/perf.sh
 */
import { createRequire } from 'node:module'

const require = createRequire(process.env.PW_BASE ?? import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE ?? 'http://localhost:5174'
const STEPS = Number(process.env.PERF_STEPS ?? 90)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const cdp = await page.context().newCDPSession(page)
await cdp.send('Performance.enable')

const metrics = async () => {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]))
}

// Published by App.tsx, so this keeps working as variants come and go and doesn't
// depend on any chrome being on screen.
await page.goto(BASE, { waitUntil: 'networkidle' })
const names = await page.evaluate(() =>
  (document.documentElement.dataset.variants ?? '').split('|').filter(Boolean),
)

console.log('variant           layouts  layout ms  restyles  restyle ms  frames')

for (let v = 1; v <= names.length; v++) {
  /**
   * `reel=0` and `clip=0`, even though the sweep below is scoped to the stage's own section.
   *
   * The scoping keeps them out of the *scroll*; this keeps them out of the *page*. The reel's
   * videos start playing when its section is within half a viewport, and the film starts playing
   * when three quarters of its own is on screen — both of which the last few steps of this sweep
   * are. Leaving either mounted would put a decoder on the main thread over the frames being
   * counted and attribute its cost to the variant.
   */
  await page.goto(`${BASE}/?v=${v}&reel=0&clip=0`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 15000 })
  await page.waitForTimeout(300)

  const before = await metrics()

  // Real scrolling, not the debug scrubber — the scroll listener and spring are
  // part of what's being measured.
  const frames = await page.evaluate(async (steps) => {
    // The stage's own section, not the document: the colourway strip below it is a
    // viewport of static page, and running the steps across it would spend a chunk of
    // them measuring nothing while thinning out the ones over the reveal.
    const stage = document.querySelector('.section')
    const max = stage.offsetTop + stage.offsetHeight - window.innerHeight
    let count = 0
    const tick = () => count++
    let raf = requestAnimationFrame(function loop() {
      tick()
      raf = requestAnimationFrame(loop)
    })
    for (let i = 0; i <= steps; i++) {
      window.scrollTo({ top: (max * i) / steps, behavior: 'instant' })
      await new Promise((r) => requestAnimationFrame(r))
    }
    cancelAnimationFrame(raf)
    return count
  }, STEPS)

  const after = await metrics()
  const d = (k) => after[k] - before[k]
  console.log(
    names[v - 1].padEnd(17) +
      String(d('LayoutCount')).padStart(7) +
      (d('LayoutDuration') * 1000).toFixed(1).padStart(11) +
      String(d('RecalcStyleCount')).padStart(10) +
      (d('RecalcStyleDuration') * 1000).toFixed(1).padStart(12) +
      String(frames).padStart(8),
  )
}

await browser.close()
