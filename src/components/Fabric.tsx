import { useEffect, useMemo, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import { useWindTunnel } from '../lab/WindTunnel'
import { FABRICS, PACE, WALL, type FabricSpec, predict, windFor } from '../lib/air'

/**
 * Fast and Free, twice, in the same wind.
 *
 * Two channels seen in cross-section, stacked and full-bleed: **outside air at the left edge,
 * skin at the right**, the knit standing across each. Cool air arrives from outside and goes
 * looking for a way in. In the top channel most of it doesn't find one; in the bottom most of it
 * does, and the microclimate it flushes stays close to ambient instead of banking up warm against
 * the skin. Same air into both, same pressure, and the only difference in the entire model is how
 * open the knit is.
 *
 * **The comparison is a controlled experiment rather than a pair of illustrations.** One emitter
 * feeds both channels the same particle at the same instant at the same height (`lib/air.ts`),
 * and nothing in the step reads a random number.
 *
 * **Nothing here reads scroll.** There was a 380svh pin and a five-beat storyboard: the channels
 * arrived empty, the fabric knitted itself across them, the air came on, then the readouts and
 * the verdict landed. It's all gone — this is going on a display, and on a display nobody
 * scrolls, a section that only starts once you have scrolled into the middle of it is a section
 * that is never running when it's looked at. The fields run whenever the section is in front of
 * you and the composition is simply there.
 *
 * **The pace is the only control, and it's what the figures answer.** They used to be a live
 * reading off the two fields, which crawled in its last digit — 2.43× to 2.47× — and read as
 * instability rather than as liveness. They're `predict()` now: the model's steady state at the
 * slider's position, so one position is one pair of numbers every time. It's a table of settled
 * states committed to the source and re-derived by `scripts/air.sh` on every run, not a formula —
 * see the note on `CURVE`.
 *
 * **The porosities and the temperature scale are placeholder.** Built to be plausible rather than
 * true, like the call-out labels and the prose — and the conversion from a measured microclimate
 * to degrees is invented. See the note on `riseOf` in `lib/air.ts`.
 */

const TITLE = 'the fast and free you love, now with more airflow'

/**
 * The three places along a channel worth naming, as fractions of its width.
 *
 * **The order is the whole point.** These used to run skin → knit → outside air, with the air
 * leaving you; the flow was reversed so that it arrives, which is the direction that makes the
 * second reading a temperature *at the skin* rather than in air on its way out.
 *
 * There were three and there are two: `skin` at the far edge came off. Two marks say the
 * direction as well as three do — air comes from the outside and goes through the knit, and where
 * it ends up is the only place left — and the third was the one sitting in the corner of a
 * full-bleed section with its own letter-spacing hanging off the window.
 */
const MARKS = [
  { at: 0, label: 'outside air', align: 'start' },
  { at: WALL, label: 'the knit', align: 'centre' },
] as const

export function Fabric() {
  const section = useRef<HTMLElement>(null)
  const reduced = !!useReducedMotion()

  /**
   * The reader's variable, and now the section's only one.
   *
   * Not persisted and not in the URL, unlike nearly every other control on this page. The reel's
   * dials and the background picker are *settings*: someone decided them, and a link should carry
   * that decision. This is an experiment you run while you're standing in front of it, and it
   * should always open at the reference pace the copy is written against.
   */
  const [pace, setPace] = useState<number>(PACE.ref)

  /* The loop reads the ref, so dragging the slider doesn't restart a running rAF. */
  const wind = useRef(windFor(PACE.ref))
  wind.current = windFor(pace)

  /** Measured and committed, not read live — see the note on `CURVE` in `lib/air.ts`. */
  const figures = useMemo(() => predict(pace), [pace])

  const canvas = {
    now: useRef<HTMLCanvasElement>(null),
    next: useRef<HTMLCanvasElement>(null),
  }

  /**
   * The one thing about this section that still depends on where the page is.
   *
   * Not an activation — the composition is drawn either way and the figures are up from the first
   * frame. It's that two particle fields stepping sixty times a second behind three screens of
   * other content is a frame budget spent on nothing.
   */
  const showing = useInView(section, { amount: 0.2 })

  useWindTunnel({ canvas, wind, windValue: windFor(pace), showing, reduced })

  /* Published for the checks — the page states its numbers and a script asserts the relationships
     between them. */
  useEffect(() => {
    document.documentElement.dataset.fabric = JSON.stringify({
      pace,
      wall: WALL,
      ratio: Number(figures.ratio.toFixed(3)),
      drop: Number(figures.drop.toFixed(2)),
      porosity: FABRICS.map((f) => f.porosity),
      reduced,
    })
  }, [pace, figures, reduced])

  return (
    <section className="fabric" ref={section}>
      <div className="fabric__frame">
        <h2 className="fabric__title">{TITLE}</h2>

        {/* The axis, once. Both channels are the same geometry, so naming it twice would be
            labelling the picture rather than the diagram — and with the caption gone these three
            marks are what says which way the air is going. */}
        <div className="fabric__axis" aria-hidden="true">
          {/* Only the middle mark takes its position from the model. The two ends are "at the
              ends", which the stylesheet says better than a percentage can: at 0% and 100% of a
              full-bleed box they sat flush against the window and the last mark's own
              letter-spacing pushed its final glyph off the screen. */}
          {MARKS.map((mark) => (
            <span
              key={mark.label}
              className="fabric__mark"
              data-align={mark.align}
              style={mark.align === 'centre' ? { left: `${mark.at * 100}%` } : undefined}
            >
              {mark.label}
            </span>
          ))}
        </div>

        <div className="fabric__channels">
          {FABRICS.map((spec) => (
            <Channel key={spec.id} spec={spec} canvas={canvas[spec.id]} />
          ))}
        </div>

        {/* Between the picture and the figures, which is the whole point of where it is: it is the
            thing that connects them, and on a touch screen it's also the only thing to touch. */}
        <Pace pace={pace} onChange={setPace} />

        <footer className="fabric__verdict" aria-hidden="true">
          <p className="fabric__figure">
            <b>{figures.ratio.toFixed(2)}×</b>
            <span>more air in</span>
          </p>
          <p className="fabric__figure">
            <b>{figures.drop.toFixed(1)} °C</b>
            <span>cooler</span>
          </p>
        </footer>

        {/* Everything on this screen that is a picture, said once in words. */}
        <p className="fabric__sr">
          Two cross-sections of the same knit in the same airflow, outside air on the left and skin
          on the right. The current fabric is 18% open and lets about a third of the air reach the
          skin; the new one is 44% open and lets about three quarters through. At {pace} km/h that
          is {figures.ratio.toFixed(1)} times the airflow and {figures.drop.toFixed(1)} °C cooler
          against the skin. Both fabrics and every figure here are placeholder.
        </p>
      </div>
    </section>
  )
}

/**
 * One channel: the canvas, and nothing written on it.
 *
 * It had a tag and two figures over it — `TODAY · 18% OPEN` in one corner and `AIR IN` / `SKIN`
 * in the other — eight pieces of type over two pictures whose whole argument is visible without
 * reading any of it. What's left says it once, underneath.
 *
 * What that costs is worth stating plainly: **nothing on screen names which channel is which.**
 * The order is the current fabric then the new one, and the figures underneath are phrased as a
 * comparison, so the reading is available but implied rather than labelled.
 */
function Channel({
  spec,
  canvas,
}: {
  spec: FabricSpec
  canvas: React.RefObject<HTMLCanvasElement | null>
}) {
  return (
    <article className="fabric__channel" data-fabric={spec.id}>
      <canvas className="fabric__canvas" ref={canvas} aria-hidden="true" />
    </article>
  )
}

/**
 * The pace, on a slider built for a finger.
 *
 * It was 11px of mono in the corner of the header beside a 2px track, which is a mouse's control.
 * This is going on an iPad: the track is thick enough to hit without aiming, the thumb is a thumb,
 * and the value is set large — because it *is* one of the figures, and the whole reason it sits
 * between the picture and them is to read as the thing that connects the two.
 *
 * Still a native `range` underneath. Arrow keys, Home, End, a screen reader and a touch drag all
 * come free, and every one of them is a thing a div with a `pointerdown` handler gets wrong for
 * the sake of a nicer thumb.
 */
function Pace({ pace, onChange }: { pace: number; onChange: (v: number) => void }) {
  return (
    <label className="fabric__pace">
      <span className="fabric__pace-name">Pace</span>
      <input
        type="range"
        min={PACE.min}
        max={PACE.max}
        step={0.5}
        value={pace}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      {/* `output` rather than a span: it is literally the result of the control beside it, and it
          means the value is announced when the slider moves without a live region. */}
      <output className="fabric__pace-value">
        {pace.toFixed(1)} <i>km/h</i>
      </output>
    </label>
  )
}
