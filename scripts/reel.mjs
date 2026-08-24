/**
 * Does the reel run its six phases, and does every column actually paint?
 *
 * Both halves of that are things nothing else can see.
 *
 * **The paint.** A `<video>` that is playing — `readyState` 4, `paused` false,
 * `videoWidth` set, `error` null — and painting nothing looks identical from script to one
 * painting footage. So this reads the pixels the page produced: it screenshots the section
 * and samples the middle of every tile substantially inside the window. Footage is never
 * flat and no clip in the set has a dark frame (the darkest measures 53), so a tile
 * sampling near zero is a tile that isn't there. It caught one within a minute of being
 * written — `valley` trimmed 1.6s past the end of its shot, so every loop ended on the
 * source's own fade to black.
 *
 * **The phases.** The section arrives empty, fills one column at a time, empties again,
 * holds on the headline alone, inverts, and then slides up out of the window with the type
 * still in it. Each of those is only correct *relative to the others*, and each is a plain
 * assertion about one frame: no tile on screen before 100, four or more up at 240, the room
 * empty again by 440, white by 745, and gone at 940. `lib/reel.ts` is the storyboard; this
 * is the check that it's still what the page does.
 *
 * Positions are in `svh` of scroll from the moment the section's top edge reaches the
 * bottom of the window — the same `s` the component is written in, so a failure here reads
 * against the timeline rather than needing conversion.
 *
 *   scripts/reel.sh
 */
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decode } from './png.mjs'

const require = createRequire(process.env.PW_BASE ?? import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE ?? 'http://localhost:5174'
const STEPS = (process.env.STEPS ?? '90,120,160,200,280,340,400,440,500,580,660,745,810,875,940,1040')
  .split(',')
  .map(Number)
const W = Number(process.env.W ?? 1440)
const H = Number(process.env.H ?? 900)

/**
 * A tile counts as on screen once a fifth of it is, which is also the threshold for
 * sampling it: less than that and the sample lands too near an edge to mean anything.
 */
const SHOWING = 0.2

/**
 * Mean luminance below which a tile isn't painting. The darkest single frame across the six
 * clips measures 53 (`forest`, in the fog), so this has a wide margin — it's looking for the
 * black backing behind a video, not for a dark scene.
 */
const LIT = 12

/** `KEEP=dir` leaves the sampled screenshots behind, which is how you see what it saw. */
const dir = process.env.KEEP ?? (await mkdtemp(join(tmpdir(), 'shoe-reel-')))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 20000 })

const section = await page.evaluate(() => {
  const el = document.querySelector('.reel')
  if (!el) return null
  return {
    top: el.offsetTop,
    window: window.innerHeight,
    // Six, four or three, depending on the width — so the emptiness floor below scales with
    // the layout instead of asserting the desktop form at every size.
    columns: document.querySelectorAll('.reel__col').length,
  }
})

if (!section) {
  console.error('no .reel in the page — is the switch off? (localStorage, or ?reel=0)')
  process.exit(1)
}

/**
 * Nothing here is hard-coded: two of the boundaries are sliders (`components/ReelDials.tsx`),
 * so the page publishes its own resolved timeline on `document.documentElement.dataset.reel`
 * and this reads it. Same arrangement as `dataset.variants` — the check states the invariants
 * and the page states the numbers.
 */
const phases = await page.evaluate(() => {
  try {
    return JSON.parse(document.documentElement.dataset.reel ?? 'null')
  } catch {
    return null
  }
})
if (!phases) {
  console.error('no data-reel on the page — Reel.tsx should publish it')
  process.exit(1)
}
const { rules: RULES, title: TITLE, tiles: TILES, flip: FLIP, exit: EXIT, pin: PINNED_TO } = phases
const [FIRST_IN, LAST_IN] = TILES
const [FLIP_FROM, FLIP_TO] = FLIP

/**
 * The last exit isn't published, because it depends on how tall a tile is at the current
 * column width and only the browser knows that. It doesn't need to be: what matters is that
 * the room is empty *before the inversion starts*, which is the phase order — so the flip's
 * own start is the assertion point.
 */
