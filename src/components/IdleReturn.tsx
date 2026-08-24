import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

/**
 * The page putting itself back.
 *
 * Twenty seconds with nobody touching anything and a pill comes up in the corner counting
 * three, two, one; at zero the document travels back to the top. It's the behaviour a page
 * left running on a screen needs — this one is eleven thousand pixels of scroll-linked
 * reveal, and whoever walks up to it next should find the shoe rather than the FAQ.
 *
 * **It announces before it acts, and anything cancels it.** An automatic scroll with no
 * warning is a page snatching itself away from someone who was reading; three seconds of
 * notice is what turns it into an offer. A pointer moving, a key, a wheel, a finger — any
 * of them clears the count and starts the twenty seconds again, so the reset only ever
 * happens to a room with nobody in it.
 *
 * Two things it deliberately doesn't do. It doesn't arm at the top of the page, because
 * there is nowhere to take you and a countdown to a no-op is a lie. And it doesn't watch
 * `scroll` — see `ACTIVITY`.
 *
 * The switch in the topbar starts it by hand — see `IdleSwitch`, which is how you look at
 * any of this without sitting still for twenty seconds first.
 */

/** How long the page has to be left alone before it offers to reset itself. */
const IDLE_MS = 20_000

/** Three seconds of notice, one number a second. */
const FROM = 3
const TICK_MS = 1000

/**
 * How long a hand-started notice survives the hand that started it.
 *
 * A click on the switch and a press of `i` are both activity, and activity is the thing
 * that cancels this — without a moment's grace the notice would be taken down by the
 * gesture that asked for it, or by the pointer settling a frame afterwards. Long enough to
 * cover both, short enough that it is still the same rule everyone else gets: half a second
 * later, moving the mouse takes it away.
 */
const GRACE_MS = 500

/**
 * What counts as someone being here.
 *
 * `scroll` is not in the list, and its absence is what stops the return from cancelling
 * itself: the travel below moves the document, the document fires `scroll`, and a listener
 * on it would read the page's own gesture as a hand on the wheel. Nothing is lost by
 * leaving it out — every way a person has of scrolling this page fires something else
 * first. A wheel or a trackpad fires `wheel`, a finger fires `touchstart` and then
 * `touchmove`, a scrollbar drag fires `pointerdown`, arrows and space fire `keydown`.
 */
const ACTIVITY = [
  'pointermove',
  'pointerdown',
  'wheel',
  'keydown',
  'touchstart',
  'touchmove',
] as const

/**
 * The travel.
 *
 * Scaled to the distance and then clamped, because the two ends of this page are nothing
 * like each other: a return from the prose section is a few thousand pixels and a return
 * from the bottom of the FAQ is most of a minute's scrolling. A fixed duration makes one
 * of those a crawl and the other a jump-cut. The ceiling is what keeps the long one from
 * becoming a journey — 900ms is a page moving, not a page touring itself.
 */
const TRAVEL = { min: 420, max: 900, perPx: 0.06 }

/**
 * In-out cubic, the same curve as `--ease-in-out-cubic`, because this is travel between two
 * resting positions rather than something arriving. An ease-out would put the largest step
 * of a fifteen-thousand-pixel scroll in the first frame, which reads as a cut and not a move.
 */
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** Toast in, toast out — an exit shouldn't ask to be watched. Same pair as the nav's. */
const IN = { duration: 0.28, ease: [0.19, 1, 0.22, 1] } as const
const OUT = { duration: 0.16, ease: [0.4, 0, 1, 1] } as const

/**
 * The number changing, as a drum rather than as a swap.
 *
 * Each digit is a card on a cylinder turning towards you: the new one comes up from under
 * the window tipped away, rights itself as it reaches the middle, and pushes the old one
 * up and over the top. That's the split-flap, and it's what a figure needs to read as one
 * value *becoming* another instead of two values taking turns in the same box.
 *
 * The rotation is what makes it a card and not a slide. `rotateX` is signed off the drum:
 * a digit below the window has its bottom edge facing away, which is negative, and a digit
 * leaving over the top has its top edge facing away, which is positive. `perspective` lives
 * on the window in CSS — at this size it has to be close to the box's own scale or the
 * turn flattens into a nudge.
 *
 * A spring rather than a curve, because this is an object with weight arriving at a stop.
 * Firm enough to land in about a third of a second, which is a third of the beat it has.
 *
 * `lab/Odometer.tsx` is the same idea solved for the opposite problem — a figure that
 * changes on every frame of a scroll, where mounting anything per value is the cost.
 */
