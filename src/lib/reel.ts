/**
 * The running reel: six columns of footage that rise, one at a time, past a headline —
 * and then leave it alone in the room.
 *
 * One clip per column, one `<video>` per column, and each one shown exactly once: it starts
 * below the window, rises through it and goes out the top, for good.
 *
 * **Everything here is in `svh`, and `s` is the scroll distance in `svh` since the section
 * began arriving.** Not a 0–1 progress: the section is a sequence of phases at fixed sizes
 * — arrive, fill one by one, empty, hold, invert — and expressing those as fractions of a
 * total that changes whenever one phase is retuned is how they end up drifting into each
 * other. In `svh` a column's speed is literally "how far it travels per viewport scrolled",
 * the timeline below reads as a storyboard, and the room being `100svh` tall means a tile at
 * 100 is exactly at its bottom edge at any viewport, with nothing measured and no
 * `ResizeObserver` in the component.
 */

export type Column = {
  clip: { src: string; poster: string }
  /** Width ÷ height, as encoded. The tile is shown at exactly this, so nothing crops twice. */
  aspect: number
  /**
   * Where the tile's top edge sits at s = 0, in `svh` below the top of the room. Always
   * past 100 — below the bottom edge — because the section opens on an empty room, and far
   * enough past it that the tile is still out of sight when the headline lands at s = 92.
   */
  start: number
  /**
   * `svh` of travel per `svh` of scroll. Every column is now under 1 — they all lag the
   * page, by between a twentieth and a third.
   *
   * They used to straddle 1 (0.80–1.32), and the wall was too much to take in: three
   * columns outrunning the page while three lagged it means six things crossing at once,
   * and the eye gets none of them. Slowing everything below page speed makes the footage
   * something the page moves past rather than something coming at it.
   *
   * Portrait columns are the faster ones and the wide columns the slower, which is the one
   * arrangement of the two that reads as depth: a bigger thing passing faster is a nearer
   * thing. It also keeps the section a sane length — every tile has to clear the top before
   * the room can empty, and a tall tile on a slow column is the pole that sets that.
   */
  speed: number
  /**
   * The inertia, per column. Low stiffness and light damping is what keeps a column moving
   * for a moment after the wheel stops — the spring is still travelling to a target the
   * scroll set a beat ago. Each column gets its own so they don't settle in unison, which
   * would read as one object rather than six.
   */
  spring: { stiffness: number; damping: number; mass: number }
}

const clip = (name: string) => ({
  src: `/reel/${name}.mp4`,
  /** First frame. It's what a column is composed of before a byte of video arrives. */
  poster: `/reel/${name}.jpg`,
})

/** As encoded (see README): three portrait crops and three sixteen-by-nines. */
export const PORTRAIT = 3 / 4
const WIDE = 16 / 9

/**
 * A tile arrives at `(start - 100) / speed`, and the pair of numbers on each column is
 * chosen to put those arrivals **24svh apart** starting at 140 — roughly one a
 * quarter-viewport of scroll, and none of them until the opening has finished. The order is
 * 1, 5, 3, 4, 2, 6: not left to right, because a sweep across the wall reads as one object
 * being drawn, where an order that jumps reads as six separate things turning up.
 *
 * | | clip | speed | arrives | leaves |
 * | 1 | forest | 0.95 | 140 | 280 |
 * | 5 | uphill | 0.88 | 164 | 315 |
 * | 3 | lake   | 0.81 | 188 | 352 |
 * | 4 | valley | 0.75 | 212 | 364 |
 * | 2 | desert | 0.70 | 236 | 399 |
 * | 6 | rest   | 0.65 | 260 | 435 |
 *
 * They leave in the same order they arrive, so the wall never holds more than five at once
 * and is usually holding four. That's the point of the cascade: at any moment there are two
 * or three things to look at, not six.
 */
export const COLUMNS: Column[] = [
  {
    clip: clip('forest'),
    aspect: PORTRAIT,
    start: 233,
    speed: 0.95,
    spring: { stiffness: 34, damping: 13, mass: 1.05 },
  },
  {
    clip: clip('desert'),
    aspect: WIDE,
    start: 265,
    speed: 0.7,
    spring: { stiffness: 46, damping: 15, mass: 0.85 },
  },
  {
    clip: clip('lake'),
    aspect: PORTRAIT,
    start: 252,
    speed: 0.81,
    spring: { stiffness: 40, damping: 14, mass: 1 },
  },
  {
    clip: clip('valley'),
    aspect: WIDE,
    start: 259,
    speed: 0.75,
    spring: { stiffness: 52, damping: 16, mass: 0.8 },
  },
  {
    clip: clip('uphill'),
    aspect: PORTRAIT,
    start: 244,
    speed: 0.88,
    spring: { stiffness: 30, damping: 12, mass: 1.15 },
  },
  {
    clip: clip('rest'),
    aspect: WIDE,
    start: 269,
    speed: 0.65,
    spring: { stiffness: 44, damping: 14, mass: 0.95 },
  },
]
/** A tile's top edge, in `svh` below the top of the room, at scroll `s`. */
export const place = (column: Column, s: number) => column.start - s * column.speed

