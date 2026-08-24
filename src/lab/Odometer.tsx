import { motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'

/**
 * A live number that doesn't reflow.
 *
 * Writing the figure as text is the obvious implementation and it was measurably
 * the most expensive thing on the plate: rewriting `textContent` as you scroll cost
 * a layout on ~66 of 91 frames, against zero for every other layer here. Containment
 * bounds that cost but doesn't remove it, and "everything is style and composite"
 * is the invariant this project is built around.
 *
 * So each digit is a pre-rendered column of 0–9 (plus a blank, for leading zeros)
 * behind a one-row window, and the value moves the column. Nothing is ever
 * rewritten, so nothing is ever laid out — the digits only translate.
 *
 * It also happens to be what the instrument in the reference photograph does. A
 * figure that rolls between values reads as a live measurement in a way that one
 * which teleports between them does not, so the cheap version is also the better
 * looking one.
 */

/**
 * Default row height. Matches the computed line-height of `.hud` (10px × 1.4), which is what
 * the plate and the film's readout are set at — so those two say nothing and get it.
 *
 * It's a CSS length rather than a number because the column no longer translates in pixels:
 * see `Wheel`. Anything that sets a different one has to give its digits a line-height to
 * match, or the glyph won't sit in the middle of its own window.
 */
const ROW = '14px'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/** Index of the blank row at the foot of every column. */
const BLANK = DIGITS.length

/** Rows in a column: ten digits and the blank. What a percentage translate resolves against. */
const ROWS = DIGITS.length + 1

function Wheel({
  value,
  power,
  blankBelow,
}: {
  /** The figure as an integer, already scaled past any decimal point. */
  value: MotionValue<number>
  /** Place value this column shows: 100 for the hundreds digit, and so on. */
  power: number
  /** Show blank instead of a leading zero below this. 0 to always show a digit. */
  blankBelow: number
}) {
  /**
   * A percentage of the column's own height rather than `row × pixels`, and that's what lets
   * one component serve an 11px readout and a 3rem headline figure.
   *
   * A percentage in a transform resolves against the element's own border box, and the column
   * is exactly `ROWS` rows tall — so `-row / ROWS` of it is always one row, whatever unit the
   * row is expressed in. The pixel version needed the row height as a number in JS, which
   * meant the row height couldn't be a `clamp()` and the digits couldn't be responsive.
   */
  const y = useTransform(value, (v) => {
    const n = Math.round(v)
    const row = blankBelow && n < blankBelow ? BLANK : Math.floor(n / power) % 10
    return `${(-row / ROWS) * 100}%`
  })

  return (
    <span className="wheel">
      <motion.span style={{ y }}>
        {DIGITS.map((d) => (
          <b key={d}>{d}</b>
        ))}
        <b>&nbsp;</b>
      </motion.span>
    </span>
  )
}

export function Odometer({
  value,
  places,
  decimals = 0,
  row = ROW,
}: {
  /** Scaled to an integer: a value of 426 with `decimals: 1` reads 42.6. */
  value: MotionValue<number>
  /** Digits before the point. Leading zeros are blanked. */
  places: number
  decimals?: number
  /** Any CSS length. The caller's line-height has to agree with it. */
  row?: string
}) {
  const columns = []
  for (let i = 0; i < places + decimals; i++) {
    const power = 10 ** (places + decimals - 1 - i)
    if (i === places) columns.push(<i key="point">.</i>)
    columns.push(
      // Blank a leading zero only where a digit still follows it, so a value of
      // zero reads "0" and not as an empty box.
      <Wheel key={i} value={value} power={power} blankBelow={i < places - 1 ? power : 0} />,
    )
  }

  return (
    <span className="odometer" style={{ '--row': row } as React.CSSProperties}>
      {columns}
    </span>
  )
}
