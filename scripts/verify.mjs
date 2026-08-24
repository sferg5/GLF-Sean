/**
 * End-to-end check that real scrolling lands on both end states.
 *
 * The debug scrubber and the scroll path share everything downstream of
 * useStageProgress, so a variant can look perfect under `?p=` while the dead
 * zones, easing or spring leave actual scrolling short of 0 or 1. This scrolls for
 * real and compares against the scrubbed reference frames pixel by pixel.
 *
 *   scripts/verify.sh
 */
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decode, meanDiff } from './png.mjs'

const require = createRequire(process.env.PW_BASE ?? import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE ?? 'http://localhost:5174'
/** Anti-aliasing and the odd subpixel land around 0.2; anything real is far above. */
const TOLERANCE = 1.0

const dir = await mkdtemp(join(tmpdir(), 'shoe-verify-'))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const ready = () =>
  page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 15000 })

/**
 * The stage, with nothing of the page's own furniture on top of it.
 *
 * Every screenshot here is an element shot of `.stage`, and for a long time that excluded the
 * chrome by geometry alone: the stage is 1152px of a 1440px window, so the picker at the top and
 * the hint at the bottom both fall outside it. That was a coincidence of the proportions, and the
 * section-order panel is the one that broke it — 190px wide against 144px of margin, so it lands
 * in the shot, and it's *up* in a scrubbed reference (scroll is at zero) and receded in a
 * scrolled one. 2.9 of mean difference, in a check whose tolerance is 1.0 and whose whole job is
 * to notice a difference of that size.
 *
 * Hiding it explicitly is what the check meant all along. `position: fixed` throughout, so
 * nothing here moves the stage; and it's re-applied per shot because a style tag belongs to the
 * document it was added to.
 */
/* `.sitenav` joins them for the same reason, and it's the worst offender of the three: it's
   fixed over the top-centre of the window, so unlike the picker it lands inside the stage at
   every viewport rather than only at narrow ones. */
const CHROME = '.topbar, .panel, .sitenav { display: none !important }'

const shot = async (name) => {
  const path = join(dir, `${name}.png`)
  await page.addStyleTag({ content: CHROME })
  await page.locator('.stage').screenshot({ path })
  return decode(path)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
// Published by App.tsx, so this doesn't depend on chrome markup.
const { COUNT, CLEAN } = await page.evaluate(() => {
  const d = document.documentElement.dataset
  return {
    COUNT: (d.variants ?? '').split('|').filter(Boolean).length,
    CLEAN: (d.cleanEnds ?? '').split('|').map((v) => v !== '0'),
  }
})

let failures = 0
console.log('variant  end      scrolled vs scrubbed (mean |diff| of 255)')

for (let v = 1; v <= COUNT; v++) {
  for (const [label, target] of [['start', 0], ['end', 1]]) {
    await page.goto(`${BASE}/?v=${v}&p=${target}`, { waitUntil: 'networkidle' })
    await ready()
    await page.waitForTimeout(200)
    const reference = await shot(`v${v}-${label}-ref`)

    await page.goto(`${BASE}/?v=${v}`, { waitUntil: 'networkidle' })
    await ready()
    /**
     * The end of the *stage's* section, not the end of the document.
     *
     * There are two sections below the stage now — the reel and the colourway strip — so
     * the bottom of the page is nine viewports of something else and the sticky stage has
     * long been scrolled past. What
     * saves the old version is Playwright scrolling an element into view before
     * screenshotting it: the minimum scroll that brings a sticky element back is
     * exactly the end of its own range, so it lands on p=1 by recovery. That's a
     * coincidence of this page's proportions and not something to leave a check
     * standing on — anything taller than a viewport below the stage photographs the
     * reveal mid-flight, and the failure reads as an easing bug. The stage's section is
     * what its timeline is measured against, so run to the end of that. Scoped that way,
     * this needs nothing switched off: the page is verified as it ships.
     */
    await page.evaluate((atEnd) => {
      const section = document.querySelector('.section')
      const max = section.offsetTop + section.offsetHeight - window.innerHeight
      window.scrollTo({ top: atEnd ? max : 0, behavior: 'instant' })
    }, target === 1)
    // Springs settle asynchronously; give them longer than a frame.
    await page.waitForTimeout(900)
    const actual = await shot(`v${v}-${label}-scrolled`)

    const d = meanDiff(reference, actual)
    const ok = d <= TOLERANCE
    if (!ok) failures++
    console.log(`   ${v}     ${label.padEnd(6)}  ${d.toFixed(3)}  ${ok ? 'ok' : 'MISMATCH'}`)
  }
}

/**
 * A reveal's end states must be the clean photographs — no grade, wash, front
 * sprite or drain left parked at 0 or 1.
 *
 * This used to be checked transitively: make every variant agree with variant 1,
 * whose own end states were bare by inspection. That only ever asserted anything
 * when two or more variants were registered, and it went quiet the moment the
 * registry was down to one — a check that can be disarmed by deleting the thing
 * it was comparing against isn't much of a check.
 *
 * The reference is now `prefers-reduced-motion`, which collapses these variants to
 * `Crossfade` — two photographs and an opacity, and nothing else that could leave
 * residue. So each variant is compared against its own reduced form, and the
 * assertion holds however many variants exist.
 *
 * Variants that publish `cleanEnds: false` are exempt, and only from this check.
 * The section plate is one: it ends on an annotated blueprint on purpose, and that
 * is the design rather than residue. It still has to pass the scroll-versus-scrub
 * check above, which is the one that catches easing and spring bugs, so opting out
 * here buys a variant no slack on anything else.
 */
const clean = []
for (let v = 1; v <= COUNT; v++) if (CLEAN[v - 1]) clean.push(v)

const skipped = COUNT - clean.length
console.log(
  '\nend states are the bare photographs (vs reduced motion)' +
    (skipped ? ` · ${skipped} exempt via cleanEnds:false` : ''),
)

for (const v of clean) {
  for (const [label, target] of [['start', 0], ['end', 1]]) {
    const url = `${BASE}/?v=${v}&p=${target}`

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(url, { waitUntil: 'networkidle' })
    await ready()
    await page.waitForTimeout(200)
    const bare = await shot(`v${v}-${label}-bare`)

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(url, { waitUntil: 'networkidle' })
    await ready()
    await page.waitForTimeout(200)
    const d = meanDiff(bare, await shot(`v${v}-${label}-full`))

    const ok = d <= TOLERANCE
    if (!ok) failures++
    console.log(`   ${v}     ${label.padEnd(6)}  ${d.toFixed(3)}  ${ok ? 'ok' : 'RESIDUE'}`)
  }
}
await page.emulateMedia({ reducedMotion: 'no-preference' })

await browser.close()
await rm(dir, { recursive: true, force: true })

console.log(failures ? `\n${failures} mismatch(es)` : '\nall variants reach both end states by scroll alone')
process.exit(failures ? 1 : 0)