const DRUM = { type: 'spring', stiffness: 460, damping: 32, mass: 0.9 } as const
const UNDER = { y: '64%', rotateX: -68 }
const FACING = { y: '0%', rotateX: 0 }
const OVER = { y: '-64%', rotateX: 68 }

/**
 * The notice's state, held above both the thing that shows it and the switch that starts it.
 *
 * Same shape as `useCallouts` and `useBackground`: the state lives on the page so a control
 * in the topbar and the overlay at the other end of the document can be looking at one
 * value rather than at two that have to be kept in step.
 */
export function useIdleReturn() {
  /** `null` is "not counting". Otherwise it's the number showing. */
  const [count, setCount] = useState<number | null>(null)

  /** Deadline, not a duration: `performance.now()` past this and the grace is over. */
  const grace = useRef(0)

  const start = useCallback(() => {
    grace.current = performance.now() + GRACE_MS
    setCount(FROM)
  }, [])

  /**
   * `i` does the same thing, and it earns its letter the way `c` and `s` do: this is a
   * behaviour about the bottom of a long page, and the switch for it is at the top behind a
   * disclosure. Testing it from where you can see it is the point.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key.toLowerCase() === 'i') start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start])

  return { count, setCount, start, grace }
}

export type Idle = ReturnType<typeof useIdleReturn>

/**
 * The switch, in the topbar with the rest of the instrument.
 *
 * It reports rather than remembers: on means the notice is up *right now*, so it turns
 * itself off when the countdown ends and the page moves. That's the honest state for a
 * control over something that only ever lasts three seconds — a preference switch would be
 * claiming this is a mode, and it isn't, it's an event.
 *
 * Which also makes it the trigger. Pressing it on is the only way to see the notice without
 * leaving the page alone for twenty seconds first; pressing it off takes it down, exactly
 * as moving the mouse would.
 *
 * It will start the notice at the top of the page, where the clock wouldn't — a control that
 * ignored the press it was just given is worse than one that shows you a countdown with
 * nowhere to travel. Scroll down first if it's the travel you're checking.
 */
export function IdleSwitch({ idle }: { idle: Idle }) {
  const on = idle.count !== null

  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={on}
      onClick={() => (on ? idle.setCount(null) : idle.start())}
      title="Idle notice (i)"
    >
      <span className="toggle__name">Idle</span>
      <span className="toggle__track">
        <span className="toggle__knob" />
      </span>
    </button>
  )
}

