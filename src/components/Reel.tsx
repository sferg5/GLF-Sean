import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import type { MotionStyle, MotionValue } from 'motion/react'
import { easeInOutCubic, easeOutQuad, remap, staggerWindow } from '../lib/remap'
import {
  COLUMNS,
  GUTTER,
  PORTRAIT,
  REDUCED,
  ROOM,
  EXIT_TRAVEL,
  SCROLL_VH,
  arrival,
  mixHex,
  place,
  windows,
  type Column,
  type Timing,
} from '../lib/reel'

/**
 * The running reel — the second act, below the x-ray.
 *
 * Six columns of footage rising past one line of type, one column at a time, each at its own
 * speed and with its own inertia, in a room that empties, inverts, and then slides up out of
 * the window taking the type with it.
 *
 * It shares no state with the stage above it and can be switched off from the topbar
 * without the x-ray noticing.
 */

const HEADLINE = 'Weightless, mile after mile.'

/** Where the room is between dark and light, for one of its three colours. */
const mix = (t: number, key: keyof typeof ROOM.dark) =>
  mixHex(ROOM.dark[key], ROOM.light[key], t)

/**
 * Six columns at desktop widths, fewer as the page narrows.
 *
 * Columns are dropped rather than squeezed: a sixth of a phone is 60px, which is a strip
 * and not a frame. Dropped from the end, so column 1 is always the forest and the
 * composition degrades predictably.
 */
const BREAKPOINTS = [
  { query: '(min-width: 1024px)', columns: 6 },
  { query: '(min-width: 640px)', columns: 4 },
] as const

const NARROW = 3

function useColumnCount() {
  const [count, setCount] = useState(() => {
    if (typeof window === 'undefined') return BREAKPOINTS[0].columns
    return BREAKPOINTS.find((b) => window.matchMedia(b.query).matches)?.columns ?? NARROW
  })

  useEffect(() => {
    const lists = BREAKPOINTS.map((b) => window.matchMedia(b.query))
    const read = () => setCount(BREAKPOINTS.find((_, i) => lists[i].matches)?.columns ?? NARROW)
    read()
    lists.forEach((l) => l.addEventListener('change', read))
    return () => lists.forEach((l) => l.removeEventListener('change', read))
  }, [])

  return count
}

/**
 * Play only what is on screen, and only when motion is welcome.
 *
 * Six looping videos decoding behind a shoe nobody has scrolled past yet is the kind of
 * cost that never shows up in a screenshot. The elements are found by query rather than
 * through a ref array: they're leaves that nothing else addresses, and a ref per column
 * would exist purely to hand this effect a list it can already get.
 */
function usePlayback(root: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const videos = root.current?.querySelectorAll('video')
    if (!videos) return

    videos.forEach((v) => {
      if (!active) {
        v.pause()
        return
      }
      // Autoplay can still be refused (a data-saver setting, a policy we don't know
      // about). The poster is the fallback, so there's nothing to handle.
      v.play().catch(() => {})
    })
  }, [root, active])
}

