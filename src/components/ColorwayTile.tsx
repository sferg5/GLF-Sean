import { useRef } from 'react'
import { motion, useReducedMotion, useSpring } from 'motion/react'
import type { Colorway } from '../lib/colorways'

/**
 * One tile in the strip: a plate, a shoe standing over it, and the mark that stands in
 * for a cursor when there isn't one.
 *
 * It's its own component for one reason — **the magnet**. A shoe follows the pointer by
 * a few pixels while it's picked up, and each shoe has to return home from wherever it
 * happened to be when the pointer left, on its own spring. Sharing one pair of values
 * across the row would drag all five shoes at once; putting a fresh pair in the parent
 * per hover would snap the last one home. A pair per tile is the shape of the problem.
 *
 * **The pull is a transform, and the rest of the pick-up is not.** The lift, the turn
 * and the scale are CSS on `translate`, `rotate` and `scale`, and those resolve in that
 * order before `transform` — so the magnet composes with them instead of overwriting
 * them, which is what lets a 420ms eased pick-up and a live spring share one element.
 * It does mean the offset is scaled and turned along with the shoe: 5px of pull is drawn
 * at about 7 once the shoe is at 1.39. That's what the number is chosen against.
 */

/** Soft and slightly slow — a magnet, not a cursor. */
const MAGNET = { stiffness: 220, damping: 26, mass: 0.6 }

/** Pixels of pull at the edge of the tile, before the shoe's own scale. */
const MAX = 5

const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v)

export function ColorwayTile({
  colorway,
  active,
  pinned,
  onPreview,
  onPoint,
  onPin,
  onAim,
}: {
  colorway: Colorway
  /** Picked up: hovered, focused, or pinned. */
  active: boolean
  pinned: boolean
  onPreview: (on: boolean) => void
  /** Pointer specifically — the cursor mark, unlike the word, is a pointer's business. */
  onPoint: (on: boolean) => void
  onPin: () => void
  onAim: (e: React.PointerEvent) => void
}) {
  const reduced = !!useReducedMotion()
  const mx = useSpring(0, MAGNET)
  const my = useSpring(0, MAGNET)
  const home = useRef(false)

  /**
   * Off the event's own offset into the button rather than off a measured rect: the
   * pointer moves at up to a couple of hundred events a second and each `getBoundingClientRect`
   * on that path is a forced layout. `offsetX` is already relative to the target, and the
   * target is the button — including the part of its hit area that reaches up over the
   * lifted shoe, which is why the ratio is clamped rather than trusted.
   */
  const pull = (e: React.PointerEvent) => {
    if (reduced || e.pointerType === 'touch') return
    const el = e.currentTarget as HTMLElement
    const native = e.nativeEvent as PointerEvent
    mx.set(clamp((native.offsetX / el.offsetWidth) * 2 - 1) * MAX)
    my.set(clamp((native.offsetY / el.offsetHeight) * 2 - 1) * MAX)
    home.current = false
  }

  const release = () => {
    if (home.current) return
    mx.set(0)
    my.set(0)
    home.current = true
  }

  return (
    <button
      type="button"
      className="cway"
      // Drives the tile's own state in CSS: the hover treatment has to appear for focus
      // and for a pin as well, and `:hover` can't say that.
      data-active={active}
      aria-pressed={pinned}
      aria-label={colorway.name}
      // The dot is the colourway's colour, so it has the same problem the wordmark does
      // on a wall this dark or this light. Same pair, same flag.
      style={
        {
          '--cway-ink': colorway.ink,
          '--cway-ink-dark': colorway.inkDark ?? colorway.ink,
          '--cway-tilt': `${colorway.tilt}deg`,
        } as React.CSSProperties
      }
      onPointerEnter={(e) => {
        onPreview(true)
        if (e.pointerType === 'touch') return
        onAim(e)
        onPoint(true)
        pull(e)
      }}
      onPointerMove={pull}
      onPointerLeave={() => {
        onPreview(false)
        onPoint(false)
        release()
      }}
      onFocus={() => onPreview(true)}
      onBlur={() => onPreview(false)}
      onClick={onPin}
    >
      <span className="cway__plate" />
      {/* Lazy on purpose: five 300KB cutouts a full viewport below the fold have no
          business competing with the two photographs the stage is gated on. */}
      <motion.img
        className="cway__shoe"
        style={{ x: mx, y: my }}
        src={colorway.src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      {/* The tile's own mark, for when there's no pointer to put one under: a keyboard
          walk, or a tap. CSS hides it while the cursor mark is up. */}
      <span className="cway__dot" />
    </button>
  )
}
