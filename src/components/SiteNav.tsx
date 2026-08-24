import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { PAGES, hrefFor, navigate, usePage } from '../lib/page'

/**
 * The page's own nav — a floating pill at the top, the width of a phone whatever the
 * window is.
 *
 * It is not the `topbar`. That one is the instrument: a colour picker, three switchers and
 * a section list, disclosed by a button in the corner and closed by default. This is the
 * product's furniture, and the two are kept apart deliberately — same page, different
 * audiences, and nothing in here should ever have a slider in it.
 *
 * **Mobile width on desktop is the whole composition.** A bar that spans a 1440px window
 * makes the page look like an application; one held to 400px in the middle reads as a
 * surface floating over the photograph, which is what the reference does and what the
 * frosting is for. It's `min(400px, 100%)` rather than a media query, so the phone case
 * isn't a special case — it's the same bar with less room.
 *
 * **The panel folds the bar, not a menu under it.** Opening animates the pill's own height,
 * so what you see is one object growing rather than a second object appearing beneath the
 * first. `AnimatePresence` unmounts the links when closed, so a closed menu is out of the
 * tab order and out of a find-in-page rather than merely invisible.
 */

/** The same fold the FAQ uses. Two folds on one page should be the same fold. */
const FOLD = { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 } as const

/** Links arrive with the fold and leave ahead of it — an exit shouldn't ask to be watched. */
const IN = { duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] } as const
const OUT = { duration: 0.15, ease: [0.4, 0, 1, 1] } as const

/**
 * The mark, as supplied — one path, two subpaths, the omega knocked out of the disc by the
 * fill rule rather than by a second colour. That's what makes it work on this bar: it takes
 * `currentColor` and the hole shows whatever is behind the glass, so it stays right on a
 * near-black wall and on the reel's white room without a second asset.
 *
 * Inline rather than an `<img>`: a mark this small has to inherit the ink, and an `<img>`
 * would be a second request for 1.6KB that can't. The `width`/`height` attributes from the
 * export are dropped so CSS owns the size — the `viewBox` keeps the ratio.
 */
function Logo() {
  return (
    <svg viewBox="0 0 102 103" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M86.1554 75.2006C82.0461 81.3996 76.8215 84.697 70.984 84.697C68.432 84.697 65.7394 84.068 62.9764 82.8302C60.0526 81.5214 57.4805 79.127 55.7222 76.0832C53.9941 73.0395 53.3008 69.7624 53.7831 66.81C54.3859 64.233 55.7323 60.7124 57.2996 56.6338C61.3487 46.0314 66.9249 31.5128 62.1123 24.4108C60.0928 21.4178 56.4456 19.9568 50.99 19.9466C45.5242 19.9669 41.8871 21.4279 39.8576 24.4108C35.065 31.5128 40.6111 46.0314 44.6803 56.6541C46.2275 60.7124 47.594 64.233 48.1767 66.8506C48.6791 69.7726 47.9959 73.0496 46.2376 76.0934C44.5095 79.1371 41.9273 81.5315 39.0035 82.8403C36.2405 84.0781 33.5378 84.7072 30.9959 84.7072C25.1584 84.7072 19.9137 81.4098 15.8446 75.231L15.3723 74.3787C17.3215 75.3629 21.039 76.9964 24.2541 76.9964C25.8517 76.9964 27.3688 76.4992 28.8658 75.5049C37.1046 69.9653 34.3014 63.3097 28.6649 53.0117C26.2736 48.649 23.8221 44.1443 22.727 39.4874C21.5514 34.4957 20.4764 27.211 24.7766 21.7018C26.776 19.1045 29.8605 17.1159 33.8895 15.7767C38.0792 14.3664 43.4746 13.6156 49.935 13.5142H52.0248C58.4852 13.6156 63.8806 14.3664 68.0703 15.7767C72.1093 17.1159 75.1738 19.1045 77.1832 21.7018C81.4935 27.2008 80.4084 34.4957 79.2329 39.4874C78.1377 44.1443 75.6862 48.6389 73.2949 53.0117C67.6584 63.3097 64.8351 69.9653 73.094 75.5049C74.591 76.5094 76.0881 76.9964 77.7057 76.9964C80.9208 76.9964 84.6182 75.3629 86.5875 74.3787L86.1354 75.2107L86.1554 75.2006ZM51 0C22.8274 0 0 23.0512 0 51.5C0 79.9488 22.8274 103 51 103C79.1726 103 102 79.9285 102 51.5C102 23.0715 79.1726 0 51 0Z" />
    </svg>
  )
}

