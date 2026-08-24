/**
 * Does the airflow section measure anything, and does it say what it measured?
 *
 * `scripts/air.sh` already runs the model headless and asserts the physics — including that the
 * figures the page *quotes* (`predict`, solved) agree with the fields it *draws* (settled). What
 * it can't see is the half of this section that lives in a browser, and every one of these has a
 * failure mode that looks like a working page:
 *
 * - **A channel that never sized its canvas.** A `ResizeObserver` that didn't fire, or a box
 *   measured before layout, leaves a 0 × 0 backing store. The section still renders — the axis,
 *   the slider, the figures, all of it — and the diagram is simply absent.
 * - **A field that isn't running.** Nothing gates this section on scroll any more, so "it starts
 *   when you reach it" isn't a thing that can be checked; what can is that air is *there*, in
 *   both channels, without anybody having interacted.
 * - **A figure that doesn't answer the slider.** The two figures are a pure function of the pace
 *   now, and the way that goes wrong is silently: a `useMemo` on the wrong dependency, or a
 *   published value that lags a render. So this drives the slider and reads both the text and the
 *   dataset back.
 * - **A field that doesn't answer the slider.** The figures could track the pace perfectly while
 *   the wind the loop reads is stuck — the ref and the value are two paths to the same number.
 *   The per-channel throughput each canvas publishes is what catches that.
 *
 *   scripts/fabric.sh
 */
import { createRequire } from 'node:module'

const require = createRequire(process.env.PW_BASE ?? import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE ?? 'http://localhost:5174'
const W = Number(process.env.W ?? 1440)
const H = Number(process.env.H ?? 900)
const REDUCED = !!process.env.REDUCED

/** Long enough for the fields to reach steady state — a parcel's life inside is 9s. */
const SETTLE = 12000

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: REDUCED ? 'reduce' : 'no-preference',
})
const page = await context.newPage()

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

/** A fraction as a percentage, for the detail column. */
const pc = (v) => `${(v * 100).toFixed(1)}%`

let failures = 0
const check = (label, ok, detail) => {
  if (!ok) failures++
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(42)} ${detail}`)
}

/* Last on the show-zero page. */
await page.goto(`${BASE}/?page=show-zero`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.locator('.fabric').waitFor({ timeout: 20000 })

const box = await page.locator('.fabric').boundingBox()

/** How much a canvas actually has to draw on. */
const backing = () =>
  page.$$eval('.fabric__canvas', (els) =>
    els.map((el) => ({ w: el.width, h: el.height, css: Math.round(el.getBoundingClientRect().width) })),
  )

console.log(`fabric · ${W}×${H}${REDUCED ? ' · reduced' : ''}\n`)
console.log('the section')

/* It's one screen now rather than a 380svh pin, so this is the frame it will be looked at in. */
await page.evaluate((to) => window.scrollTo({ top: to, behavior: 'instant' }), box.y + box.height / 2 - H / 2)
await page.waitForTimeout(SETTLE)

{
  const published = await page.evaluate(() => document.documentElement.dataset.fabric)
  const spec = JSON.parse(published ?? '{}')
  check('it publishes its own numbers', !!published, published)
  check('the pace opens at the reference', spec.pace === 8, `${spec.pace} km/h`)
  check(
    'it is one screen, not a pin',
    Math.abs(box.height - H) < H * 0.35,
    `${Math.round(box.height)}px against a ${H}px window`,
  )
}

{
  const sizes = await backing()
  check('both channels have a canvas', sizes.length === 2, `${sizes.length} canvases`)
  check(
    'and both are actually sized',
    sizes.every((s) => s.w > 200 && s.h > 60),
    sizes.map((s) => `${s.w}×${s.h}`).join(' · '),
  )
  /* Full-bleed, which is also what forced the backing ratio down to 1.5. See `MAX_DPR`. */
  check(
    'they go edge to edge',
    sizes.every((s) => Math.abs(s.css - W) < 2),
    `${sizes[0].css}px of ${W}`,
  )
}

{
  /* No beats, no gate: the only thing that has to be true is that there is air in both channels
     without anybody having touched anything. */
  const lit = await page.$$eval('.fabric__canvas', (els) =>
    els.map((el) => {
      const ctx = el.getContext('2d')
      const { data } = ctx.getImageData(0, 0, el.width, el.height)
      let n = 0
      for (let i = 3; i < data.length; i += 4) if (data[i] > 8) n++
      return n
    }),
  )
  check('both channels are running', lit.every((n) => n > 2000), lit.join(' · '))
  /* And the open knit's channel is the busier one — the whole picture in one number. */
  check('and the open knit carries more air', lit[1] > lit[0] * 1.1, `${lit[0]} → ${lit[1]}`)
}

console.log('\nthe figures')

/** The two display figures, as numbers. */
const figures = () =>
  page.$$eval('.fabric__figure > b', (els) => els.map((el) => parseFloat(el.textContent)))

/** What each channel's field currently measures, off its canvas. */
const fields = () =>
  page.$$eval('.fabric__canvas', (els) => els.map((el) => Number(el.dataset.through)))

{
  const [ratio, drop] = await figures()
  const spec = JSON.parse(await page.evaluate(() => document.documentElement.dataset.fabric))
  check('the headline is on screen', ratio > 2.2 && ratio < 2.7, `${ratio}×`)
  check('and it is the porosity ratio', Math.abs(ratio - 44 / 18) < 0.15, `${ratio}× against 2.44×`)
  check('the open knit is cooler', drop > 2, `${drop} °C`)
  /* The text and the published value are two renderings of one `predict()` call; they cannot be
     allowed to come from different renders. */
  check('the text is what it published', Math.abs(ratio - spec.ratio) < 0.005, `${ratio} / ${spec.ratio}`)

  const measured = await fields()
  check(
    'and the running fields agree with it',
    Math.abs(measured[1] / measured[0] - ratio) < 0.15,
    `${(measured[1] / measured[0]).toFixed(2)}× measured`,
  )
}

console.log('\nthe pace')

{
  const before = await figures()
  const beforeField = await fields()
  const slider = page.locator('.fabric__pace input')
  await slider.focus()
  /* Keyboard rather than a drag: it's the path a custom thumb would have broken, and it's exact.
     Twenty-four presses at 0.5 is the full 8 → 20 range. */
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(SETTLE)
  const after = await figures()
  const afterField = await fields()
  const shown = await page.locator('.fabric__pace-value').innerText()

  check('the slider reaches the top of its range', shown.startsWith('12'), shown.replace('\n', ' '))
  /* Capacity grows more slowly than production does, so a harder pace has to cost the fabric
     ground — and the figures have to *move*, which is the whole reason they were taken off a live
     EMA and put on the slider. */
  check('the figures answer it', after[0] !== before[0] || after[1] !== before[1], `${before.join(' / ')} → ${after.join(' / ')}`)
  /* The range is 8 → 12 now rather than 8 → 20, so the ground the closed knit loses over it is a
     third of what it was: capacity goes as pace^0.85 against production's pace^1, and that gap is
     only worth 1.8 points of throughput across four km/h. */
  check(
    'and the fields answer it too',
    afterField[0] < beforeField[0] - 0.01,
    `${pc(beforeField[0])} → ${pc(afterField[0])}`,
  )
}

console.log('')
check('and nothing threw', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean')

console.log(`\n${failures ? `${failures} failed` : 'the fields run, the figures are the fields'}`)
await browser.close()
process.exit(failures ? 1 : 0)
