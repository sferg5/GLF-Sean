/**
 * The clip, as numbers.
 *
 * A six-second film that plays itself, full-bleed, and shrinks into a rounded card as you
 * scroll past it. Everything about the section that isn't a DOM node is here, the way
 * `lib/reel.ts` holds the reel's storyboard.
 *
 * **This replaced a frame-by-frame scrub**, and the reason is worth keeping: scrubbing tied
 * the clip's time to scroll position, which meant it could only ever move as smoothly as the
 * scroll did. A trackpad flick advances several frames per screen refresh, so the footage
 * strobed — and no amount of seek-loop work fixed it, because the loop was already presenting
 * frames as fast as the display could show them. Playback decouples the two: the film runs at
 * its own 30fps and scroll drives the *frame around it* instead. Scroll still does something
 * on every pixel; it just isn't the thing that has to look like motion.
 *
 * The encode changed with it. Scrubbing needed every frame to be a keyframe (4.6MB); playback
 * doesn't, so the same clip is 1.3MB at a larger 1600×900.
 */

/** Frames and rate, for the readout. Audited — see README. */
export const FRAMES = 180
export const FPS = 30

/**
 * How much scroll the section owns, in svh.
 *
 * Shorter than the scrub's 800, and it can be: nothing here has to be slow enough to read
 * frame by frame. The pin is 100svh, so the travel is 160 — about one and a half screens,
 * which is enough for the shrink to read as deliberate rather than as a jump.
 */
export const SCROLL_VH = 260

/**
 * The fraction of the travel the shrink occupies, and what's left over.
 *
 * 0.6 spends about one screen of scroll going from full-bleed to card, then holds the card for
 * the last 64svh. The hold matters more than it looks: without it the section would still be
 * mid-transition as the pin releases, so the card would never be seen at rest.
 */
export const SHRINK_END = 0.6

/** What it shrinks to — 80% of the window in both directions. */
export const SCALE_TO = 0.8

/**
 * The corner radius at rest, in px *as seen on screen*.
 *
 * Not the CSS value. The box is scaled by `transform`, and a transform scales the radius along
 * with everything else, so the declared radius has to be divided by the scale to land at this
 * on the glass — see `radiusAt` below. Getting that wrong is the classic version of this bug:
 * corners that look right at one size and wrong at the other.
 */
export const RADIUS = 28

/** How much of the pinned box must be on screen before the film starts. */
export const AMOUNT = 0.75

/**
 * Reduced motion: the film, without the scroll-driven frame.
 *
 * Parked at the end state — 80% and rounded — rather than at full-bleed, because that's the
 * composition the section is *for*; full-bleed is where it starts. 120svh rather than 100 for
 * the reason the scrub needed 130: an outer box the same height as its sticky child has no
 * scroll range, and `scrollYProgress` degenerates to a constant.
 *
 * The video isn't fetched at all in this form. It's a still, and nothing about the section
 * moves.
 */
export const REDUCED = { height: 120 } as const

/**
 * Two encodes, picked once before the element gets a `src`.
 *
 * 1600 wide rather than the scrub's 1280: this one is genuinely full-bleed on a desktop window,
 * where the scrub's job was to be frame-accurate rather than large. It costs 1.3MB, which is
 * still a quarter of what the all-keyframe encode cost at the smaller size.
 */
export const TIERS = {
  wide: { src: '/clip/shoe-1600.mp4', w: 1600, h: 900 },
  phone: { src: '/clip/shoe-768.mp4', w: 768, h: 432 },
} as const

export type Tier = keyof typeof TIERS

export const POSTER = '/clip/shoe-0.jpg'
export const STILL = '/clip/shoe-still.jpg'

const PHONE_MAX = 640

export const tierFor = (width: number): Tier => (width <= PHONE_MAX ? 'phone' : 'wide')

/** Scale for a shrink value of 0..1. */
export const scaleAt = (k: number) => 1 - (1 - SCALE_TO) * k

/**
 * The CSS radius for a shrink value of 0..1 — pre-divided by the scale it will be drawn at,
 * so what lands on screen is `RADIUS × k`. At k = 1 that's 35px declared, 28px seen.
 */
export const radiusAt = (k: number) => (RADIUS / SCALE_TO) * k

/** `?clip=0` drops the section, mirroring `?reel=0`. See `scripts/perf.mjs`. */
export const clipEnabled = () => {
  if (typeof window === 'undefined') return true
  return new URLSearchParams(window.location.search).get('clip') !== '0'
}

/** `?cv=` overrides the scroll length, for a check that would rather sample 60svh than 260. */
export const scrollVh = () => {
  if (typeof window === 'undefined') return SCROLL_VH
  const raw = Number(new URLSearchParams(window.location.search).get('cv'))
  return Number.isFinite(raw) && raw >= REDUCED.height && raw <= 2000 ? raw : SCROLL_VH
}
