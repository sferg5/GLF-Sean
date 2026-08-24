/**
 * Does the film play once when it should, and does the frame close around it as you scroll?
 *
 * Four things that are easy to break and quiet about it:
 *
 * **Playing at all.** A muted autoplay is refused in more situations than it's honoured in, and a
 * refusal looks identical to a poster: the section still fills the window with the right image,
 * and nothing in the console says why it never moved. So this asserts the film is *paused before*
 * three quarters of it is on screen and *running after*, which is also the only way to catch the
 * threshold being wrong in either direction.
 *
 * **Not looping.** The request was explicit. A `loop` attribute creeping back in, or a re-entry
 * handler resetting a film that hadn't finished, is invisible unless something waits out the six
 * seconds and then keeps watching — which is what this does.
 *
 * **The shrink, and its reversal.** Scale and radius are a pure function of scroll position, so
 * the reversal isn't a separate feature and shouldn't need a separate mechanism — but "shouldn't
 * need" is exactly the kind of claim that stops being true. Both directions are checked, off the
 * computed transform matrix rather than off anything the page says about itself.
 *
 * **The radius compensation.** The box is scaled by a transform, so a transform scales its corner
 * radius too. The declared value is divided by the scale to compensate; if that ever comes
 * undone, the corners look right at one end of the section and wrong at the other, which is
 * precisely the sort of thing nobody notices until it ships.
 *
 *   scripts/clip.sh
 */
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const require = createRequire(process.env.PW_BASE ?? import.meta.url)
const { chromium } = require('playwright')
const run = promisify(execFile)

const BASE = process.env.BASE ?? 'http://localhost:5174'
const W = Number(process.env.W ?? 1440)
const H = Number(process.env.H ?? 900)

const ASSET = W <= 640 ? 'public/clip/shoe-768.mp4' : 'public/clip/shoe-1600.mp4'

/** What it shrinks to, and the radius that should be *seen* at that size. */
const SCALE_TO = 0.8
const RADIUS = 28

const browser = await chromium.launch()

