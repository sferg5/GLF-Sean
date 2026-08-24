import { useEffect, useState } from 'react'
import { SRC } from './shoe'

const load = (src: string) =>
  new Promise<void>((resolve) => {
    const img = new Image()
    // Resolve on error too — a missing file should show a broken image, not
    // hang the whole page behind the gate.
    img.onerror = () => resolve()
    img.onload = () =>
      img.decode ? img.decode().then(() => resolve(), () => resolve()) : resolve()
    img.src = src
  })

/**
 * The two annotation faces, loaded explicitly rather than by waiting on
 * `document.fonts.ready` alone.
 *
 * `ready` resolves when *pending* font loads finish, and at gate time there are none: the
 * only elements set in these faces are inside the stage, which is what's being gated. So
 * it would resolve immediately, the fonts would load a moment later, and every label would
 * re-set itself once the shelf had already been drawn at fallback metrics. `load()` starts
 * the fetches, and then `ready` means something.
 *
 * Both, whichever sheet is showing. The hand is the one that matters more — it's what the
 * paper sheet's call-out labels are set in, their shelves are drawn to the text's own
 * width, and no fallback on any platform is metrically close to a handwriting face, so a
 * swap moves the rule under every label by more than the mono's ever did. It's also
 * fetched on the blueprint, which doesn't use it: the sheet can be switched at any moment
 * from the topbar or the `s` key, and 13KB is cheaper than a face arriving mid-swap.
 *
 * Any size works — `load` matches a face, and the descriptor doesn't vary by size.
 */
const loadFont = () => {
  if (!document.fonts) return Promise.resolve()
  return Promise.all([
    document.fonts.load('10px "Saans Mono"'),
    document.fonts.load('13px "Architects Daughter"'),
  ])
    .then(() => document.fonts.ready)
    .then(
      () => {},
      // A font that won't load should show the fallback, not hang the page behind the gate
      // — same reasoning as the image `onerror` above.
      () => {},
    )
}

/**
 * The heading cut, fetched but never waited on.
 *
 * Both weights of Saans are preloaded in index.html, so this is a second line of defence
 * rather than the fetch itself: it asks the font system for the face by descriptor, which
 * is the thing that actually decodes it and puts it in `document.fonts`. Regular is
 * excluded on purpose — it sets the chrome that's already on screen, so it is either
 * loaded by now or the page is looking at Helvetica regardless.
 *
 * Not in the gate below. The first heading is a viewport down, in a section that can be
 * switched off, so waiting on it would cost the stage a millisecond for nothing — and
 * `swap` in the stylesheet covers the case where it hasn't arrived.
 */
const warmHeadingFont = () => {
  if (!document.fonts) return
  document.fonts.load('600 64px "Lululemon Saans"').catch(() => {})
}

let pending: Promise<void> | null = null

/** Memoised, so switching variants never re-gates. */
export const preloadStage = () =>
  (pending ??= Promise.all([load(SRC.start), load(SRC.end), loadFont()]).then(() => {
    warmHeadingFont()
  }))

/**
 * Gate the stage on both images being *decoded* — not merely fetched — and on the
 * annotation face being loaded.
 *
 * Every variant reveals one image through the other. If the second one is still decoding
 * when the reveal starts, the first frames show a hole — and it happens exactly once, on
 * the first scroll, so it's easy to miss in development.
 *
 * The font is in here for a related reason and one extra: a label whose shelf is sized to
 * fallback metrics visibly resizes when the real face arrives, and the verification
 * scripts screenshot shortly after `.loading` clears, so anything that can still change
 * after the gate is a source of flaky comparisons.
 */
export function useStageReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    preloadStage().then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
  return ready
}
