import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useStageProgress } from '../lib/useStageProgress'
import { Odometer } from '../lab/Odometer'
import {
  AMOUNT,
  FPS,
  FRAMES,
  POSTER,
  REDUCED,
  SHRINK_END,
  STILL,
  TIERS,
  radiusAt,
  scaleAt,
  scrollVh,
  tierFor,
  type Tier,
} from '../lib/clip'

/**
 * The film, and the frame closing around it.
 *
 * It arrives full-bleed and playing. From the moment the section pins, scroll shrinks it to
 * 80% of the window and rounds its corners — so the same gesture that carries you down the page
 * turns a screen-filling shot into a card sitting on it. Scroll back up and it opens out again,
 * because the size is a function of scroll position and nothing else.
 *
 * **The film runs on its own clock, and that is the whole point.** This section used to scrub:
 * scroll position wrote `currentTime`, a frame at a time. It was smooth in the sense that
 * nothing was dropped — the seek loop presented frames as fast as the display could take them —
 * and it looked terrible, because a trackpad flick asks for several frames per refresh and
 * footage advancing three frames at a time strobes. Nothing in the loop could fix that; the
 * mapping was the problem. So the two are separated now: the film plays at 30fps, and scroll
 * drives the geometry, which is the kind of thing that *does* look good moving at an arbitrary
 * rate. See `lib/clip.ts`.
 *
 * Only two properties animate — `scale` and `border-radius` — on one element, over a video that
 * is otherwise left alone. Nothing here reads a clock or fights the scroller.
 */
export function Clip({ override = null }: { override?: number | null }) {
  const section = useRef<HTMLElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const reduced = !!useReducedMotion()

  /**
   * The hook's default easing, deliberately: `easeInOutCubic` is what a transition between two
   * states wants, slow at both ends and quickest in the middle. The scrub had to override it
   * with `linear` because a film played at a varying rate is a broken film — but a *frame*
   * closing at a varying rate is just a nicely eased frame.
   *
   * No dead zones. The shrink should begin on the first pixel after the pin engages, and its own
   * window below handles the far end.
   */
  const p = useStageProgress({ target: section, head: 0, tail: 0, override })

  /** 0 at full-bleed, 1 at the card. Parked at the card under reduced motion. */
  const k = useTransform(p, (v) => (reduced ? 1 : Math.min(1, v / SHRINK_END)))

  const scale = useTransform(k, scaleAt)
  const radius = useTransform(k, (v) => `${radiusAt(v)}px`)

  const [tier] = useState<Tier>(() =>
    typeof window === 'undefined' ? 'wide' : tierFor(window.innerWidth),
  )

  /**
   * Three quarters of the pinned box on screen starts the film.
   *
   * On the box rather than on the section: the section is nearly three screens tall, so
   * "75% of it" would never be true. The pin is exactly one screen, which is the thing a
   * viewer would call "the video".
   */
  const showing = useInView(pin, { amount: AMOUNT })

  /**
   * Play once, pause on the way out, and start again from the top if you come back to a film
   * that had already finished.
   *
   * No `loop`: the request was explicit, and it's right — a six-second clip cycling forever in
   * the corner of a long page is a thing to scroll away from. It holds its last frame instead.
   */
  useEffect(() => {
    const el = video.current
    if (!el || reduced) return

    if (showing) {
      if (el.ended) el.currentTime = 0
      /* Muted and inline, so this is allowed without a gesture — but Low Power Mode can still
         refuse it, and that has to be survivable rather than handled. The poster stays up. */
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [showing, reduced])

  /**
   * What's on screen, for the readout — read back from the decoder rather than computed.
   *
   * `requestVideoFrameCallback` only fires while frames are being presented, which means it
   * stops of its own accord when the film is paused or has ended, and the last value stays put.
   * That's exactly the behaviour a readout wants and it needs no state of its own.
   */
  const frame = useMotionValue(0)

  useEffect(() => {
    const el = video.current
    if (!el || reduced) return

    let live = true
    const tick = (_now: number, meta: { mediaTime: number }) => {
      if (!live) return
      const at = Math.max(0, Math.min(FRAMES - 1, Math.round(meta.mediaTime * FPS - 0.5)))
      frame.set(at)
      el.dataset.frame = String(at)
      el.requestVideoFrameCallback(tick)
    }

    /* Probed through a local rather than `'…' in el`, which narrows the element to `never` on
       the other side. Where it's missing, `timeupdate` is coarse — about four a second — but the
       readout is the only thing that depends on it. */
    const rvfc: unknown = el.requestVideoFrameCallback
    if (typeof rvfc === 'function') {
      el.requestVideoFrameCallback(tick)
      return () => {
        live = false
      }
    }

    const onTime = () => tick(0, { mediaTime: el.currentTime })
    el.addEventListener('timeupdate', onTime)
    return () => {
      live = false
      el.removeEventListener('timeupdate', onTime)
    }
  }, [reduced, frame])

  const height = reduced ? REDUCED.height : scrollVh()
  const spec = TIERS[tier]

  /* Published for the checks — the page states its numbers, the script asserts relationships. */
  useEffect(() => {
    document.documentElement.dataset.clip = JSON.stringify({
      frames: FRAMES,
      fps: FPS,
      pin: height,
      shrinkEnd: SHRINK_END,
      tier,
      reduced,
    })
  }, [height, tier, reduced])

  /* Both live figures scaled to integers for the odometer: 277 reads 02.77, 92 reads 92. */
  const seconds = useTransform(frame, (i) => (i / FPS) * 100)
  const percent = useTransform(scale, (v) => v * 100)
  const fade = useTransform(p, [0.02, 0.22], [0, 1])

  return (
    <section className="clip" ref={section} style={{ height: `${height}svh` }}>
      <div className="clip__pin" ref={pin}>
        {/* The one animated element. `scale` is composited and `border-radius` is a paint on a
            layer that already has one, so the pair costs a compositor frame rather than a
            layout — which is why the size is a transform and not a width. */}
        <motion.div className="clip__box" style={{ scale, borderRadius: radius }}>
          {reduced ? (
            <img className="clip__video" src={STILL} alt="" />
          ) : (
            <video
              className="clip__video"
              ref={video}
              src={spec.src}
              poster={POSTER}
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              aria-hidden="true"
              tabIndex={-1}
            />
          )}

          {/* The footage is high-key throughout, so mono ink laid straight on it disappears. A
              wash on the edge the text sits on is the film convention; a bordered plate would
              read as a widget parked on a film. */}
          <div className="clip__wash" aria-hidden="true" />

          <motion.div className="clip__hud" style={{ opacity: fade }} aria-hidden="true">
            <div className="clip__id">
              <b>Shoe concept · seq 01</b>
              <span>
                {spec.w} × {spec.h} · {FPS} fps · plays once
              </span>
            </div>

            <dl className="clip__live">
              <dt>Frame</dt>
              <dd>
                <Odometer value={frame} places={3} /> / {FRAMES}
              </dd>
              <dt>Time</dt>
              <dd>
                <Odometer value={seconds} places={2} decimals={2} /> s
              </dd>
              {/* The only figure that is about the scroll rather than the film. It reads 100 at
                  full-bleed and 80 at the card. Named "size" rather than "frame size" because the
                  longer label wrapped to two lines and put the readout off its own grid. */}
              <dt>Size</dt>
              <dd>
                <Odometer value={percent} places={3} /> %
              </dd>
            </dl>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