let failures = 0
const check = (label, ok, detail) => {
  if (!ok) failures++
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(42)} ${detail}`)
}

const probe = async (...args) => (await run('ffprobe', args)).stdout.trim()

console.log(`clip · ${W}×${H}\n`)
console.log('the asset')

const streams = await probe(
  '-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', ASSET,
)
const frames = Number(
  await probe(
    '-v', 'error', '-count_frames', '-select_streams', 'v',
    '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', ASSET,
  ),
)
const dur = Number(await probe('-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ASSET))

const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

const asked = []
page.on('request', (r) => r.url().includes('/clip/') && asked.push(r.url()))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 20000 })

const published = JSON.parse(await page.evaluate(() => document.documentElement.dataset.clip))

check('the frame count is what the code says', frames === published.frames, `${frames} frames`)
check('six seconds of it', Math.abs(dur - published.frames / published.fps) < 0.05, `${dur.toFixed(2)}s`)
/* Playback doesn't need the audio, and shipping it would be shipping bytes nobody can hear. */
check('and no audio track', !streams.split('\n').includes('audio'), streams.split('\n').join('+'))

/** Where the section starts, and how far it travels while pinned. */
const geo = await page.evaluate(() => {
  const r = document.querySelector('.clip').getBoundingClientRect()
  return { top: r.top + window.scrollY, height: r.height, vh: window.innerHeight }
})
const travel = geo.height - geo.vh

/** Scroll to a fraction of the pinned travel and read what the box is doing. */
const at = async (frac, settle = 450) => {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), geo.top + travel * frac)
  await page.waitForTimeout(settle)
  return page.evaluate(() => {
    const box = document.querySelector('.clip__box')
    const v = document.querySelector('.clip__video')
    const s = getComputedStyle(box)
    const m = new DOMMatrixReadOnly(s.transform)
    return {
      scale: +m.a.toFixed(4),
      radius: parseFloat(s.borderTopLeftRadius),
      paused: v.paused ?? null,
      ended: v.ended ?? null,
      t: v.currentTime ?? null,
      loops: v.loop ?? null,
    }
  })
}

console.log('\nthe frame closing')

const open = await at(0)
const mid = await at(published.shrinkEnd / 2)
const shut = await at(published.shrinkEnd)
const held = await at(1)

check('full bleed where it arrives', Math.abs(open.scale - 1) < 0.01, `scale ${open.scale}`)
check('and square-cornered there', open.radius < 1, `${open.radius}px`)
check('shrunk by the end of its window', Math.abs(shut.scale - SCALE_TO) < 0.01, `scale ${shut.scale}`)
check('and it holds to the end of the pin', Math.abs(held.scale - SCALE_TO) < 0.01, `scale ${held.scale}`)
check('the middle is between the two', mid.scale < open.scale && mid.scale > shut.scale, `scale ${mid.scale}`)

/**
 * The compensation: a transform scales the radius with the box, so what's declared has to be
 * larger than what should be seen. 35 declared × 0.8 drawn = 28 on the glass.
 */
check(
  'the corner radius lands where it should',
  Math.abs(shut.radius * shut.scale - RADIUS) < 1.5,
  `${shut.radius}px declared × ${shut.scale} = ${(shut.radius * shut.scale).toFixed(1)}px seen`,
)

/* Back up the page. Nothing implements this — it's the same function of scroll read backwards —
   which is exactly why it's worth an assertion rather than an assumption. */
const back = await at(published.shrinkEnd / 2)
check('scrolling back up reverses it', Math.abs(back.scale - mid.scale) < 0.02, `scale ${back.scale}`)
const reopened = await at(0)
check('all the way to full bleed again', Math.abs(reopened.scale - 1) < 0.01, `scale ${reopened.scale}`)

console.log('\nthe film')

/* Well clear of the section, where less than three quarters of the box can possibly be showing. */
await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), geo.top - geo.vh * 1.2)
await page.waitForTimeout(700)
const before = await page.evaluate(() => {
  const v = document.querySelector('.clip__video')
  return { paused: v.paused, t: v.currentTime }
})
check('paused before it is properly on screen', before.paused === true, `t ${before.t.toFixed(2)}`)

const entered = await at(0.05, 900)
check('and running once it is', entered.paused === false, `t ${entered.t.toFixed(2)}`)
check('it does not loop', entered.loops === false, `loop=${entered.loops}`)

/* Six seconds of film, then a further two watching that it stays finished. */
await page.waitForTimeout(6500)
const done = await page.evaluate(() => {
  const v = document.querySelector('.clip__video')
  return { ended: v.ended, t: v.currentTime }
})
await page.waitForTimeout(1800)
const after = await page.evaluate(() => {
  const v = document.querySelector('.clip__video')
  return { ended: v.ended, t: v.currentTime }
})

check('it reaches the end', done.ended === true, `t ${done.t.toFixed(2)}`)
check('and stays there rather than starting over', after.ended === true && after.t >= done.t - 0.1, `t ${after.t.toFixed(2)}`)

/* And it stops when it isn't being looked at. */
await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), geo.top + geo.height + geo.vh)
await page.waitForTimeout(700)
const gone = await page.evaluate(() => document.querySelector('.clip__video').paused)
check('paused again once you have scrolled past', gone === true, `paused=${gone}`)

console.log('\nreduced motion')

{
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  })
  const p2 = await ctx.newPage()
  const got = []
  p2.on('request', (r) => r.url().includes('/clip/') && got.push(r.url()))
  await p2.goto(BASE, { waitUntil: 'networkidle' })
  await p2.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 20000 })

  const meta = JSON.parse(await p2.evaluate(() => document.documentElement.dataset.clip))
  check('the section collapses', meta.reduced === true && meta.pin === 120, `${meta.pin}svh`)

  const parked = await p2.evaluate(() => {
    const box = document.querySelector('.clip__box')
    const s = getComputedStyle(box)
    return { scale: +new DOMMatrixReadOnly(s.transform).a.toFixed(4), radius: parseFloat(s.borderTopLeftRadius) }
  })
  /* Parked at the composition the section is *for*, not at the state it starts from. */
  check('parked at the card, not at full bleed', Math.abs(parked.scale - SCALE_TO) < 0.01, `scale ${parked.scale}`)
  check('and rounded', parked.radius > 20, `${parked.radius}px`)

  await p2.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
  await p2.waitForTimeout(700)
  check('it is a still, not a video', (await p2.locator('img.clip__video').count()) === 1, 'img')
  check(
    'and the film is never fetched',
    got.every((u) => !u.endsWith('.mp4')),
    got.length ? got.map((u) => u.split('/').pop()).join(' ') : 'nothing from /clip/',
  )
  await ctx.close()
}

/* One tier per page load, and only one. */
const mp4s = new Set(asked.filter((u) => u.endsWith('.mp4')))
check('one encode fetched, matching the tier', mp4s.size === 1 && [...mp4s][0].includes(published.tier === 'phone' ? '768' : '1600'), [...mp4s].map((u) => u.split('/').pop()).join(' ') || 'none')

if (errors.length) console.log(`\nconsole: ${errors.slice(0, 5).join(' · ')}`)

await browser.close()
console.log(failures ? `\n${failures} problem(s)` : '\nplays once, closes its frame, and opens it again on the way back')
process.exit(failures ? 1 : 0)
