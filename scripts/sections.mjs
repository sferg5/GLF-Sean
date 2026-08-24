/**
 * Does the page reorder, and do the two text sections do what they claim?
 *
 * Three things that are easy to break and quiet about it:
 *
 * **The order.** Sections are a list now, so the page's arrangement is data — and data can be
 * wrong. `App.tsx` publishes the resolved order on `document.documentElement.dataset.sections`,
 * so this compares that against the *actual DOM order* of the section elements. Those two
 * agreeing is the whole feature; a render that dropped a section, or a `key` that re-rendered
 * content into the wrong node, shows up here and nowhere else.
 *
 * **The accordion.** A closed answer isn't hidden, it's unmounted, which is what keeps it out of
 * a find-in-page — so "closed" is a DOM assertion and "open" is a height one. The height is
 * animated from and to `auto`, and an `auto` that has been measured wrong is the classic failure:
 * it lands at 0, or it lands clipped, and either way the answer is on the page and unreadable.
 *
 * **The prose reveal.** It's scroll-linked opacity, so it can be left parked at 0 — a section
 * that never fades in is indistinguishable from an empty one, and the copy is the section.
 *
 *   scripts/sections.sh
 */
import { createRequire } from 'node:module'

const require = createRequire(process.env.PW_BASE ?? import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE ?? 'http://localhost:5174'
const W = Number(process.env.W ?? 1440)
const H = Number(process.env.H ?? 900)

/** The element each section id renders as, which is what "the DOM order" is read from. */
const MARKERS = {
  xray: '.section',
  reel: '.reel',
  prose: '.prose',
  colorways: '.cways',
  clip: '.clip',
  faq: '.faq',
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
const page = await context.newPage()

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

/**
 * Every frame here names the order it wants in the URL, including the default one.
 *
 * The panel saves what it's set to, and one context runs every block below — so a step that
 * ends on a dragged order is the starting state of the next one unless each says what it
 * expects. `?order=` wins over storage, which is what makes that a one-word fix rather than a
 * `clearStorage` between steps.
 */
const DEFAULT = 'xray,reel,prose,colorways,clip,faq'

/** Derived, so adding another section does not quietly change what the drag block drags. */
const IDS = DEFAULT.split(',')
const LAST = IDS[IDS.length - 1]

const settle = async () => {
  await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 20000 })
  await page.waitForTimeout(350)
}

/**
 * Open the page's controls, which is where the section list lives.
 *
 * The page opens on the photograph with no chrome at all now — the disclosure pill is gone
 * and the x-ray is its own switch — so this clicks the stage. The `h` key does the same
 * thing and would be steadier, but clicking is what a person does, and a check that only
 * ever exercises the keyboard path wouldn't notice the click path breaking.
 *
 * Everything above this point reads the *order* rather than the panel, off
 * `dataset.sections`, so only the reordering block needs it.
 */
const openControls = async () => {
  if (await page.locator('#page-controls').count()) return
  // The middle of the pinned stage: inside the section, clear of the call-out handles and
  // of any label that could swallow the click.
  await page.locator('.stage').click({ position: { x: 20, y: 20 } })
  await page.locator('.sections__row').first().waitFor({ timeout: 5000 })
  await page.waitForTimeout(250)
}

const ready = async (order = DEFAULT) => {
  await page.goto(`${BASE}/?order=${order}`, { waitUntil: 'networkidle' })
  await settle()
}

/** No query at all, which is the only way to read what the panel *saved*. */
const bare = async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await settle()
}

/** What the page says its order is, and what the document actually does. */
const orders = (markers) =>
  page.evaluate((m) => {
    const selectors = Object.values(m)
    const byNode = new Map(Object.entries(m).map(([id, sel]) => [sel, id]))
    return {
      published: (document.documentElement.dataset.sections ?? '').split('|').filter(Boolean),
      dom: [...document.querySelectorAll(selectors.join(','))].map((el) => {
        for (const [sel, id] of byNode) if (el.matches(sel)) return id
        return '?'
      }),
    }
  }, markers)

