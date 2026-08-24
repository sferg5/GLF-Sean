/**
 * The x-ray's call-outs: what they name, where they point, and when.
 *
 * Split out of the component because two other things need it — the placement editor
 * mutates this shape, and `toSource` writes it back out as pasteable source. Keeping
 * the geometry here means the editor and the renderer can't disagree about what a
 * position means.
 */

import { FEATHER } from './front'
import { clamp } from './remap'

/**
 * Stage height as a fraction of stage width — `aspect-ratio: 3 / 2` in the CSS.
 *
 * Positions are percentages of the stage box, so a vertical percentage is a different
 * number of pixels from a horizontal one. Bearings have to be computed in one unit or
 * the leaders point somewhere other than at their targets.
 */
export const ASPECT = 2 / 3

export type Pt = [number, number]

/** Which end of a call-out's life a spot describes. */
export type Phase = 'from' | 'to'

export type Pose = {
  /** The feature being named, in % of the stage box. */
  target: Pt
  /** Where the shelf starts. The leader leaves from this end. */
  anchor: Pt
}

export type Side = 'above' | 'below'

export type Spot = Pose & {
  label: string
  /**
   * Which side of its shelf the text sits on, so the leader never has to cross its own
   * label.
   *
   * Per spot rather than per pair. It was per pair while these positions were fixed in
   * source — both marks of a pair happened to keep the same bearing, one aiming down off
   * the top band and one up off the bottom. Once the editor could move a text past its
   * own dot that stopped being true, and a shared side left a reachable placement with
   * no way to correct it.
   */
  side: Side
}

export type Pair = {
  /** On the intact shell, and gone by the time the cut reaches it. */
  from: Spot
  /** On what the cut exposes, and drawn only once it exists. */
  to: Spot
}

/**
 * Placed by reading the photographs — see the note in the README about these being
 * eyeballed rather than derived. `?edit=1` is how they were placed and how to move them;
 * the editor's Copy button emits this array.
 *
 * The labels follow the positions, not the other way round: each one was written after
 * looking at a magnified crop of what its dot actually lands on, because a label is the
 * one part of a call-out that can be confidently wrong. Move a dot and the name it
 * carries has to be re-checked — nothing here will complain if it isn't.
 *
 * Both pairs read finished surface → the structure the cut exposes in it:
 *
 * - the knit shell's outer face → the open mesh it's actually built from
 * - the midsole's smooth wall → the expanded beads packed inside it
 */
export const DEFAULT_PAIRS: Pair[] = [
  {
    from: { label: 'Engineered knit upper', target: [47.2, 45.8], anchor: [24, 15], side: 'above' },
    to: { label: 'Open knit mesh', target: [21.5, 48.1], anchor: [31.7, 26.5], side: 'above' },
  },
  {
    from: { label: 'Midsole sidewall', target: [62.4, 68.2], anchor: [41.9, 96], side: 'below' },
    to: { label: 'Expanded bead core', target: [77, 74], anchor: [88.9, 99.6], side: 'below' },
  },
]

/** Progress at which the section front sits at `x` (% of the stage). Inverse of `frontAt`. */
export const progressAtX = (x: number) => (x / 100 + FEATHER) / (1 + 2 * FEATHER)

/** Withdraw this much before the front dissolves what the mark is naming. */
const LEAD = 0.06

/** And arrive this much after the front has finished exposing the replacement. */
const LAG = 0.08

/** How long a mark takes to withdraw, and to draw itself in. */
const LEAVE = 0.14
const ARRIVE = 0.2

/** Arrived-and-still before the very end, so p = 1 isn't the last frame of a move. */
const HOLD = 0.05

/**
 * How far off its bearing a mark starts, in degrees.
 *
 * The whole point of the swing: the two phases of a call-out name very different parts
 * of the shoe, so they should not look like one mark being repositioned. Each arrives
 * on its own bearing, pivoting onto it from beyond — and the departure is that run
 * backwards, so the old mark swings away rather than handing over.
 */
export const SWING = 9

