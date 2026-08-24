import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import type { AnimationPlaybackControls } from 'motion/react'
import { clamp } from '../lib/remap'
import { SceneCanvas } from './SceneCanvas'
import { FallbackHero } from './FallbackHero'
import { SprayDials, fabricHex, useSprayDials } from './SprayDials'
import type { Tuning } from './clothSim'

/**
 * The hero: two cuts of fabric, one spray bottle.
 *
 * Not a scroll stage any more — a bench test. The one call to action sprays water
 * at BOTH samples: the same mist, the same shove into the cloth, the same moisture.
 * The ordinary jersey blooms and then slowly dries back out; the ShowZero sample
 * takes the identical hit and never shows a thing. Press it again mid-dry and the
 * moisture stacks, the way a second spray actually would. The readout quotes the
 * same zone maths the shader draws, so "marks 0.0 cm²" is a measurement, not a
 * caption.
 *
 * Moisture is an event animation now (rise fast, dry slow), so `?p=` pins it
 * directly for reproducible frames instead of standing in for a scroll position.
 * The spray's feel — wind, gust, impulse force, moisture per press, seconds to
 * dry — is on dials (`h`, or the corner pill), each pinnable into the URL.
 */

/** The mist takes a beat to land; the drying is the dial. */
const RISE_S = 0.5

/** `?p=` pins the moisture for screenshots — read once. */
const scrubFromUrl = (): number | null => {
  const raw = new URLSearchParams(window.location.search).get('p')
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? clamp(n) : null
}

const probeWebGL = (): boolean => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function ShowZeroHero() {
  const reduced = !!useReducedMotion()
  const [scrub] = useState(scrubFromUrl)
  const [webgl] = useState(probeWebGL)
  const [lost, setLost] = useState(false)
  const [coarse] = useState(() => window.innerWidth < 480)
  /* The cloth parks for reduced motion, for `?p=` scrubs, and for `?breeze=0` —
     the switch the verification script throws so its frames reproduce. */
  const [frozen] = useState(
    () =>
      scrubFromUrl() != null ||
      new URLSearchParams(window.location.search).get('breeze') === '0',
  )

  const [dials, setDials] = useSprayDials()
  const [panel, setPanel] = useState(false)

  /* The dials' live half: the sims read this object every substep, so dragging a
     slider changes the air mid-swing without a re-render or a sim rebuild. */
  const tuning = useMemo<Tuning>(() => ({ wind: 1, gust: 1, force: 1 }), [])
  useEffect(() => {
    tuning.wind = dials.wind
    tuning.gust = dials.gust
    tuning.force = dials.force
  }, [dials, tuning])

  /* `h` toggles the dials, like the shoe page's instrument. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key.toLowerCase() === 'h') setPanel((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** One spray event, two audiences: the GL scene (impulse + mist) and this file. */
  const bus = useMemo(() => {
    const fns = new Set<() => void>()
    return {
      on(fn: () => void) {
        fns.add(fn)
        return () => {
          fns.delete(fn)
        }
      },
      emit() {
        for (const fn of fns) fn()
      },
    }
  }, [])

  /**
   * Moisture 0..1 — event-driven now: each press adds `amount`, rises over half a
   * second (the mist landing), then dries back to zero over the dial. A press
   * mid-dry stops the fade and stacks on top of what's still wet.
   */
  const moisture = useMotionValue(scrub ?? 0)
  const anim = useRef<AnimationPlaybackControls | null>(null)
  const spray = () => {
    if (scrub != null) return
    bus.emit()
    anim.current?.stop()
    const target = Math.min(1, moisture.get() + dials.amount)
    const dry = () => {
      anim.current = animate(moisture, 0, { duration: dials.dry, ease: 'linear' })
    }
    if (reduced) {
      /* The rise is motion; the drying is the information. */
      moisture.set(target)
      dry()
    } else {
      anim.current = animate(moisture, target, {
        duration: RISE_S,
        ease: 'easeOut',
        onComplete: dry,
      })
    }
  }
  useEffect(() => () => anim.current?.stop(), [])

  /* Published for the verification script, which reads the number rather than the
     digit wheels — the same dataset convention the shoe page uses. */
  useEffect(() => {
    const write = (v: number) => {
      document.documentElement.dataset.moisture = v.toFixed(3)
    }
    write(moisture.get())
    const off = moisture.on('change', write)
    return () => {
      off()
      delete document.documentElement.dataset.moisture
    }
  }, [moisture])

  /** Pointer parallax, sprung — slow instrument drift, not a cursor follower. */
  const tiltX = useSpring(0, { stiffness: 60, damping: 18 })
  const tiltY = useSpring(0, { stiffness: 60, damping: 18 })
  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType === 'touch') return
    tiltY.set((e.clientX / window.innerWidth - 0.5) * 0.09)
    tiltX.set((e.clientY / window.innerHeight - 0.5) * 0.05)
  }
  const onPointerLeave = () => {
    tiltX.set(0)
    tiltY.set(0)
  }

  return (
    <section className="sz" style={{ height: '100svh' }}>
      <div className="sz__sticky" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <div className="sz__stage">
          {webgl && !lost ? (
            <SceneCanvas
              moisture={moisture}
              tiltX={tiltX}
              tiltY={tiltY}
              frozen={frozen || reduced}
              bus={bus}
              tuning={tuning}
              fabric={fabricHex(dials.fabric)}
              coarse={coarse}
              onLost={() => setLost(true)}
            />
          ) : (
            <FallbackHero moisture={moisture} fabric={fabricHex(dials.fabric)} />
          )}
        </div>

        <div className="sz__chrome">
          <header className="sz__head">
            <h1 className="sz__title">same sweat. different fabric.</h1>

            {/**
             * The line under the headline, and it took two goes.
             *
             * **It was the spec sheet**: "at the same soak, v1 shows about 820 cm² of mark — 24%
             * of the panel. v2 shows none." Both figures were derived from `marksArea`, which was
             * the good part and the wrong instinct — a number integrated off the shader is a fine
             * thing to be able to prove and a poor thing to open with. Nobody stands in front of
             * a hanging sample wanting the area of a stain in square centimetres.
             *
             * So it says the thing instead. The proof is still on the page — it's the picture
             * underneath, and pressing the button is how you get it.
             */}
            <p className="sz__lede">
              work as hard as you like. the sweat goes straight through and the mark never
              arrives.
            </p>

            {/* Under the claim it tests, rather than down in the corner with the dials. The
                button is the whole method of this experiment: read what it's going to show,
                then press the thing that shows it. */}
            <button
              type="button"
              className="sz__spray"
              onClick={spray}
              disabled={scrub != null}
            >
              spray water
            </button>
          </header>

          {/* Under the specimens. Real markup rather than in-canvas text: find-in-page
              should land on a specimen.

              **The product's own voice, not the instrument's.** These were
              `SPECIMEN A · STANDARD JERSEY` in tracked-out mono, which framed the pair
              as two lab samples — and the comparison is not jersey against a knit, it's
              a knit against its own next version. Named for what they are, in the sans,
              at a size you read rather than decode. */}
          <p className="sz__tag sz__tag--a">ShowZero</p>
          <p className="sz__tag sz__tag--b">ShowZero v2</p>

          <button
            type="button"
            className="sz__dialtoggle"
            aria-pressed={panel}
            onClick={() => setPanel((v) => !v)}
          >
            dials
          </button>
        </div>
      </div>

      <SprayDials open={panel} dials={dials} onChange={setDials} />
    </section>
  )
}