let failures = 0
const check = (label, ok, detail) => {
  if (!ok) failures++
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(40)} ${detail}`)
}

console.log(`sections · ${W}×${H}\n`)
console.log('order')

{
  await ready()
  const { published, dom } = await orders(MARKERS)
  check('the default order is the document', published.join(',') === dom.join(','), dom.join(' → '))
  check('and it is the default', dom.join(',') === DEFAULT, dom.join(' → '))
  check('all of them are on the page', dom.length === IDS.length, `${dom.length} sections`)
}

{
  // A permutation nothing else would produce, so a page ignoring `?order=` can't pass by luck.
  const wanted = 'faq,prose,clip,xray,reel,colorways'
  await ready(wanted)
  const { published, dom } = await orders(MARKERS)
  check('a pinned order is honoured', dom.join(',') === wanted, dom.join(' → '))
  check('and published as rendered', published.join(',') === dom.join(','), published.join(','))
}

{
  /**
   * A stale or hand-typed order still has to resolve to a whole page. Unknown ids are dropped
   * and duplicates ignored; whatever is missing is appended in default order. A saved order is a
   * preference, not a document.
   */
  await ready('faq,nonsense,faq')
  const { dom } = await orders(MARKERS)
  check('junk resolves to a full page', dom.length === IDS.length, dom.join(' → '))
  check('and honours what it can', dom[0] === 'faq', `first is ${dom[0]}`)
}

console.log('\nreordering')

{
  // Set the order through the URL, then drop the query: the drag has to start from a known
  // arrangement, and a page still carrying `?order=` would answer the reload check with the link
  // rather than with what was saved.
  await ready()
  await bare()
  await openControls()
  const rows = page.locator('.sections__row')

  // Drag the last row to the top, in steps: motion reorders on movement, not on drop.
  // `last()` rather than a literal index — it used to be `nth(4)`, which meant the FAQ until a
  // sixth section landed in front of it and silently made this a test about the scrub.
  const from = await rows.last().boundingBox()
  const to = await rows.nth(0).boundingBox()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + ((to.y - from.y) * i) / 12)
    await page.waitForTimeout(25)
  }
  await page.mouse.up()
  await page.waitForTimeout(600)

  const dragged = await orders(MARKERS)
  check('dragging a row moves the section', dragged.dom[0] === LAST, dragged.dom.join(' → '))
  check('the DOM follows the panel', dragged.published.join(',') === dragged.dom.join(','), 'published = dom')

  // And without a pointer at all.
  await rows.nth(0).focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(400)
  const keyed = await orders(MARKERS)
  check('arrow keys move it too', keyed.dom[1] === LAST, keyed.dom.join(' → '))

  const before = keyed.dom.join(',')
  await bare()
  const after = await orders(MARKERS)
  check('and it survives a reload', after.dom.join(',') === before, after.dom.join(' → '))

  /**
   * And a link still beats it. Same precedence as every other control here — the saved value is
   * a preference, the URL is what a screenshot or a shared page is showing.
   */
  await ready()
  const pinned = await orders(MARKERS)
  check('a link overrides what was saved', pinned.dom.join(',') === DEFAULT, pinned.dom.join(' → '))
}

console.log('\nthe prose')

{
  // Third, not first: a section at the top of the document has no "before it arrives" to scroll
  // to, and its reveal has already run by the time the page is at zero.
  await ready()

  /** Before its own arrival, the copy is parked at zero — that's the reveal being scroll-linked. */
  const shown = () =>
    page.evaluate(() => {
      const el = document.querySelector('.prose__lead')
      const box = document.querySelector('.prose__body')
      return {
        lead: Number(getComputedStyle(el).opacity),
        body: Number(getComputedStyle(box).opacity),
        /** The one thing that must be true whatever the animation does. */
        words: el.textContent.trim().split(/\s+/).length,
      }
    })

  const prose = await page.evaluate(() => {
    const el = document.querySelector('.prose')
    return { top: el.offsetTop, height: el.offsetHeight }
  })

  await page.evaluate(({ prose }) => window.scrollTo({ top: Math.max(0, prose.top - window.innerHeight), behavior: 'instant' }), { prose })
  await page.waitForTimeout(500)
  const early = await shown()

  await page.evaluate(({ prose }) => window.scrollTo({ top: prose.top + prose.height - window.innerHeight, behavior: 'instant' }), { prose })
  await page.waitForTimeout(700)
  const late = await shown()

  check('the copy is there', late.words > 25, `${late.words} words in the statement`)
  check('it starts hidden', early.lead < 0.05 && early.body < 0.05, `lead ${early.lead.toFixed(2)}`)
  check('and arrives in full', late.lead > 0.99 && late.body > 0.99, `lead ${late.lead.toFixed(2)}, body ${late.body.toFixed(2)}`)
}

console.log('\nthe accordion')

/** Where the FAQ actually lives, which is also the only place the chrome isn't over it. */
const toFaq = async () => {
  const top = await page.evaluate(() => document.querySelector('.faq').offsetTop)
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top)
  await page.waitForTimeout(400)
}

{
  /**
   * Last, and scrolled to — not first and read at the top of the document. At a phone width the
   * top bar stacks onto two rows and the section panel sits under it, and between them they
   * cover the first two questions: Playwright reports a swatch intercepting the click, which is
   * exactly what a thumb would find. The chrome has receded by the time the page is at the FAQ,
   * which is the arrangement the section is designed to be read in anyway.
   */
  await ready()
  await toFaq()

  const state = () =>
    page.evaluate(() => {
      const rows = [...document.querySelectorAll('.faq__row')]
      return rows.map((row) => {
        const panel = row.querySelector('.faq__a')
        return {
          expanded: row.querySelector('.faq__q').getAttribute('aria-expanded'),
          mounted: !!panel,
          height: panel ? Math.round(panel.getBoundingClientRect().height) : 0,
          text: panel ? panel.textContent.trim().length : 0,
        }
      })
    })

  const closed = await state()
  /* A count rather than an exact number: the copy is placeholder and the list has already
     grown once. What this is actually guarding is that the rows render at all — a `map` over
     an empty array and a `map` that threw both leave a section with a heading and nothing
     under it, which reads as a design decision rather than as a bug. */
  check('the questions render', closed.length >= 5, `${closed.length} rows`)
  check('all closed to start', closed.every((r) => !r.mounted && r.expanded === 'false'), 'no answers mounted')

  await page.locator('.faq__row').nth(1).locator('.faq__q').click()
  await page.waitForTimeout(700)
  const opened = await state()
  check('clicking one opens it', opened[1].expanded === 'true' && opened[1].mounted, 'mounted and expanded')
  /**
   * The height is the assertion, not the mounting: `height: auto` animated from 0 lands at 0 if
   * the measurement failed, and the answer is then on the page at nothing tall.
   */
  check(
    'the answer has its full height',
    opened[1].height > 60,
    `${opened[1].height}px for ${opened[1].text} characters`,
  )

  await page.locator('.faq__row').nth(3).locator('.faq__q').click()
  await page.waitForTimeout(800)
  const swapped = await state()
  check('opening another closes the first', !swapped[1].mounted, `row 2 ${swapped[1].mounted ? 'still open' : 'closed'}`)
  check('and the new one is open', swapped[3].height > 60, `${swapped[3].height}px`)

  await page.locator('.faq__row').nth(3).locator('.faq__q').click()
  await page.waitForTimeout(800)
  const shut = await state()
  check('clicking it again closes it', !shut[3].mounted && shut.every((r) => !r.mounted), 'nothing mounted')
}

console.log('\nreduced motion')

{
  const reduced = await context.newPage()
  await reduced.emulateMedia({ reducedMotion: 'reduce' })
  await reduced.goto(`${BASE}/?order=${DEFAULT}`, { waitUntil: 'networkidle' })
  await reduced.waitForFunction(() => !document.querySelector('.loading'))
  await reduced.waitForTimeout(300)
  await reduced.evaluate(() => window.scrollTo({ top: document.querySelector('.faq').offsetTop, behavior: 'instant' }))
  await reduced.waitForTimeout(400)
  await reduced.locator('.faq__row').nth(0).locator('.faq__q').click()
  // Deliberately short: with the fold handed back, the answer is at its height on the next frame.
  await reduced.waitForTimeout(120)
  const height = await reduced.evaluate(() =>
    Math.round(document.querySelector('.faq__a')?.getBoundingClientRect().height ?? 0),
  )
  check('the fold is instant, not absent', height > 60, `${height}px after 120ms`)
  await reduced.close()
}

if (errors.length) {
  failures++
  console.log(`\nconsole: ${errors.slice(0, 5).join(' · ')}`)
}

await browser.close()

console.log(failures ? `\n${failures} problem(s)` : '\nthe page reorders, the copy arrives, the answers fold')
process.exit(failures ? 1 : 0)