/**
 * When a column's tile reaches the bottom edge of the room, in `svh`.
 *
 * Derived rather than authored, because it's a *consequence* of `start` and `speed` and the
 * two are tuned against each other — see the note on COLUMNS. `Reel.tsx` publishes the first
 * and last of these for `scripts/reel.sh`, which is how the checks stay honest when the
 * timing is dialled.
 */
export const arrival = (column: Column) => (column.start - 100) / column.speed

/**
 * The timeline, in `svh` of scroll from the moment the section's top edge reaches the bottom
 * of the window, at the default dials:
 *
 * ```
 *   60 →  120   arriving. The rules grow upward from the bottom edge, left to right.
 *  120 →  160   then the headline fades and rises in.
 *  140 →  260   the six tiles reach the bottom edge, one every 24svh.
 *  280 →  435   they leave through the top in the same order, and the room empties.
 *  435 →  425*  held: the headline alone in a black room.
 *  425 →  745   the room and the headline invert together — a third of the section, and
 *               deliberately the longest phase in it. See `FLIP_SPAN`.
 *  745 →  810   settled, white.
 *  810 →  940   the room slides up out of the window at half page speed, type included.
 *        +100   the pin ends; the room is already gone, so this is white either way.
 * ```
 *
 * (*The two starred numbers are where the dials currently sit — the opening at 60 and the
 * inversion at 425 — which is why the hold reads backwards: at these settings the inversion
 * begins while the slowest column is still clearing. See `TIMING`.)
 *
 * The exit is the last thing here that used to have no code behind it. The room is sticky, so
 * releasing the pin slides it out — but a released sticky moves at exactly page speed, and
 * that was too fast to read. So the room now translates 65svh across the 130svh window above,
 * which is half page speed by construction, and the release that follows moves a room that has
 * already left. What's revealed underneath is `.reel`'s own white background, which is the
 * same white as the section below it.
 *
 * The 435 is the one boundary that moves with the viewport, because a tile's height is a share
 * of its column's width: a wide short window makes every tile taller in `svh` and the last one
 * clears nearer 460.
 */
export const SCROLL_VH = 940

/**
 * How far the room travels on the way out, and over how much scroll — 65svh across 130svh,
 * which is the half speed the exit is for.
 *
 * 65 rather than 100: the headline is ~20svh tall and centred, so it has cleared the top edge
 * by 60 and everything after that is an empty white room leaving an empty white page. The
 * sticky release picks up the remaining 35 for free.
 */
export const EXIT_SPAN = 130
export const EXIT_TRAVEL = 65

/**
 * The two numbers worth tuning by hand, both in `svh`, both exposed as sliders in the
 * bottom-left panel and pinned by `?ro=` / `?ri=` — see `components/ReelDials.tsx`.
 *
 * They're the two things that can only be judged by scrolling: when the room has finished
 * introducing itself, and when it stops being a black room. Everything else in this file is
 * derived from the columns, so a constant is the right place for it; these two are taste.
 */
export type Timing = {
  /** Where the opening begins — the rules, and the headline just behind them. */
  open: number
  /** Where the room and the type start inverting. */
  invert: number
}

export const TIMING: Timing = { open: 60, invert: 425 }

/**
 * How long the inversion takes. Not dialable — it's the beat, not a preference.
 *
 * **320svh**, which is a third of the section, and the number has been up three times: 50, then
 * 80, then this. The argument each time is the same and it keeps winning — the entire point of
 * turning the wall over *across scroll* rather than at a threshold is that you catch it
 * happening. At 50 the greys went by in half a screen and read as a cut. At 80 you could see it
 * but you couldn't watch it. At 320 the room takes three screens of scrolling to go from
 * near-black to white, which is slow enough that the change is the event rather than a
 * transition between two events.
 *
 * It is the reason `SCROLL_VH` is 940. The phase order fixes the ceiling: the flip has to be
 * finished before the exit begins at `SCROLL_VH − EXIT_SPAN`, so at the current `invert` of 425
 * the room must be white by 810 — this leaves 65svh of white room standing before it lifts.
 *
 * What it costs, beyond length: the headline is a `difference` blend, so it passes through zero
 * contrast when the room is mid-grey, and that window scales with the span. `easeInOutCubic` is
 * fastest through the middle, which is why it's the easing — the crossing takes roughly 20svh of
 * the 320 rather than 100 — but 20svh is still most of a screen where the type is faint. That is
 * the price of a slow inversion on type that takes its colour from the room.
 */
