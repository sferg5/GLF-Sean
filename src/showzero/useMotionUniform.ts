import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { MotionValue } from 'motion/react'

/**
 * The bridge between the page's motion values and the GL scene.
 *
 * The house pattern, restated for three.js: components subscribe to a MotionValue
 * and mutate — a uniform, a rotation — then ask the demand-mode canvas for one frame.
 * React never re-renders on scroll; multiple emits inside one rAF coalesce into a
 * single draw because `invalidate` only schedules.
 *
 * Same shape as ParticleField's `p.on('change') → schedule` — see that file for the
 * argument. `apply` should be cheap and idempotent; it runs once on mount so the
 * first frame is already right.
 */
export function useMotionUniform(mv: MotionValue<number>, apply: (v: number) => void) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    apply(mv.get())
    invalidate()
    return mv.on('change', (v) => {
      apply(v)
      invalidate()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply is intentionally
    // taken as-of-subscription; re-subscribing per render would thrash the listener.
  }, [mv, invalidate])
}
