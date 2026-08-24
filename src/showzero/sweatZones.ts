import { clamp } from '../lib/remap'

/**
 * Where sweat shows, in swatch space.
 *
 * Each zone is a seed: a centre, the radius it grows to at full soak, and the
 * moisture level it starts at. On a hung sample the seeds aren't anatomical any
 * more — they're staggered blots, the way a sample behaves under a dropper: one
 * early, one as things get going, the stragglers only near full soak, so scrubbing
 * the slider tells a sequence rather than inflating one blob.
 *
 * This file is read twice: the shader bakes these numbers into its distance field,
 * and the readout integrates them into the cm² figure. One source, so the number
 * printed under the specimen is the same maths as the pixels above it — a readout
 * that doesn't survive being checked is set dressing.
 */

export type Zone = {
  x: number
  y: number
  /** Radius at full soak, swatch units. */
  r: number
  /** Moisture level at which the mark first appears. */
  onset: number
}

/** Swatch space: x ∈ [-0.5, 0.5], y ∈ [-0.675, 0.675]. */
export const ZONES: Zone[] = [
  { x: -0.14, y: 0.28, r: 0.17, onset: 0.02 },
  { x: 0.17, y: -0.04, r: 0.2, onset: 0.22 },
  { x: -0.19, y: -0.36, r: 0.16, onset: 0.45 },
  { x: 0.29, y: 0.44, r: 0.11, onset: 0.62 },
]

/** How long a zone takes to reach full size once it has started. */
export const GROW_SPAN = 0.5

/** 0..1 growth for one zone at moisture m — the shader runs the same smoothstep. */
export const zoneGrowth = (m: number, onset: number) => {
  const t = clamp((m - onset) / GROW_SPAN)
  return t * t * (3 - 2 * t)
}

/**
 * Swatch units to centimetres. The sample is one unit wide and reads as a ~50 cm
 * cut, so one unit is 50 cm. The readout doesn't pretend to more precision than
 * that — it quotes the same circles the shader draws.
 */
const CM_PER_UNIT = 50

/** Marked area in cm² at moisture m, for the fabric that shows it. */
export const marksArea = (m: number) => {
  let area = 0
  for (const z of ZONES) {
    const r = z.r * Math.sqrt(zoneGrowth(m, z.onset))
    area += Math.PI * r * r
  }
  return area * CM_PER_UNIT * CM_PER_UNIT
}