export function SiteNav() {
  const [open, setOpen] = useState(false)
  const page = usePage()
  const reduced = !!useReducedMotion()
  const panelId = useId()
  const bar = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  /**
   * Hidden while reading, back the moment you reach for it.
   *
   * Scroll down and the bar gets out of the way — it floats over full-bleed photography and
   * simulations, and a pill parked over the shot you are trying to read is furniture. Scroll up,
   * which is the gesture of somebody looking for something, and it returns.
   *
   * Two guards keep it from being twitchy. Direction has to *accumulate*: one flick of a trackpad
   * overshoots by a few pixels on settle, so a direction change only counts after 12px of travel
   * the same way — same-direction deltas add up, a reversal starts the count over. And the top of
   * the page is exempt: within the first screen's opening the bar is part of the composition, not
   * an obstruction, so it never hides there and always reappears on the way back.
   */
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let lastY = window.scrollY
    let run = 0
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastY
      lastY = y
      if (y < 80) {
        run = 0
        setHidden(false)
        return
      }
      run = (dy >= 0) === (run >= 0) ? run + dy : dy
      if (run > 12) setHidden(true)
      else if (run < -12) setHidden(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /**
   * Escape closes and hands focus back to the button that opened it, because that's where
   * the keyboard was — closing to nowhere drops the caret at the top of the document.
   *
   * A pointer outside closes it too, on `pointerdown` rather than `click`: a menu that
   * waits for the release stays up under a finger that has already decided to dismiss it.
   */
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      toggle.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(false)
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <nav className="sitenav" aria-label="Main" data-hidden={hidden && !open}>
      <div className="sitenav__bar" ref={bar} data-open={open}>
        <div className="sitenav__row">
          <a className="sitenav__logo" href="#top" aria-label="lululemon, back to top">
            <Logo />
          </a>

          {/* Two rules that cross into an ✕, drawn rather than set as a glyph — the halves
              have to turn independently, and ≡ is at the mercy of whatever the face thinks
              a trigram looks like. Same construction as the controls toggle. */}
          <button
            type="button"
            className="sitenav__toggle"
            ref={toggle}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sitenav__mark" aria-hidden="true" />
          </button>
        </div>

        {/* `initial={false}` so a page load doesn't open a menu nobody asked for. */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={panelId}
              className="sitenav__panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              /* Measured height both ways rather than a `max-height` guess, which either
                 clips the list or eases through empty space below it. */
              transition={reduced ? { duration: 0 } : FOLD}
            >
              <ul className="sitenav__list">
                {PAGES.map(({ id, label }, i) => (
                  <motion.li
                    key={id}
                    initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(4px)', transition: OUT }}
                    /* Staggered behind the fold, so the bar has visibly started growing
                       before the first link lands in it. */
                    transition={reduced ? { duration: 0 } : { ...IN, delay: 0.04 + i * 0.08 }}
                  >
                    <a
                      className="sitenav__link"
                      href={hrefFor(id)}
                      /* The style hangs off this attribute, so what a screen reader
                         announces and what the row looks like can never disagree. */
                      aria-current={page === id ? 'page' : undefined}
                      onClick={(e) => {
                        /* A cmd/ctrl/shift/middle click keeps its meaning — the href is
                           real. The plain click is still intercepted: a full reload would
                           also work, and would be the wrong texture. */
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                        e.preventDefault()
                        navigate(id)
                        setOpen(false)
                        /* The link is about to unmount with the panel — same landing
                           as Escape. */
                        toggle.current?.focus()
                      }}
                    >
                      {label}
                    </a>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  )
}
