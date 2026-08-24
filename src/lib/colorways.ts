/**
 * The five Pop Tempo colourways, in the order the range is laid out.
 *
 * The photographs are prepared by `scripts/colorways.mjs`: matted, stood upright and
 * trimmed to the shoe, so every file means the same thing by "full width" and one set
 * of CSS numbers frames all five.
 *
 * Each colourway carries two inks because the wall behind this strip used to be a control —
 * the background picker set it anywhere from near-black to paper — and a wordmark set in the
 * shoe's own colour is exactly the case where that bites. Three of the five have enough
 * chroma to hold both ends (measured against Ember and Paper, the extremes of the palette, at
 * 3.5:1 or better). The two that don't are the two named after an absence of colour: Eclipse
 * Black is invisible on a dark wall, and Lunar White has nothing to be white against on a
 * light one. `inkDark` was for them.
 *
 * **`inkDark` is currently unused.** The picker no longer reaches this section — it stops at
 * the x-ray and the prose — so the strip is on `--page`, which is fixed and light, and the
 * CSS takes `ink` unconditionally. The field is kept rather than deleted because it is the
 * measurement, not a fallback: if this wall is ever made settable again, throwing it away
 * would mean re-solving two colourways against Ember by eye.
 */
export type Colorway = {
  slug: string
  /** Set lower case under the strip, the way the range's own lockups set it. */
  name: string
  /** The wordmark's colour on a light wall. */
  ink: string
  /** ...and on a dark one, where it differs. */
  inkDark?: string
  src: string
  /** Degrees the shoe leans by when it's picked up. See `tilt` below. */
  tilt: number
}

const shoe = (slug: string) => `/colorways/${slug}.png`

/**
 * A few degrees of lean for a hovered shoe, between -5 and 5.
 *
 * Off a hash of the slug rather than a real random number, so it's the *set* that's
 * randomised and not the moment: a shoe leans the same way every time you point at it,
 * which is the difference between five shoes each sitting slightly differently and one
 * shoe twitching. It also keeps the screenshot scripts comparable run to run.
 *
 * These five land on -4.2, -1, -0.7, 3.3 and 4.2 — spread across the range without two
 * of them agreeing, which is all this has to do. A new colourway gets whatever the hash
 * gives it, and the only failure mode is two neighbours landing on the same degree.
 */
const tilt = (slug: string) => {
  let h = 0
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 1009
  return Math.round(((h / 1008) * 10 - 5) * 10) / 10
}

const range = [
  { slug: 'lunar-white', name: 'lunar white', ink: '#857f7c', inkDark: '#f2eeec' },
  // Straight off the lockup: the red the range is advertised in, which is also the
  // most common saturated pixel in the photograph.
  { slug: 'mars-red', name: 'mars red', ink: '#e44c44' },
  // Sampled from the shoe, then pulled towards the wall it has to survive on: the
  // upper's own cornflower is a 2.2:1 wordmark against paper, so this is the deeper
  // blue of the same photograph.
  { slug: 'neptune-blue', name: 'neptune blue', ink: '#2f7cc8' },
  { slug: 'eclipse-black', name: 'eclipse black', ink: '#1a1718', inkDark: '#ded7d7' },
  { slug: 'venus-pink', name: 'venus pink', ink: '#ec0c74' },
]

export const COLORWAYS: Colorway[] = range.map((c) => ({
  ...c,
  src: shoe(c.slug),
  tilt: tilt(c.slug),
}))

/**
 * What the wordmark says when nothing is hovered.
 *
 * Not one of the five — so the strip has a resting state that isn't one of its own
 * items arbitrarily promoted, and the swap always reads as *the range, then this one
 * of it*. It was the model name, `pop tempo`, which made the same argument by naming
 * the shoe; a count makes it by naming the set, and tells you how many marks there
 * are to point at before you've pointed at any of them.
 *
 * Twelve characters, which is the longest name in the set anyway (`neptune blue`), so
 * the lockup's width is unchanged and the per-letter swap has no new case to handle.
 */
export const MODEL: Pick<Colorway, 'name' | 'ink' | 'inkDark'> = {
  name: '5 new colors',
  ink: '#1a1718',
  inkDark: '#f2eeec',
}
