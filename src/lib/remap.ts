/**
 * Scalar helpers for scroll-linked motion.
 *
 * A scroll-linked reveal has no duration, so it has no easing in the CSS sense.
 * Its "feel" comes entirely from how raw scroll position maps to progress —
 * that mapping lives here.
 */

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

export const mix = (from: number, to: number, t: number) => from + (to - from) * t

/** Map v from [inMin, inMax] to [outMin, outMax], clamped at both ends. */
export const remap = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) => {
  if (inMax === inMin) return outMin
  return mix(outMin, outMax, clamp((v - inMin) / (inMax - inMin)))
}

/**
 * Hold at 0 for the first `head` and at 1 for the last `tail`.
 *
 * Without this the shoe is already mid-transition the instant the section pins,
 * and the finished cross-section scrolls away before it can be read. The dead
 * zones buy both end states a beat of stillness.
 */
export const deadzone = (p: number, head = 0.08, tail = 0.15) =>
  remap(p, head, 1 - tail, 0, 1)

/**
 * Cubic-bezier evaluated for y at x, for reshaping progress.
 *
 * Newton-Raphson with a bisection fallback: cheap, and stable for the
 * steep curves we actually use (a pure Newton solve wanders on those).
 */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  const curve = (a: number, b: number, t: number) => {
    const c = 3 * a
    const d = 3 * (b - a) - c
    const e = 1 - c - d
    return ((e * t + d) * t + c) * t
  }
  const slope = (a: number, b: number, t: number) => {
    const c = 3 * a
    const d = 3 * (b - a) - c
    const e = 1 - c - d
    return (3 * e * t + 2 * d) * t + c
  }

  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1

    let t = x
    for (let i = 0; i < 8; i++) {
      const err = curve(x1, x2, t) - x
      if (Math.abs(err) < 1e-5) return curve(y1, y2, t)
      const s = slope(x1, x2, t)
      if (Math.abs(s) < 1e-6) break
      t -= err / s
    }

    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 20; i++) {
      const v = curve(x1, x2, t)
      if (Math.abs(v - x) < 1e-5) break
      if (v > x) hi = t
      else lo = t
      t = (lo + hi) / 2
    }
    return curve(y1, y2, t)
  }
}

/** Shoe is already on screen and morphing in place → ease-in-out, not ease-out. */
export const easeInOutCubic = cubicBezier(0.645, 0.045, 0.355, 1)
export const easeOutExpo = cubicBezier(0.19, 1, 0.22, 1)
export const easeOutQuad = cubicBezier(0.25, 0.46, 0.45, 0.94)
export const linear = (x: number) => clamp(x)

export type Easing = (x: number) => number

/**
 * 0 → 1 → 0 over the transition.
 *
 * For anything that decorates the transition rather than being part of either
 * end state — scan bars, colour grades, the camera push. Both end states must be
 * the clean photograph, so these have to return to zero.
 */
export const bell = (p: number) => Math.sin(Math.PI * clamp(p))

/** Fade in by `inEnd`, hold, fade out from `outStart`. */
export const fadeInOut = (p: number, inEnd = 0.06, outStart = 0.94) =>
  Math.min(remap(p, 0, inEnd, 0, 1), remap(p, outStart, 1, 1, 0))

/**
 * A stagger window: item `i` of `count` animates over `span` of total progress,
 * offset so the last one finishes exactly at p = 1.
 */
export const staggerWindow = (p: number, i: number, count: number, span: number) => {
  const step = count > 1 ? (1 - span) / (count - 1) : 0
  return clamp((p - i * step) / span)
}