export function Reel({ timing }: { timing: Timing }) {
  const section = useRef<HTMLElement>(null)
  const reduced = !!useReducedMotion()
  const columns = useColumnCount()

  const height = reduced ? REDUCED.height : SCROLL_VH
  /**
   * Both dials come through here — see `components/ReelDials.tsx`. Reduced motion keeps its own
   * inversion window, because the pin it has to fit inside is 220svh rather than 660 and a value
   * dialled against the full timeline would fall off the end of it.
   */
  const { rules, title, flip: dialled, exit } = windows(timing)
  const flip = reduced ? REDUCED.flip : dialled

  /**
   * One timeline, measured from `start end` — the instant the section's top edge reaches
   * the bottom of the window — so it covers the arrival as well as the pin. The columns
   * move and the room builds itself while the section is still sliding up, which is the
   * difference between a section that opens and one that lands and then starts.
   *
   * Converted straight to `svh` of scroll, because that's what everything in `lib/reel.ts`
   * is written in. The conversion is exact: the scroll range of that offset pair is the
   * section's own height.
   */
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ['start end', 'end end'],
  })
  const s = useTransform(scrollYProgress, (v) => v * height)

  /**
   * Start the videos before the section arrives, so a tile is moving footage rather than a
   * still by the time it climbs into view — `preload="none"` below means the fetch begins
   * here. Half a viewport of warning is about a second of scrolling.
   */
  const near = useInView(section, { margin: '50% 0px 50% 0px' })
  usePlayback(section, near && !reduced)

  /**
   * Published for `scripts/reel.sh`, which asserts the phase order and would otherwise have
   * to hard-code numbers that two sliders can move. Same trick the variants use: the page
   * states its own timeline, and the check reads it rather than assuming it.
   *
   * Arrivals are derived from the columns; the rest is the dials. The last *exit* isn't here
   * — it depends on how tall a tile is at the current column width, which is a thing only
   * the browser knows.
   */
  useEffect(() => {
    const arrivals = COLUMNS.slice(0, columns).map(arrival)
    document.documentElement.dataset.reel = JSON.stringify({
      rules: rules.map(Math.round),
      title: title.map(Math.round),
      tiles: [Math.round(Math.min(...arrivals)), Math.round(Math.max(...arrivals))],
      flip,
      exit: reduced ? null : exit,
      pin: height,
    })
  }, [columns, rules, title, flip, exit, height, reduced])

  /**
   * Every transform in this component is written as a function of progress rather than as a
   * keyframe array. It reads the same, and it keeps motion off the scroll-timeline path,
   * where a keyframed transform over a scroll value is handed to the compositor and stops
   * being clamped past the end of its range — see the note in App.tsx, which is the same
   * bug found the hard way.
   */
  const turn = useTransform(s, (v) => easeInOutCubic(remap(v, flip[0], flip[1], 0, 1)))
  const bg = useTransform(turn, (t) => mix(t, 'bg'))
  const rule = useTransform(turn, (t) => mix(t, 'rule'))

  /**
   * The headline arrives after the rules have finished, not with them — see `windows()`.
   *
   * It arrives and then never moves again — not relative to the room, anyway. It
   * leaves when the room does, by the pin ending and the whole section sliding up with the
   * page. Two earlier versions had the type exit under its own power and both were the wrong
   * instrument: it made the *type* the thing that moved, when what should move is the page.
   */
  const enter = useTransform(s, (v) => easeOutQuad(remap(v, title[0], title[1], 0, 1)))
  const headY = useTransform(enter, (t) => `${(1 - t) * 4}svh`)

  /**
   * The room leaves under its own power, at half the page's speed.
   *
   * It's sticky, so releasing the pin would slide it out for free — but a released sticky moves
   * at exactly page speed, and that was the complaint: the type went by too fast to read on the
   * way out. So it translates `EXIT_TRAVEL` across a window twice that long, which is half
   * speed by construction, and the release that follows is moving a room that has already left.
   *
   * Linear, unusually for this file. Every other transform here is eased, but "half speed" is a
   * *rate*, and easing it would make the rate the one thing it isn't — fast in the middle and
   * slow at the ends, averaging out to the number asked for while never actually being it.
   *
   * Reduced motion opts out and lets the release do it: 130svh of scroll whose whole content is
   * a translation is exactly what that setting is for.
   */
  const leave = useTransform(s, (v) =>
    reduced ? '0svh' : `${-EXIT_TRAVEL * remap(v, exit[0], exit[1], 0, 1)}svh`,
  )

  return (
    <section className="reel" ref={section} style={{ height: `${height}svh` }}>
      <motion.div
        className="reel__room"
        style={
          {
            y: leave,
            background: bg,
            '--reel-rule': rule,
            '--reel-cols': columns,
            '--reel-gutter': `${GUTTER}px`,
          } as MotionStyle
        }
      >
        {/* Behind the footage, so a rule stops where a tile crosses it rather than being
            drawn over the picture. */}
        <div className="reel__rules" aria-hidden="true">
          {Array.from({ length: columns - 1 }, (_, i) => (
            <ReelRule
              key={i}
              index={i}
              count={columns - 1}
              window={rules}
              s={s}
              reduced={reduced}
            />
          ))}
        </div>

        {COLUMNS.slice(0, columns).map((column, i) => (
          <ReelColumn
            key={i}
            column={column}
            /* Every tile is portrait once the columns are phone-narrow. A 16:9 tile in a
               130px column is 73px tall, which reads as a mistake rather than as a frame;
               the wide clips are cropped to portrait by `object-fit` instead, and at that
               display size there is far more source than they need. */
            aspect={columns > NARROW ? column.aspect : PORTRAIT}
            s={s}
            reduced={reduced}
          />
        ))}

        {/* Over every column, and blended into them — see the stylesheet. The colour is
            fixed white and never animates: `difference` makes the rendered ink `|room −
            white|`, so the type inverts in exact step with the background, and the two
            transitions the ending needs are one animated value. */}
        <motion.h2 className="reel__head" style={{ y: headY, opacity: enter }}>
          {HEADLINE}
        </motion.h2>
      </motion.div>
    </section>
  )
}

