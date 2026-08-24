import type { ReactNode } from 'react'
import type { MotionValue } from 'motion/react'
import type { Easing } from '../lib/remap'

export type VariantProps = {
  /** 0 = intact shoe, 1 = cross-section. Already dead-zoned and eased. */
  p: MotionValue<number>
  reduced: boolean
  /**
   * Whether the switchable annotation layer is showing — see `hasCallouts` below.
   *
   * Passed to every variant rather than only to the ones that offer a layer, so that
   * the shell has one thing to hand down and a variant deciding to draw annotations
   * is a change in that variant alone.
   */
  callouts: boolean
}

export type Variant = {
  id: number
  /**
   * The switcher's label, and what the debug panel and the verification scripts
   * identify a variant by. It was none of those things once — it was an internal
   * tag — so keep it short and readable rather than descriptive; the component name
   * is where the longer description lives.
   */
  name: string
  Component: (props: VariantProps) => ReactNode
  /**
   * Full-bleed environment behind the stage, for variants that change the room and
   * not just the shoe.
   *
   * It can't live inside `.camera` — the portrait breakpoint puts a `scale` there,
   * which makes it the containing block for anything fixed. So the shell renders it
   * as a sibling of the pinned box instead.
   */
  Backdrop?: (props: { p: MotionValue<number> }) => ReactNode
  /** Scroll distance for the pin. Longer = slower reveal per pixel scrolled. */
  scrollVh: number
  easing?: Easing
  /** Off where the motion should track the scroll exactly. */
  smooth?: boolean
  /**
   * Whether p = 0 and p = 1 are the bare photographs.
   *
   * True for the reveals, whose whole discipline is that nothing is left parked at
   * either end — `verify.mjs` enforces it by requiring their end states to agree
   * with each other. False where the treated state *is* the design and has to
   * survive at p = 1, which exempts the variant from that check and only that check.
   *
   * What the check actually compares is the variant against its own reduced-motion
   * form, so it is about *residue* — grades, washes and sprites that the transition
   * left behind — and not about the frame being empty. A layer that is deliberately
   * up at both ends and identical under reduced motion passes, and should.
   */
  cleanEnds?: boolean
  /**
   * Whether this variant draws an annotation layer the viewer can switch off, which
   * is what puts the switch in the topbar.
   *
   * Declared here so the chrome never has to match on an id to know what controls to
   * offer. The section plate is annotated too and does not claim the switch: its
   * leader lines are the design of that variant rather than an overlay on it.
   */
  hasCallouts?: boolean
  /**
   * Whether this variant is drawn on a sheet the viewer can change — blueprint or
   * toned paper, see `lib/sheet.ts` — which is what puts that switch in the topbar.
   *
   * Same reasoning as `hasCallouts`, and the same discipline: the x-ray is the control
   * and deliberately doesn't offer it. Its annotations are a printed instrument's
   * marks on a bare photograph, and handwriting there would claim an authorship the
   * plain dissolve hasn't earned.
   */
  hasSheet?: boolean
}
