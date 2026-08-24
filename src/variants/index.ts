import { easeInOutCubic } from '../lib/remap'
import { Backdrop } from '../lab/Backdrop'
import { SectionPlate } from './SectionPlate'
import { XRayDissolve } from './XRayDissolve'
import type { Variant } from './types'

/**
 * The registry is what `VariantShell` renders and what the verification scripts
 * enumerate, and it's the seam for putting alternatives back. Earlier explorations
 * (blade wipe, cut-line bloom, slice bands, aperture) are still in this folder,
 * unregistered.
 *
 * The plain dissolve is kept registered next to the section plate rather than
 * retired, because it's the control: it's the same cut with none of the
 * instrumentation, so switching answers "is the technical treatment carrying this,
 * or is the cut?" without a rebuild.
 *
 * Order is meaningful in three places at once, so it's worth stating: this array's
 * order is the switcher's order, index 0 is what the page loads with, and `?v=` is
 * a 1-based index into it. There's no separate "default" flag to fall out of sync,
 * but it does mean reordering changes the landing experience and invalidates any
 * `?v=` link that was shared earlier.
 */
export const VARIANTS: Variant[] = [
  {
    id: 1,
    name: 'X-ray',
    Component: XRayDissolve,
    scrollVh: 300,
    easing: easeInOutCubic,
    hasCallouts: true,
  },
  {
    id: 2,
    name: 'Sketch',
    Component: SectionPlate,
    Backdrop,
    // Longer than the plain dissolve: the environment builds, the cut runs, then
    // the callouts land. At 300vh the annotations arrive faster than they read.
    scrollVh: 420,
    easing: easeInOutCubic,
    cleanEnds: false,
    hasSheet: true,
  },
]