const EMPTY_UNTIL = FIRST_IN - 10
const FULL_AT = LAST_IN + 20

/**
 * A third of the way into the inversion, not at the start of it.
 *
 * The tolerance is there because the Invert dial can be set to overlap the last exit — at the
 * current 425 it does, by about 10svh, which is the last column's tail crossing a room that has
 * just started to lift off black. That's a judgement someone made with the slider. What the
 * check is for is the thing that isn't a judgement: no footage on a room that has *visibly*
 * changed, which by a third of the way through is unarguable.
 */
const EMPTY_AGAIN = Math.round(FLIP_FROM + (FLIP_TO - FLIP_FROM) / 3)

/** A viewport past the end of the pin, where the room should be long gone. */
const GONE_AT = PINNED_TO + 100

/**
 * How many columns have to be showing at FULL_AT. Half of them, rounded up: they arrive and
 * leave at six different times by design, so this catches the starts and the speeds drifting
 * out of tune with each other rather than holding a composition.
 */
const OCCUPIED = Math.max(2, Math.ceil(section.columns / 2))

/** Luminance of a box, from the decoded screenshot: mean, and the two extremes. */
const lumaOf = (png, box) => {
  let sum = 0
  let n = 0
  let min = 255
  let max = 0
  for (let y = Math.round(box.top); y < Math.round(box.bottom); y += 2)
    for (let x = Math.round(box.left); x < Math.round(box.right); x += 2) {
      if (x < 0 || y < 0 || x >= png.w || y >= png.h) continue
      const i = y * png.stride + x * png.bpp
      const l = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]
      sum += l
      if (l < min) min = l
      if (l > max) max = l
      n++
    }
  return n ? { mean: sum / n, min, max } : { mean: 0, min: 0, max: 0 }
}

/** Just the mean, which is what a tile is judged on. */
const luma = (png, box) => lumaOf(png, box).mean

/** The middle half of a box, so an edge or a rule can't carry a sample. */
const middle = (box, bottom) => {
  const top = Math.max(box.top, 0)
  const foot = Math.min(box.bottom, bottom)
  const at = (v, a, b) => a + (b - a) * v
  return {
    left: at(0.25, box.left, box.right),
    right: at(0.75, box.left, box.right),
    top: at(0.25, top, foot),
    bottom: at(0.75, top, foot),
  }
}

/** Everything the page can say about one frame of the section. */
const read = (min) =>
  page.evaluate((showing) => {
    const seen = (r) => {
      const top = Math.max(r.top, 0)
      const bottom = Math.min(r.bottom, window.innerHeight)
      return r.height ? Math.max(0, bottom - top) / r.height : 0
    }
    const head = document.querySelector('.reel__head')
    // Whatever the reel hands the page back to — the colourway strip, as it happens.
    // Asked for by position rather than by class, because what follows this section is
    // the section below's business and not this check's.
    const next = document.querySelector('.reel')?.nextElementSibling
    const box = head.getBoundingClientRect()
    return {
      tiles: [...document.querySelectorAll('.reel__tile')]
        .map((el) => {
          const r = el.getBoundingClientRect()
          return { part: seen(r), left: r.left, right: r.right, top: r.top, bottom: r.bottom }
        })
        .filter((t) => t.part >= showing),
      room: getComputedStyle(document.querySelector('.reel__room')).backgroundColor,
      // Where the room itself is. Pinned at 0 for most of the section; at the end the pin
      // ends and it slides up out of the window, taking the headline with it.
      roomTop: document.querySelector('.reel__room').getBoundingClientRect().top,
      roomBottom: document.querySelector('.reel__room').getBoundingClientRect().bottom,
      head: {
        opacity: Number(getComputedStyle(head).opacity),
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
      },
      // The rules draw with scaleY, so their painted height is the state to read.
      rules: [...document.querySelectorAll('.reel__rules span')].map(
        (el) => el.getBoundingClientRect().height / window.innerHeight,
      ),
      // How much of the window the section below has taken as the reel leaves.
      next: next
        ? Math.min(1, Math.max(0, (window.innerHeight - next.getBoundingClientRect().top) / window.innerHeight))
        : 0,
    }
  }, min)

