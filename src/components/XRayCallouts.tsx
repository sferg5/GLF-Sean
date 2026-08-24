import { motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { clamp, easeOutQuad, mix, remap } from '../lib/remap'
import {
  SWING,
  leaderOf,
  windowsFor,
  type Pair,
  type Phase,
  type Pt,
  type Side,
  type Spot,
} from '../lib/callouts'
import { useCalloutLayout } from './CalloutLayout'

/**
 * Two call-outs, each of which names the outside of the shoe and is then replaced by
 * one naming what the cut exposed.
 *
 * **The two phases are deliberately not connected.** An earlier version morphed each
 * mark onto its new target — one leader swinging across the frame, its label
 * cross-fading en route — and the continuity was the problem: it implied the knit and
 * the interior lining were the same thing seen twice, when they are different parts of
 * the shoe that happen to be named by the same annotation slot. So instead the shell
 * mark *withdraws* — label first, then the ring, then the leader retracting into its
 * anchor as it swings off its bearing — and the interior mark arrives on a bearing of
 * its own, pivoting onto it from beyond and drawing out from its own anchor. Departure
 * is the arrival run backwards, which is why one set of ramps produces both.
 *
 * Between the two there is a stretch with no annotation at all. That isn't a gap left
 * to be closed; it's the cut getting the frame to itself, and it's most of what stops
 * the phases reading as one thing being dragged around.
 *
 * Switchable from the topbar, which is why this is a layer the variant composes rather
 * than something baked into the reveal. The section plate's `lab/Callouts` is the
 * opposite case: permanent, numbered, and part of that variant's design.
 *
 * Two, not four. Every label here sits over a photograph with no measurement frame to
 * hang off, so the only quiet space is the band above the toe and the band under the
 * sole — one shelf each. A third would have to go on the shoe.
 */

/**
 * Windows on a mark's own presence — `a`, where 1 is fully drawn and 0 is absent. Each
 * is read as `remap(a, lo, hi, 0, 1)`, so a part is complete at `hi` and gone at `lo`.
 *
 * Arrival, with `a` rising: the line draws out from the shelf, the ring lands on the
 * feature, the name arrives. The order a hand would do it in.
 */
const IN = {
  draw: [0, 0.62],
  ring: [0.45, 0.78],
  text: [0.6, 1],
} as const

/**
 * Departure, with `a` falling — and deliberately **not** the arrival reversed.
 *
 * Read these right to left, in the direction `a` moves. The ring lets go of the feature
 * first. Then the line retracts out of the target and back into the shelf, which is the
 * one part the geometry gives for free: the rule's origin is the anchor, so shrinking it
 * withdraws the far end towards the text rather than sliding the whole line. Only once
 * it has arrived there does the name go.
 *
 * The two phases don't overlap — the line is fully home at `a = 0.44` and the text
 * doesn't start leaving until `0.36` — which is the point. Withdrawing the leader *into*
 * the label and then removing the label reads as one gesture with two beats; doing both
 * at once reads as a fade.
 */
const OUT = {
  ring: [0.8, 1],
  draw: [0.44, 0.96],
  text: [0, 0.36],
} as const

/** How far the label slides onto its shelf, in px, away from the side it sits on. */
const SLIDE = 4

/**
 * The shelf, with the text on it. Positioned rather than in flow because the two
 * phases' names differ in width and each has to sit exactly on its own anchor.
 */
function Label({
  side,
  text,
  opacity,
  y,
}: {
  side: Side
  text: string
  opacity: MotionValue<number> | number
  y: MotionValue<number> | number
}) {
  return (
    <motion.span className="xcallout__label" data-side={side} style={{ opacity, y }}>
      {text}
    </motion.span>
  )
}

/**
 * One drawn mark: a shelf, a leader on its bearing, and a ringed point on the feature.
 *
 * Positioned by translating a box the size of the stage. A percentage in `translate`
 * resolves against the element's own border box, so a layer at `inset: 0` translated by
 * `41%` puts its origin at 41% of the stage — stage percentages usable directly, with
 * nothing measured and no `left`/`top` to animate. `left`/`top` was the obvious way and
 * it costs a layout pass per frame; a transform costs a composite.
 *
 * `a` is how present the mark is: 0 = absent, 1 = fully drawn on its bearing. A `from`
 * mark runs it 1 → 0 and a `to` mark runs it 0 → 1, and `kind` says which — the two
 * directions order their parts differently, so it isn't enough to run one set of ramps
 * backwards.
 */
function Mark({
  spot,
  kind,
  a,
  reduced,
}: {
  spot: Spot
  kind: Phase
  a: MotionValue<number>
  reduced: boolean
}) {
  const { length, angle } = leaderOf(spot)
  const [ax, ay] = spot.anchor
  const [tx, ty] = spot.target
  const { side } = spot
  const arriving = kind === 'to'
  const win = arriving ? IN : OUT

  /**
   * Pivot onto the bearing from beyond it: `above` marks aim down off a shelf in the top
   * band and `below` marks aim up off one under the sole, so in both cases starting
   * further from the horizontal and settling towards it is the same gesture.
   *
   * Arrivals only. A departure withdraws straight down its own bearing — the leader is
   * retracting *into* its label, and swinging while it does that turns a withdrawal into
   * a wobble.
   */
  const swing = side === 'above' ? SWING : -SWING

  /**
   * `easeOutQuad` is fast-then-slow in its input, so against a rising ramp it eases out —
   * right for something arriving — and against a falling one it eases in, which is right
   * for something leaving. Monotonic either way, so the part order below is preserved
   * whichever direction `a` is moving.
   */
  const eased = useTransform(a, easeOutQuad)

  const draw = useTransform(eased, (v) =>
    reduced ? 1 : remap(v, win.draw[0], win.draw[1], 0, 1),
  )
  const scale = useTransform(draw, (v) => (length / 100) * v)

  /**
   * Hides the rule exactly while it has no length. `scaleX(0)` on a full-stage-width box
   * carrying a spread shadow is a degenerate transform, which is where a stray
   * antialiased hairline comes from — and on departure the line sits at zero for the
   * whole of the second phase, not just for an instant at the end.
   */
  const ruleOpacity = useTransform(draw, (v) => remap(v, 0, 0.03, 0, 1))

  const rotate = useTransform(eased, (v) =>
    reduced || !arriving ? angle : angle + swing * (1 - v),
  )
  const ring = useTransform(eased, (v) =>
    reduced ? 1 : remap(v, win.ring[0], win.ring[1], 0, 1),
  )
  const text = useTransform(eased, (v) =>
    reduced ? 1 : remap(v, win.text[0], win.text[1], 0, 1),
  )
  const slide = useTransform(text, (v) =>
    reduced ? 0 : mix(side === 'above' ? -SLIDE : SLIDE, 0, v),
  )

  // Reduced motion drops every one of those and fades the mark where it stands, which is
  // why the container carries `a` there and nothing else does.
  return (
    <motion.div className="xcallout" style={{ opacity: reduced ? a : 1 }}>
      {/* Rotation and scale on separate elements. Together on one, CSS applies the
          scale in the parent's axes and fattens the line sideways instead of extending
          it along its own bearing. */}
      <motion.div className="xcallout__pin" style={{ x: `${ax}%`, y: `${ay}%`, rotate }}>
        <motion.i
          className="xcallout__rule"
          style={{ scaleX: scale, opacity: ruleOpacity }}
        />
      </motion.div>

      <motion.div className="xcallout__pin" style={{ x: `${tx}%`, y: `${ty}%` }}>
        <motion.i className="xcallout__dot" style={{ scale: ring, opacity: ring }} />
      </motion.div>

      <motion.div className="xcallout__pin" style={{ x: `${ax}%`, y: `${ay}%` }}>
        <Label side={side} text={spot.label} opacity={text} y={slide} />
      </motion.div>
    </motion.div>
  )
}

/**
 * A draggable point, shown only while the editor is open.
 *
 * Pointer capture rather than window listeners: the browser then routes every move to
 * this element until release, so a fast drag that outruns the cursor can't be lost to
 * whatever it passes over. The stage rect is read once on press — it can't change
 * mid-drag, and reading it per move would be a layout flush per frame.
 *
 * Deliberately not focusable. It lives inside an `aria-hidden` layer, and a keyboard
 * user is better served by the editor's number fields, which are real inputs with real
 * labels and give exact values rather than whatever a drag lands on.
 */
function Handle({
  at,
  kind,
  onMove,
}: {
  at: Pt
  kind: 'target' | 'anchor'
  onMove: (at: Pt) => void
}) {
  const start = (event: React.PointerEvent<HTMLDivElement>) => {
    // Held in a local, not read off the event inside the listeners below: React clears
    // `currentTarget` once the handler returns, so a closure over it would see null.
    const el = event.currentTarget
    const layer = el.parentElement
    if (!layer) return

    const box = layer.getBoundingClientRect()
    el.setPointerCapture(event.pointerId)
    event.preventDefault()

    const to = (e: PointerEvent): Pt => [
      clamp(((e.clientX - box.left) / box.width) * 100, -5, 105),
      clamp(((e.clientY - box.top) / box.height) * 100, -5, 105),
    ]
    const move = (e: PointerEvent) => onMove(to(e))
    const end = (e: PointerEvent) => {
      move(e)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  return (
    <div
      className="xcallout__handle"
      data-kind={kind}
      style={{ left: `${at[0]}%`, top: `${at[1]}%` }}
      onPointerDown={start}
      title={`${kind} ${at[0]}, ${at[1]}`}
    />
  )
}

function Callout({
  pair,
  index,
  p,
  reduced,
}: {
  pair: Pair
  index: number
  p: MotionValue<number>
  reduced: boolean
}) {
  const { editing, phase, setSpot } = useCalloutLayout()
  const { leaveStart, leaveEnd, arriveStart, arriveEnd } = windowsFor(pair)

  const leaving = useTransform(p, (v) => remap(v, leaveStart, leaveEnd, 1, 0))
  const arriving = useTransform(p, (v) => remap(v, arriveStart, arriveEnd, 0, 1))

  const spot = pair[phase]

  return (
    <>
      <Mark spot={pair.from} kind="from" a={leaving} reduced={reduced} />
      <Mark spot={pair.to} kind="to" a={arriving} reduced={reduced} />

      {/* Outside the marks, so a handle stays grabbable whatever its mark's opacity is
          doing. Only the phase being edited is shown — eight handles at once is a
          thicket, and the editor pins `p` to the end state that phase is drawn at. */}
      {editing && (
        <div className="xcallout__handles">
          {(['target', 'anchor'] as const).map((kind) => (
            <Handle
              key={kind}
              kind={kind}
              at={spot[kind]}
              onMove={(at) => setSpot(index, phase, { [kind]: at })}
            />
          ))}
        </div>
      )}
    </>
  )
}

/**
 * `data-on` rather than mounting on demand, so throwing the switch is a transition. A
 * transition never runs on an element's first computed value, which is the point: a
 * page that loads with the layer up has no entrance to sit through, and no half-drawn
 * frame for a screenshot to catch.
 *
 * `aria-hidden` because both photographs already carry alt text naming these same
 * materials, and four labels swapping under the scroll position is noise rather than
 * information to a screen reader.
 */
export function XRayCallouts({
  p,
  reduced,
  on,
}: {
  p: MotionValue<number>
  reduced: boolean
  on: boolean
}) {
  const { pairs, editing } = useCalloutLayout()

  return (
    <div
      className="xcallouts"
      data-on={on || editing}
      data-editing={editing || undefined}
      aria-hidden="true"
    >
      {pairs.map((pair, index) => (
        <Callout key={index} pair={pair} index={index} p={p} reduced={reduced} />
      ))}
    </div>
  )
}
