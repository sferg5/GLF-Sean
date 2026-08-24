import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { VariantShell } from '../components/VariantShell'
import { Colorways } from '../components/Colorways'
import { Prose } from '../components/Prose'
import { Faq } from '../components/Faq'
import { SectionOrder, useSectionOrder } from '../components/SectionOrder'
import { DebugPanel, useDebug, variantFromUrl } from '../components/DebugOverlay'
import { BackgroundPicker, useBackground } from '../components/Background'
import { CalloutSwitch, useCallouts } from '../components/CalloutSwitch'
import { CalloutEditor } from '../components/CalloutEditor'
import { Reel } from '../components/Reel'
import { ReelDials, useReelTiming } from '../components/ReelDials'
import { VariantSwitcher } from '../components/VariantSwitcher'
import { Clip } from '../components/Clip'
import { clipEnabled } from '../lib/clip'
import { SheetSwitch } from '../components/SheetSwitch'
import { IdleReturn, IdleSwitch, useIdleReturn } from '../components/IdleReturn'
import type { SectionId } from '../lib/sections'
import { useReelEnabled } from '../lib/useReelEnabled'
import { useSheet, useSheetKey } from '../lib/sheet'
import { VARIANTS } from '../variants'

/**
 * The shoe page — everything this prototype was before it had more than one page.
 *
 * It's the whole of the old `App`, moved rather than rewritten, and the move is what
 * scopes the instrument: the `h` key, the digits, the sheet key, the idle return, the
 * panels and the dataset publishing all live in hooks here, so leaving the page
 * unregisters them and coming back re-initialises them from the URL and storage,
 * exactly like a reload. Nothing had to learn to check which page it's on.
 */