/** `s` in svh from the moment the section's top edge reaches the bottom of the window. */
const goto = async (s) => {
  await page.evaluate(
    ({ s, sec }) =>
      window.scrollTo({ top: sec.top - sec.window + (s / 100) * sec.window, behavior: 'instant' }),
    { s, sec: section },
  )
  // The springs are deliberately slow to settle, and a tile sampled mid-flight is a tile
  // sampled in the wrong place.
  await page.waitForTimeout(1400)
}

/** Screenshot, decode, and report what the page says about the same frame. */
const frame = async (s, name) => {
  await goto(s)
  const path = join(dir, `${name}.png`)
  await page.screenshot({ path })
  return { png: decode(path), state: await read(SHOWING) }
}

let failures = 0
console.log(
  `reel · ${W}×${H} · ${section.columns} columns · rules ${RULES.join('–')}, ` +
    `type ${TITLE.join('–')}, tiles ${FIRST_IN}–${LAST_IN}, invert ${FLIP_FROM}–${FLIP_TO}, ` +
    `exit ${EXIT ? EXIT.join('–') : 'on release'}, pin ends ${PINNED_TO}\n`,
)
console.log('   svh   showing  dimmest tile  room       rules  head  room top  next')

for (const s of STEPS) {
  const { png, state } = await frame(s, `s${s}`)

  const dimmest = state.tiles.reduce(
    (min, t) => Math.min(min, luma(png, middle(t, H))),
    Infinity,
  )

  const early = s < EMPTY_UNTIL && state.tiles.length > 0
  const dark = state.tiles.length > 0 && dimmest < LIT
  const thin = s === FULL_AT && state.tiles.length < OCCUPIED
  const late = s >= EMPTY_AGAIN && state.tiles.length > 0
  if (early || dark || thin || late) failures++

  const drawn = state.rules.reduce((a, b) => a + b, 0) / (state.rules.length || 1)
  console.log(
    `  ${String(s).padEnd(5)}  ${String(state.tiles.length).padStart(4)}/${section.columns}  ` +
      `${(state.tiles.length ? dimmest : 0).toFixed(1).padStart(11)}  ` +
      `${state.room.replace('rgb(', '').replace(')', '').padEnd(9)}  ` +
      `${(drawn * 100).toFixed(0).padStart(4)}%  ` +
      `${state.head.opacity.toFixed(2).padStart(4)}  ` +
      `${state.roomTop.toFixed(0).padStart(8)}  ` +
      `${(state.next * 100).toFixed(0).padStart(4)}%` +
      (early ? '  TOO EARLY' : '') +
      (dark ? '  BLACK TILE' : '') +
      (thin ? '  TOO EMPTY' : '') +
      (late ? '  STILL THERE' : ''),
  )
}

