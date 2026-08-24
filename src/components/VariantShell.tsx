import { useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { useStageProgress } from '../lib/useStageProgress'
import { useStageReady } from '../lib/preload'
import { DiffPair, GridOverlay, type DebugState } from './DebugOverlay'
import type { Variant } from '../variants/types'

/**
 * One pinned stage: a tall section whose sticky child holds the 43:24 photo box.
 * Scroll distance through the section is the reveal's timeline.
 */
export function VariantShell({
  variant,
  debug,
  callouts,
  onToggleControls,
}: {
  variant: Variant
  debug: DebugState
  /** Topbar switch state, for whichever variant draws an annotation layer. */
  callouts: boolean
  /**
   * The stage *is* the disclosure now — there's no button for the controls any more, and
   * clicking the section that the controls are about is what brings them up.
   */
  onToggleControls?: () => void
}) {
  const section = useRef<HTMLDivElement>(null)
  const reduced = !!useReducedMotion()
  const ready = useStageReady()

  const p = useStageProgress({
    target: section,
    easing: variant.easing,
    smooth: variant.smooth ?? true,
    override: debug.scrubbing ? debug.scrub : null,
  })

  // Reduced motion collapses the reveal to a crossfade, so the extra scroll
  // distance would just be dead space.
  const height = reduced ? 150 : variant.scrollVh

  /**
   * Two things a click here must not be mistaken for.
   *
   * A call-out handle is dragged with the pointer while the editor is open, and a drag that
   * ends inside the section still fires a click on the way up — without the first guard,
   * placing a call-out would toggle the chrome every time you let go.
   *
   * The second is text: the annotations are selectable, and a selection made by dragging
   * across a label ends with a click on the label. Anything selected means the pointer was
   * doing something else.
   */
  const click = (e: React.MouseEvent) => {
    if (!onToggleControls) return
    const el = e.target as HTMLElement | null
    if (el?.closest('button, a, input, select, label, .xcallout__handle')) return
    if (window.getSelection()?.toString()) return
    onToggleControls()
  }

  return (
    /* No `role="button"` and no `tabIndex`: this is a 400vh section, and announcing the
       whole reveal as a control would be a worse lie than the one it fixes. The keyboard
       route to the same state is `h`, registered in `App` beside the other letter keys. */
    <section className="section" ref={section} style={{ height: `${height}vh` }} onClick={click}>
      <div className="sticky">
        {/* Inside the pinned box, and absolutely positioned inside it, so the sheet is
            this section's surface rather than the page's.

            It used to be `position: fixed` and a sibling of `.sticky` — which put it over
            the whole viewport, and, because this section is always mounted and its
            progress parks at 1 once you've scrolled through, left the sheet up behind the
            reel, the colourways and both text sections for the rest of the page. The
            background picker is what the page is photographed against; the sheet is a
            state one section enters.

            Absolute rather than fixed is also what makes `overflow: clip` on the parent
            the right tool instead of a browser-dependent argument: an absolute child is
            clipped by it, which is exactly the bound we want. */}
        {variant.Backdrop && <variant.Backdrop p={p} />}

        <div
          className="stage"
          style={
            {
              '--nudge-x': `${debug.nudgeX}px`,
              '--nudge-y': `${debug.nudgeY}px`,
            } as React.CSSProperties
          }
        >
          <div className="camera">
            {!ready ? (
              <div className="loading">decoding…</div>
            ) : debug.diff ? (
              <DiffPair gain={debug.gain} />
            ) : (
              <variant.Component p={p} reduced={reduced} callouts={callouts} />
            )}
            {debug.grid && <GridOverlay />}
          </div>
        </div>
      </div>
    </section>
  )
}