export function ShoesPage() {
  const [active, setActive] = useState(() => variantFromUrl(VARIANTS.length))
  const { debug, patch } = useDebug()
  const [bg, setBg] = useBackground()
  const [callouts, setCallouts] = useCallouts()
  const reel = useReelEnabled()
  /* Read once, like the reel's: nothing writes it at runtime, and a section that appeared
     mid-page would have to re-measure its own pin. */
  const [clip] = useState(clipEnabled)
  const [sheet, setSheet] = useSheet()
  const [timing, setTiming] = useReelTiming()
  const [order, setOrder] = useSectionOrder()
  const idle = useIdleReturn()
  const reduced = !!useReducedMotion()
  const variant = VARIANTS[active]

  /* The key that swaps blueprint for paper. Registered here rather than inside the switch,
     so it still works on the variant that doesn't render one — and after the chrome has
     receded, which is the only time the choice can actually be judged. */
  useSheetKey()

  /**
   * Whether the page's controls are on screen. Closed to start.
   *
   * They used to be up on load and recede on the first scroll, which meant the first
   * thing anyone saw was a colour picker, three switchers and a section list laid over
   * the photograph the page opens on — the instrument in front of the product. Then a
   * disclosure pill in the corner, which was better and was still a permanent control
   * sitting on the page for the sake of an audience of one.
   *
   * **Now the stage itself is the disclosure.** Clicking the x-ray brings the controls up
   * and clicking it again puts them away, so the page has no chrome of its own at rest —
   * only the nav — and the gesture lands on the section every one of those controls is
   * about. Nothing announces it, which is the trade: it's a build tool, and the people who
   * need it are told once.
   *
   * Scroll doesn't touch them either way. A control you opened deliberately should not
   * disappear because you scrolled to look at what it changed, which is the whole reason
   * you opened it.
   */
  const [controls, setControls] = useState(false)

  /**
   * The keyboard's way to the same switch, since a click on a 400vh section can't be one.
   *
   * `h` for hide — free, next to the other letters the page already answers to (`d`, `x`,
   * `g`, `c`, `s`, and the digits). Without it, removing the pill would have left the
   * entire instrument reachable by pointer only.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key.toLowerCase() === 'h') setControls((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /**
   * Published for the verification scripts, which need to enumerate variants without
   * depending on chrome markup — they used to count switcher pills, which broke the
   * moment the switcher came out. `cleanEnds` rides along so the residue check knows
   * which variants are supposed to end on a bare photograph.
   */
  useEffect(() => {
    const root = document.documentElement
    root.dataset.variants = VARIANTS.map((v) => v.name).join('|')
    root.dataset.cleanEnds = VARIANTS.map((v) => (v.cleanEnds === false ? '0' : '1')).join('|')
  }, [])

  /** Published for the same reason, and because the order is now a thing a check can be wrong about.
      Cleared on unmount — the root shouldn't claim sections another page doesn't have. */
  useEffect(() => {
    document.documentElement.dataset.sections = order.join('|')
    return () => {
      delete document.documentElement.dataset.sections
    }
  }, [order])

  /**
   * The switcher and the number keys both come through here.
   *
   * It writes `?v=` back so the choice survives a reload and can be sent to someone
   * — the param was already read on load, so this just closes the loop. `replaceState`
   * rather than `pushState`: a segmented control isn't navigation, and stacking
   * history entries would make Back walk through every comparison you'd made.
   */
  const select = useCallback((index: number) => {
    setActive(index)
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(index + 1))
    window.history.replaceState(null, '', url)
  }, [])

  // With the plain dissolve on 1 and the section plate on 2, this is how the
  // uninstrumented and instrumented cuts get compared.
  useEffect(() => {
    if (VARIANTS.length < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      const n = Number(e.key)
      if (n >= 1 && n <= VARIANTS.length) select(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select])

  // The two variants pin over different scroll distances, so there's no position
  // worth preserving across a switch — the same pixel means a different frame.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [active])

  /**
   * The sections themselves, by id. Built here rather than in the registry because four of the
   * six need something only this component has — the variant, the debug state, the reel's
   * dialled timing, the film's override — and a registry that took a bag of props to hand
   * back would be a way of writing this twice.
   *
   * The reel's and the film's entries are `null` when they're switched off, which is what
   * makes the page shorter rather than emptier: `{null}` renders nothing and the order still
   * holds for the rest.
   */
  const sections: Record<SectionId, ReactNode> = {
    /* Remounting per variant resets the stage's scroll listeners and motion values cleanly,
       instead of leaving stale springs mid-flight. */
    xray: (
      <VariantShell
        key={variant.id}
        variant={variant}
        debug={debug}
        callouts={callouts}
        onToggleControls={() => setControls((v) => !v)}
      />
    ),
    reel: reel ? <Reel timing={timing} /> : null,
    prose: <Prose />,
    colorways: <Colorways />,
    /* Takes the debug scrubber for the same reason the x-ray does: it's the only way to hold the
       shrink at an exact point, which is what the shot scripts and `?p=` both need. */
    clip: clip ? <Clip override={debug.scrubbing ? debug.scrub : null} /> : null,
    faq: <Faq />,
  }

  return (
    <>
      <header className="topbar">
        {/* The disclosed region. Its switch is the x-ray itself — see `VariantShell` — so
            this bar holds nothing at rest and draws nothing.

            `AnimatePresence` rather than an opacity on a mounted bar: closed, none of this
            should be in the tab order or catching a click over the photograph, and
            unmounting is the only version of that with nothing to keep in sync. */}
        <AnimatePresence initial={false}>
          {controls && (
            <motion.div
              id="page-controls"
              className="topbar__row"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <BackgroundPicker bg={bg} onChange={setBg} />

              {/* Grouped rather than a loose third child of a `space-between` row: loose,
                  the switch appearing and disappearing per variant would drag the other
                  two controls across the screen with it. */}
              <div className="topbar__group">
                {/* First in the group, and the only one of them that isn't about the x-ray:
                    it's here because it's a behaviour of the whole page, and at the head so
                    the two conditional switches after it can come and go without moving it. */}
                <IdleSwitch idle={idle} />

                {variant.hasCallouts && <CalloutSwitch on={callouts} onChange={setCallouts} />}
                {variant.hasSheet && <SheetSwitch sheet={sheet} onSelect={setSheet} />}
                <VariantSwitcher active={active} onSelect={select} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </header>

      {/* The page, in whatever order the panel is set to. Every section owns its own scroll
          timeline and measures against its own box, so this really is just a list — see
          lib/sections.ts.

          Keyed by id rather than by index, so re-ordering moves the DOM nodes instead of
          re-rendering different content into the same ones: a section that moved keeps its
          scroll listeners, its springs and — for the colourways — whatever you were pointing
          at. The x-ray keeps its own `key` inside, which is what still remounts it per
          variant. */}
      {order.map((id) => (
        <Fragment key={id}>{sections[id]}</Fragment>
      ))}

      {/* Disclosed with the top bar, and for the same reason: re-ordering the page is
          something you do to the build rather than something you do while reading it.

          It's wide enough to land *inside* the stage's own box — 190px against the 144px of
          margin the stage leaves at 1440×900 — which used to matter to `verify.sh`, since a
          panel up in one frame and receded in another reads as a 2.9 mean difference. The
          check hides the chrome before it shoots now, and this is closed by default anyway. */}
      <AnimatePresence initial={false}>
        {controls && (
          <motion.aside
            className="panel sections"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <SectionOrder order={order} onChange={setOrder} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Behind the debug key now. It was visible on the argument that its two numbers can
          only be judged from inside the reel, by which point the rest of the chrome has
          receded — true, and still not enough to earn a panel over the footage for every
          viewer who is only there to watch it. `d` brings it back, alongside the scrubber
          and the section list, which is the company it always belonged in: they're all
          instruments for deciding what the build should be.

          Down here with the other panels rather than beside the section it belongs to,
          because it's a fixed overlay and the sections above should be able to say they're
          the page in document order — `reel.sh` asks the reel what follows it. */}
      {reel && debug.on && <ReelDials timing={timing} onChange={setTiming} />}

      {/* Placing a call-out means looking at the photograph it will be read on, so the
          editor pins the scrubber to the end state the chosen phase is drawn at. It
          borrows the debug scrubber to do it rather than adding a second way to
          override progress — `useStageProgress` already has exactly one. */}
      {variant.hasCallouts && (
        <CalloutEditor
          pinned={debug.scrubbing ? debug.scrub : null}
          onPin={(scrub) => patch({ scrubbing: true, scrub })}
        />
      )}

      {/* Down here with the other fixed overlays so the sections above are the page in
          document order, and last of them because it's the only one that can appear without
          anyone having asked for it — a live region announcing the return should come after
          everything the return is about. */}
      <IdleReturn idle={idle} />

      <DebugPanel debug={debug} patch={patch} variantName={variant.name} />
    </>
  )
}