/**
 * When each mark leaves and when its replacement arrives, derived from where the two
 * features sit along the cut rather than from a shared window.
 *
 * The front travels toe → heel, so the marks have different deadlines: the coral foam
 * at x = 27 is gone long before the knit at x = 41, and the bead core at x = 77 does
 * not exist until well after the lining at x = 72. Deriving each window means nothing
 * is ever named before the cut has made it or left pointing at material that has
 * already dissolved, and moving a target in the editor keeps that true with no
 * constant to re-tune.
 *
 * It also leaves a stretch in the middle with no annotation at all, which is not a gap
 * to be closed — it is the cut getting the frame to itself, and it is most of what
 * stops the two phases reading as one connected thing.
 */
export const windowsFor = (pair: Pair) => {
  const leaveStart = clamp(progressAtX(pair.from.target[0]) - LEAD, 0, 1 - LEAVE)
  const leaveEnd = leaveStart + LEAVE
  const arriveStart = clamp(
    progressAtX(pair.to.target[0]) + LAG,
    leaveEnd,
    1 - ARRIVE - HOLD,
  )
  return { leaveStart, leaveEnd, arriveStart, arriveEnd: arriveStart + ARRIVE }
}

/** A leader as a length in % of stage width and a bearing in degrees. */
export const leaderOf = ({ anchor, target }: Pose) => {
  const dx = target[0] - anchor[0]
  const dy = (target[1] - anchor[1]) * ASPECT
  return { length: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI }
}

/** One decimal, and no trailing `.0` — placement is eyeballed, not measured to 1e-6. */
export const round = (n: number) => Number(n.toFixed(1))

/**
 * The layout as source, for pasting back over `DEFAULT_PAIRS`.
 *
 * The editor persists to `localStorage`, which is the right home for a value you are
 * still deciding and the wrong one for a value you have decided — nobody else's
 * checkout has your storage. This is how a placement stops being local.
 */
export const toSource = (pairs: Pair[]) => {
  const pt = ([x, y]: Pt) => `[${round(x)}, ${round(y)}]`
  const spot = (s: Spot) =>
    `{ label: '${s.label}', target: ${pt(s.target)}, anchor: ${pt(s.anchor)}, side: '${s.side}' }`
  const body = pairs
    .map((p) => `  {\n    from: ${spot(p.from)},\n    to: ${spot(p.to)},\n  },`)
    .join('\n')
  return `export const DEFAULT_PAIRS: Pair[] = [\n${body}\n]\n`
}

/**
 * Geometry only — the part of a spot the editor is allowed to move.
 *
 * What gets persisted, and deliberately *not* the label. Storing whole spots froze the
 * copy: a layout saved before a rename kept the old names, storage wins over source, and
 * `toSource` then emitted those stale names straight back out — so renaming a call-out in
 * source appeared to do nothing, and a round trip through the editor silently reverted it.
 * Labels are content and content lives in source; only the coordinates are yours to keep.
 */
export type Placement = Pick<Spot, 'target' | 'anchor' | 'side'>
export type Layout = { from: Placement; to: Placement }[]

/**
 * Picks the three fields by name rather than deleting `label`, so a stale label in a
 * stored blob can't spread its way back into a live spot.
 */
const placementOf = ({ target, anchor, side }: Placement): Placement => ({ target, anchor, side })

export const toLayout = (pairs: Pair[]): Layout =>
  pairs.map((p) => ({ from: placementOf(p.from), to: placementOf(p.to) }))

/**
 * Structural check on anything coming back out of storage.
 *
 * Extra keys are ignored rather than rejected, which is what lets a blob saved by the
 * older label-carrying format still load — its coordinates are fine, and its labels are
 * exactly what we no longer want to read.
 */
export const isLayout = (v: unknown): v is Layout => {
  const pt = (p: unknown) =>
    Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && isFinite(n))
  const placement = (s: unknown) => {
    if (!s || typeof s !== 'object') return false
    const o = s as Record<string, unknown>
    return (o.side === 'above' || o.side === 'below') && pt(o.target) && pt(o.anchor)
  }
  return (
    Array.isArray(v) &&
    v.length === DEFAULT_PAIRS.length &&
    v.every((p) => {
      if (!p || typeof p !== 'object') return false
      const o = p as Record<string, unknown>
      return placement(o.from) && placement(o.to)
    })
  )
}

/** Source labels, stored coordinates. The merge that keeps copy owned by the source. */
export const applyLayout = (layout: Layout): Pair[] =>
  DEFAULT_PAIRS.map((pair, i) => ({
    from: { ...pair.from, ...placementOf(layout[i].from) },
    to: { ...pair.to, ...placementOf(layout[i].to) },
  }))
