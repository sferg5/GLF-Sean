/**
 * The show-zero hero, held to the same standard as the x-ray.
 *
 * The hero is a bench test now — one button sprays both samples, the jersey marks
 * and dries, ShowZero never shows — so the checks follow suit:
 *
 * 1. **A pinned frame reproduces.** With the cloth parked (`breeze=0`) and the
 *    moisture pinned (`?p=`), two loads must be pixel-identical. This is the check
 *    that catches anything reading the clock outside the sanctioned loop.
 *
 * 2. **Specimen B stays clean — enforced by pixels.** Dry pin vs soaked pin:
 *    specimen A's crop must change (the marks really render); specimen B's must
 *    not (the claim really holds). "Marks 0.0 cm²" is a caption — this is the
 *    measurement.
 *
 * 3. **The spray wets and the jersey dries.** Press the real button, watch the
 *    published moisture rise past half, then — with the dry dial pinned short via
 *    its URL param — watch it come back down. The interaction loop, end to end.
 *
 * 4. **The words under the test arrive, on this page's wall.** The prose section is
 *    the shoe page's component with this page's copy in it, so its reveal is
 *    scroll-linked opacity and can be left parked at zero; and the one thing it
 *    doesn't share is the wall, which must stay the fixed light page however the
 *    picker was last left.
 *
 *   scripts/showzero.sh
 */
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decode, meanDiff } from './png.mjs'