/**
 * One dividing rule, drawing downward from the top of the room.
 *
 * Staggered left to right across the opening window, which is what makes the empty room read
 * as being built rather than as being uncovered. Its own
 * component for the same reason the columns are: a hook per line, and the number of lines
 * changes with the viewport.
 */
function ReelRule({
  index,
  count,
  window: draws,
  s,
  reduced,
}: {
  index: number
  count: number
  /** The dialled window the whole set draws across, in `svh`. */
  window: readonly [number, number]
  s: MotionValue<number>
  reduced: boolean
}) {
  const draw = useTransform(s, (v) => {
    // Reduced motion gets the rules, not the drawing — they're structure, and a line
    // growing out of nothing is exactly the kind of movement to hand back.
    if (reduced) return 1
    return easeOutQuad(staggerWindow(remap(v, draws[0], draws[1], 0, 1), index, count, 0.6))
  })

  return <motion.span style={{ left: `calc(${index + 1} * 100% / var(--reel-cols))`, scaleY: draw }} />
}

/**
 * One column: one tile, rising once through the room and out of it.
 *
 * Its own component because the spring is per column and hooks can't be called from inside
 * a map.
 */
function ReelColumn({
  column,
  aspect,
  s,
  reduced,
}: {
  column: Column
  aspect: number
  s: MotionValue<number>
  reduced: boolean
}) {
  /**
   * The spring is what makes a column carry: it chases a target that scroll has already
   * moved on from, so it lags under the wheel and keeps going for a beat after it stops.
   * Damping is low enough to overshoot very slightly at the end of a flick, which is the
   * difference between inertia and lateness.
   *
   * Reduced motion pins the target at the frame the wall is most spread over, rather than
   * skipping the spring: the hook still runs, and it starts settled there because
   * `useSpring` takes its initial value from the source.
   */
  const target = useTransform(s, (v) => (reduced ? REDUCED.at : v))
  const eased = useSpring(target, column.spring)
  const y = useTransform(eased, (v) => `${place(column, v)}svh`)

  return (
    <div className="reel__col">
      <motion.figure className="reel__tile" style={{ y, aspectRatio: aspect }}>
        <video
          className="reel__video"
          src={column.clip.src}
          poster={column.clip.poster}
          /* muted + playsInline is what makes autoplay legal. `loop` is about the clip, not
             the tile: four seconds of footage has to last the ~160svh of scrolling the tile
             spends crossing the window, and it only ever crosses once. */
          muted
          loop
          playsInline
          /* Nothing is fetched until `usePlayback` asks for it. */
          preload="none"
          /* Decoration with no caption and no controls: it should be neither announced nor
             reachable by tab. */
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
        />
      </motion.figure>
    </div>
  )
}