export function IdleReturn({ idle }: { idle: Idle }) {
  const reduced = !!useReducedMotion()
  const { count, setCount, grace } = idle

  /* Read by the activity listener, which is registered once and would otherwise be holding
     the `count` from the render that registered it. */
  const counting = useRef(false)
  const raf = useRef(0)

  useEffect(() => {
    counting.current = count !== null
  }, [count])

  /**
   * Back to the top, under our own power.
   *
   * `html` sets `scroll-behavior: auto` on purpose — smooth scrolling a scroll-linked page
   * turns every anchor jump and every variant reset into a ride through the whole reveal.
   * This is the one place that wants the ride, so it's animated here rather than by
   * loosening the rule for the whole document.
   *
   * Reduced motion gets the jump instead. A long automatic scroll nobody asked for is close
   * to the definition of what that setting is protecting against, and the notice has already
   * been given by then — the pill is the part that matters, and it stays.
   */
  const travel = useCallback(() => {
    const from = window.scrollY
    if (from <= 0) return

    if (reduced) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }

    const ms = Math.min(TRAVEL.max, Math.max(TRAVEL.min, from * TRAVEL.perPx))
    const t0 = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      window.scrollTo(0, Math.round(from * (1 - easeInOutCubic(t))))
      if (t < 1) raf.current = requestAnimationFrame(step)
    }

    raf.current = requestAnimationFrame(step)
  }, [reduced])

  /**
   * The idle clock, and the one hand that can stop it.
   *
   * Registered once for the life of the page: the listeners fire on every pointer move, and
   * re-binding six of them whenever the count changes would be six removals and six adds a
   * second for the three seconds it matters most.
   */
  useEffect(() => {
    let idle = 0

    const arm = () => {
      window.clearTimeout(idle)
      idle = window.setTimeout(() => {
        /* A hidden tab isn't idle, it's absent — nothing should be counting down behind
           another window, and the visibility change re-arms this when it comes back.
           Already at the top, there is nothing to return to. And a notice started by hand
           is already saying what this one would say, so the clock must not restart its
           count from three underneath it. Re-arm and wait, in all three cases. */
        if (document.hidden || window.scrollY <= 0 || counting.current) {
          arm()
          return
        }
        setCount(FROM)
      }, IDLE_MS)
    }

    const onActivity = () => {
      /* Mid-travel this is a hand taking the page back, and it gets it: the tween stops
         wherever it is rather than fighting the wheel to a finish. */
      cancelAnimationFrame(raf.current)
      /* Inside the grace, this is the click or the keypress that asked for the notice —
         see `GRACE_MS`. Leave both the count and the clock alone. */
      if (performance.now() < grace.current) return
      if (counting.current) setCount(null)
      arm()
    }

    arm()
    for (const type of ACTIVITY) {
      window.addEventListener(type, onActivity, { passive: true })
    }
    document.addEventListener('visibilitychange', onActivity)

    return () => {
      window.clearTimeout(idle)
      cancelAnimationFrame(raf.current)
      for (const type of ACTIVITY) window.removeEventListener(type, onActivity)
      document.removeEventListener('visibilitychange', onActivity)
    }
  }, [grace, setCount])

  /**
   * One timeout per number rather than an interval, so the count and the thing it's counting
   * to are the same clock — an interval that fires a beat late leaves the pill showing 1
   * while the page has already moved.
   */
  useEffect(() => {
    if (count === null) return

    const t = window.setTimeout(() => {
      if (count > 1) {
        setCount(count - 1)
        return
      }
      /* The last number has had its full second. Clear first: the pill leaves as the page
         starts moving, rather than riding back up with it. */
      setCount(null)
      travel()
    }, TICK_MS)

    return () => window.clearTimeout(t)
  }, [count, setCount, travel])

  return (
    <>
      {/*
        Said once, in a sentence, rather than by making the pill itself live — a region
        that re-announced every tick would read "3", "2", "1" over whatever the screen
        reader was in the middle of. Mounted always and empty at rest, because a live
        region inserted with its text already in it is announced inconsistently.
      */}
      <div className="idletoast__say" role="status">
        {count !== null ? 'Idle. Returning to the top of the page.' : ''}
      </div>

      <AnimatePresence>
        {count !== null && (
          <motion.div
            className="idletoast"
            aria-hidden="true"
            /* Up and out of the corner it's anchored to, which is the direction it would
               have come from if it had been pushed onto the screen from below. */
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96, transition: reduced ? { duration: 0 } : OUT }}
            transition={reduced ? { duration: 0 } : IN}
          >
            scrolling back to top in{' '}
            <span className="idletoast__n">
              {/* `popLayout` takes the leaving card out of the flow, so the two are on the
                  drum together rather than queued in a line — in flow, the arriving digit
                  would be pushed along the row by the one it's replacing, which is the
                  sideways travel this used to have. */}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={count}
                  /* Reduced motion keeps the change and drops the drum: the digit is the
                     information, and turning it through space is the part that isn't. */
                  initial={reduced ? { opacity: 0 } : UNDER}
                  animate={reduced ? { opacity: 1 } : FACING}
                  exit={reduced ? { opacity: 0 } : OVER}
                  transition={reduced ? { duration: 0.12 } : DRUM}
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