const require = createRequire(process.env.PW_BASE ?? import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE ?? 'http://localhost:5174'
const TOLERANCE = 1.0

const dir = await mkdtemp(join(tmpdir(), 'showzero-'))
/* SwiftShader, so the check runs on machines without a GPU and renders the same way
   every time. */
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

/* The nav sits over the viewport in every shot; identical in both frames, but
   hidden anyway — the check is about the scene, and verify.mjs makes the same call.
   The dial toggle joins it for the same reason. */
const CHROME = '.sitenav, .sz__dialtoggle { display: none !important }'

const shot = async (name, clip) => {
  const path = join(dir, `${name}.png`)
  await page.addStyleTag({ content: CHROME })
  await page.screenshot({ path, clip })
  return decode(path)
}

/* GL first paint has no `.loading` gate to wait on; the scene is demand-rendered on
   mount, so a settle covers chunk + geometry + first frame. */
const settle = () => page.waitForTimeout(1200)

const FULL = { x: 0, y: 0, width: 1440, height: 900 }
/* Specimen crops: each sample hangs at a quarter point of a 1440×900 viewport,
   between the headline and the instrument panel. */
const CROP_A = { x: 150, y: 260, width: 510, height: 500 }
const CROP_B = { x: 780, y: 260, width: 510, height: 500 }

let failures = 0
console.log('a pinned frame reproduces (mean |diff| of 255)')

await page.goto(`${BASE}/?page=show-zero&breeze=0&p=0.5`, { waitUntil: 'networkidle' })
await settle()
const once = await shot('pin-once', FULL)
await page.goto(`${BASE}/?page=show-zero&breeze=0&p=0.5`, { waitUntil: 'networkidle' })
await settle()
const twice = await shot('pin-twice', FULL)
{
  const d = meanDiff(once, twice)
  const ok = d <= TOLERANCE
  if (!ok) failures++
  console.log(`   p=0.5 × 2   ${d.toFixed(3)}  ${ok ? 'ok' : 'MISMATCH'}`)
}

/* The draped hang is its own baked pose and its own light — same bar. */
await page.goto(`${BASE}/?page=show-zero&breeze=0&p=0.5&drape=draped`, { waitUntil: 'networkidle' })
await settle()
const drapedOnce = await shot('draped-once', FULL)
await page.goto(`${BASE}/?page=show-zero&breeze=0&p=0.5&drape=draped`, { waitUntil: 'networkidle' })
await settle()
const drapedTwice = await shot('draped-twice', FULL)
{
  const d = meanDiff(drapedOnce, drapedTwice)
  const ok = d <= TOLERANCE
  if (!ok) failures++
  console.log(`   draped × 2  ${d.toFixed(3)}  ${ok ? 'ok' : 'MISMATCH'}`)
}

console.log('\nspecimen b stays clean (dry pin vs soaked pin)')

await page.goto(`${BASE}/?page=show-zero&breeze=0&p=0`, { waitUntil: 'networkidle' })
await settle()
const dryA = await shot('dry-a', CROP_A)
const dryB = await shot('dry-b', CROP_B)

await page.goto(`${BASE}/?page=show-zero&breeze=0&p=1`, { waitUntil: 'networkidle' })
await settle()
const wetA = await shot('wet-a', CROP_A)
const wetB = await shot('wet-b', CROP_B)

const dA = meanDiff(dryA, wetA)
const dB = meanDiff(dryB, wetB)

/* A must move (the marks render at all) and B must not (the product claim). The
   floor on A is what keeps this check from passing on a blank canvas. */
const marksRender = dA > 2.0
const stayedClean = dB <= TOLERANCE
if (!marksRender) failures++
if (!stayedClean) failures++
console.log(`   specimen a  ${dA.toFixed(3)}  ${marksRender ? 'ok — marks render' : 'NOTHING RENDERED'}`)
console.log(`   specimen b  ${dB.toFixed(3)}  ${stayedClean ? 'ok — nothing to show' : 'MARKS SHOWED'}`)

console.log('\nthe spray wets and the jersey dries (dry dial pinned to 3s)')

/* Cloth parked so the only clock is the moisture animation under test; the dry dial pinned short
   via its own URL param, which is what the params are for — and the *amount* pinned too, so this
   asserts "the spray wets" rather than asserting whatever the default happens to be. It read
   `> 0.5` against a default of 0.85 and started failing the day that default became 0.4, which is
   a check about a dial rather than about the mechanism. */
await page.goto(`${BASE}/?page=show-zero&breeze=0&dry=3&amount=0.8`, { waitUntil: 'networkidle' })
await settle()
await page.click('.sz__spray')
let peak = 0
try {
  await page.waitForFunction(() => Number(document.documentElement.dataset.moisture) > 0.5, null, {
    timeout: 2000,
  })
  peak = await page.evaluate(() => Number(document.documentElement.dataset.moisture))
  console.log(`   sprayed     ${peak.toFixed(3)}  ok — moisture rose`)
} catch {
  failures++
  console.log('   sprayed     NEVER ROSE')
}
if (peak > 0) {
  await page.waitForTimeout(3800)
  const dried = await page.evaluate(() => Number(document.documentElement.dataset.moisture))
  const ok = dried < 0.1
  if (!ok) failures++
  console.log(`   3.8s later  ${dried.toFixed(3)}  ${ok ? 'ok — dried back out' : 'STAYED WET'}`)
}

console.log('\nthe words under the test arrive')

/* Same check `sections.mjs` runs on the shoe page's prose, because it's the same
   component: the reveal is scroll-linked opacity, so it can be left parked at 0 and
   the section would look like a hole in the page rather than like a bug. Worth
   repeating here because the wall is the part that isn't shared — this one must be
   the fixed light page and not the picker's, whatever `?bg=` was last set to. */
await page.goto(`${BASE}/?page=show-zero&breeze=0&p=0&bg=1d1616`, { waitUntil: 'networkidle' })
await settle()

const read = () =>
  page.evaluate(() => {
    const lead = document.querySelector('.prose__lead')
    const facts = document.querySelectorAll('.prose__fact')
    const section = document.querySelector('.prose')
    return {
      lead: Number(getComputedStyle(lead).opacity),
      words: lead.textContent.trim().split(/\s+/).length,
      facts: facts.length,
      wall: getComputedStyle(section).backgroundColor,
      top: section.offsetTop,
      height: section.offsetHeight,
    }
  })

const early = await read()
await page.evaluate(
  ({ top, height }) => window.scrollTo({ top: top + height - window.innerHeight, behavior: 'instant' }),
  early,
)
await page.waitForTimeout(700)
const late = await read()

for (const [name, ok, note] of [
  ['the copy is there', late.words > 25 && late.facts === 4, `${late.words} words, ${late.facts} facts`],
  ['it starts hidden', early.lead < 0.05, `lead ${early.lead.toFixed(2)}`],
  ['and arrives in full', late.lead > 0.99, `lead ${late.lead.toFixed(2)}`],
  /* `--page`, not the near-black `?bg=` above: the picker is the shoe page's control. */
  ['on this page’s own wall', late.wall === 'rgb(247, 243, 243)', late.wall],
]) {
  if (!ok) failures++
  console.log(`   ${name.padEnd(26)}${ok ? `ok — ${note}` : `WRONG — ${note}`}`)
}

await browser.close()
await rm(dir, { recursive: true, force: true })

if (errors.length) {
  failures += errors.length
  console.log('\npage errors:')
  for (const e of errors) console.log(`   ${e}`)
}

console.log(failures ? `\n${failures} failure(s)` : '\none bottle, both samples, only one showed it — verified')
process.exit(failures ? 1 : 0)