export const FLIP_SPAN = 320

/**
 * Slider bounds.
 *
 * `open` stops at 60, which is also where it's set: the opening runs 100svh and the first tile
 * is due at 140, so at 60 the headline is still arriving as that tile starts climbing. That's
 * the trade the top of this range buys — the latest opening, and so the most of the rules'
 * growth above the fold, at the cost of the last 20svh of the headline's arrival sharing the
 * frame with a moving tile. Dial it down for a cleaner order and an earlier start.
 *
 * `invert` is bounded above by needing its own 320svh *and* the exit's 130 before the pin ends,
 * so the room is always white by the time it starts to leave. Below, 350 is roughly where the
 * fourth column is still crossing — past that the room starts turning white with footage still
 * in it, which is the arrangement the beats were built to avoid.
 */
export const LIMITS = {
  open: [0, 60],
  invert: [350, SCROLL_VH - EXIT_SPAN - FLIP_SPAN],
} as const

/**
 * The windows, derived. Spans are fixed and the dials move them, so "sooner" is one number
 * rather than four that have to be kept in order.
 *
 * Sequential, not overlapping: the rules finish and *then* the headline starts. They briefly
 * overlapped — the type began 6svh into the rules, which bought 40svh — and it read as one
 * event rather than as two, which is the thing the opening is for.
 *
 * 60svh for the rules is what a staggered set of six needs to be legible; the growth is
 * anchored to the bottom of the room, so the first half of it happens below the fold while the
 * section is still sliding up, and 60 is what leaves ~38 of it on screen.
 */
export const windows = ({ open, invert }: Timing) => ({
  rules: [open, open + 60] as const,
  title: [open + 60, open + 100] as const,
  /**
   * Eased `easeInOutCubic` in the component, which is doing something specific. The headline
   * is a `difference` blend, so its apparent colour is `|room − white|` — which means it
   * inverts in perfect step with the background, for free, but also that it passes through
   * zero contrast at the exact midpoint where the room is mid-grey. Cubic in-out is *fastest
   * in the middle*, so that crossing takes roughly 20svh of the 320 rather than 100.
   */
  flip: [invert, invert + FLIP_SPAN] as const,
  /** Fixed to the end of the pin, because that's the one place it can be. */
  exit: [SCROLL_VH - EXIT_SPAN, SCROLL_VH] as const,
})

/**
 * Reduced motion keeps the footage, the room and the inversion, and loses the parallax and
 * the 400svh of scroll that existed to carry it.
 */
export const REDUCED = {
  height: 220,
  flip: [160, 205] as const,
  /**
   * No slow exit. It's 130svh of scroll whose entire content is a translation, which is the
   * kind of thing reduced motion exists to decline — and the sticky release still takes the
   * room off the screen without it.
   */
  /**
   * Where the wall is parked. Not 0 — at 0 every tile is still below the window and the
   * section would be an empty room. 280 is the frame with the most on screen at once: five
   * columns, laddered, with the sixth just past the top edge.
   */
  at: 280,
}

/**
 * The dark room, and the white one it becomes.
 *
 * Solid colours at both ends rather than a translucent ink over a changing background: a
 * hairline that is `rgba(255,255,255,0.16)` on the dark side has to become an entirely
 * different alpha on the white side to read the same, and interpolating two solids gets
 * there without that second unknown.
 */
export const ROOM = {
  dark: { bg: '#08080a', ink: '#f4f4f5', rule: '#2c2c33' },
  light: { bg: '#ffffff', ink: '#101012', rule: '#e2e2e5' },
} as const

/** Breathing room between a tile and the column rules either side of it, in px. */
export const GUTTER = 8

/** Channel-wise mix of two `#rrggbb`, as `rgb(r g b)`. */
export const mixHex = (from: string, to: string, t: number) => {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const at = (i: number) => Math.round(ch(from, i) + (ch(to, i) - ch(from, i)) * t)
  return `rgb(${at(0)} ${at(1)} ${at(2)})`
}
