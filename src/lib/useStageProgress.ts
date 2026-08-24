import { useEffect } from 'react'
import { useMotionValue, useScroll, useSpring, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { deadzone, easeInOutCubic, type Easing } from './remap'

/**
 * Light smoothing so the reveal glides instead of tracking trackpad jitter
 * one-for-one. bounce is effectively zero — a scroll-linked reveal that
 * overshoots reads as broken, not springy.
 */
const SMOOTHING = { stiffness: 260, damping: 40, mass: 0.35 } as const

type Options = {
  target: React.RefObject<HTMLElement | null>
  easing?: Easing
  head?: number
  tail?: number
  smooth?: boolean
  /** Debug scrub. When set, replaces scroll entirely. */
  override?: number | null
}

/**
 * Progress 0..1 for one pinned stage: raw scroll → dead zones → easing →
 * optional smoothing, delivered as a single stable MotionValue.
 *
 * Returns its own MotionValue rather than the transform chain so that the
 * debug scrubber can take over the same output without variants knowing.
 */
export function useStageProgress({
  target,
  easing = easeInOutCubic,
  head = 0.08,
  tail = 0.15,
  smooth = true,
  override = null,
}: Options): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    target,
    offset: ['start start', 'end end'],
  })

  const shaped = useTransform(scrollYProgress, (v) => easing(deadzone(v, head, tail)))
  const smoothed = useSpring(shaped, SMOOTHING)
  const source = smooth ? smoothed : shaped

  const out = useMotionValue(0)

  useEffect(() => {
    if (override != null) {
      out.set(override)
      return
    }
    out.set(source.get())
    return source.on('change', (v) => out.set(v))
  }, [source, override, out])

  return out
}