const check = (label, ok, detail) => {
  if (!ok) failures++
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(38)} ${detail}`)
}

console.log('\nphases')

/**
 * Mid-growth, which is the frame that shows the rules staggered: the spread between the
 * tallest and the shortest is the evidence they aren't all drawing at once. Sampled from the
 * published window rather than a fixed number, because the Opening dial moves it.
 */
{
  const { state } = await frame(Math.round((RULES[0] + RULES[1]) / 2), 'arriving')
  const [tallest, shortest] = [Math.max(...state.rules), Math.min(...state.rules)]
  check('arrives empty', state.tiles.length === 0, `${state.tiles.length} tiles on screen`)
  check('arrives dark', state.room === 'rgb(8, 8, 10)', state.room)
  check('rules grow on the way in', tallest > 0.05, `tallest ${(tallest * 100).toFixed(0)}%`)
  check('and they are staggered', tallest - shortest > 0.08, `spread ${((tallest - shortest) * 100).toFixed(0)}%`)
  check('headline waits for them', state.head.opacity < 0.05, `opacity ${state.head.opacity.toFixed(2)}`)
}

/** The rules are done, and only now does the headline start. That order is the request. */
{
  const { state } = await frame(RULES[1], 'ruled')
  check(
    'rules finish first',
    Math.min(...state.rules) > 0.99,
    `shortest ${(Math.min(...state.rules) * 100).toFixed(0)}%`,
  )
  check('headline still holding', state.head.opacity < 0.1, `opacity ${state.head.opacity.toFixed(2)}`)
}

{
  const { state } = await frame(EMPTY_UNTIL, 'opened')
  check('nothing on screen before the wall', state.tiles.length === 0, `${state.tiles.length} tiles`)
}

{
  const { state } = await frame(TITLE[1], 'typed')
  check('headline lands', state.head.opacity > 0.99, `opacity ${state.head.opacity.toFixed(2)}`)
}

{
  const { png, state } = await frame(EMPTY_AGAIN, 'held')
  const type = lumaOf(png, middle(state.head, H))
  check(
    'footage gone as the room lifts',
    state.tiles.length === 0,
    state.tiles.length === 0
      ? '0 tiles'
      : `${state.tiles.length} still up at ${EMPTY_AGAIN} — invert is dialled to ${FLIP_FROM}, ` +
        'and a tile is a share of its column width, so a wide short window clears later',
  )
  check('and it is still nearly black', lumaOf(png, { left: 0, right: 40, top: 0, bottom: 40 }).mean < 60, state.room)
  check('headline stays put', state.head.opacity > 0.99, `opacity ${state.head.opacity.toFixed(2)}`)
  check('type is light on the dark room', type.max > 200, `lightest ${type.max.toFixed(0)} of 255`)
}

/**
 * The room inverts. The headline's colour is never animated — `difference` renders it as
 * `|room − white|` — so the type turning black is only observable in the pixels, and this is
 * where that gets asserted: at 520 the room is white, and where the type is, it is not.
 */
{
  const { png, state } = await frame(FLIP_TO, 'inverted')
  const type = lumaOf(png, middle(state.head, H))
  check('turns white', state.room === 'rgb(255, 255, 255)', state.room)
  check('still pinned', Math.abs(state.roomTop) < 2, `room top ${state.roomTop.toFixed(0)}px`)
  check('headline is still there', state.head.opacity > 0.99, `opacity ${state.head.opacity.toFixed(2)}`)
  /**
   * Read as extremes, not as a mean: the box is glyphs *and* the room between them, so its
   * average says almost nothing. What proves the inversion is that the darkest thing in it
   * is now dark and the lightest is the room — the exact opposite of `held` above.
   */
  check('type went dark with the room', type.min < 40, `darkest ${type.min.toFixed(0)} of 255`)
  check('room behind it is white', type.max > 250, `lightest ${type.max.toFixed(0)}`)
}

/**
 * And then the whole thing leaves, headline included — under its own power now, at half the
 * page's speed. Halfway through the window it should have travelled a quarter of a viewport
 * for the half a viewport scrolled, which is the rate, and it's the whole reason the exit
 * isn't just the sticky release.
 */
if (EXIT) {
  const midway = Math.round((EXIT[0] + EXIT[1]) / 2)
  const { state } = await frame(midway, 'leaving')
  const travelled = -state.roomTop / H
  const scrolled = (midway - EXIT[0]) / 100
  check(
    'leaves at about half page speed',
    Math.abs(travelled / scrolled - 0.5) < 0.08,
    `${(travelled * 100).toFixed(0)}svh moved per ${(scrolled * 100).toFixed(0)} scrolled`,
  )
}

{
  const { state } = await frame(GONE_AT, 'gone')
  check('room has left the window', state.roomBottom <= 1, `room bottom ${state.roomBottom.toFixed(0)}px`)
  check('headline went with it', state.head.bottom <= 1, `head bottom ${state.head.bottom.toFixed(0)}px`)
  check('next section has the window', state.next > 0.99, `${(state.next * 100).toFixed(0)}% of it`)
}

if (errors.length) {
  failures++
  console.log(`\nconsole: ${errors.slice(0, 5).join(' · ')}`)
}

await browser.close()
if (!process.env.KEEP) await rm(dir, { recursive: true, force: true })

console.log(
  failures
    ? `\n${failures} problem(s)`
    : '\narrives empty, fills one at a time, empties, inverts, leaves',
)
process.exit(failures ? 1 : 0)
