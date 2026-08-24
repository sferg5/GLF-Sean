import { useState } from 'react'

/**
 * Whether the running reel is in the page at all.
 *
 * Off means not rendered, not merely hidden: the section is twelve video elements and
 * its own scroll timeline, and switching it off means the document is exactly as long
 * as the stage again — which is what the verification scripts assume when they scroll
 * to the bottom. `scripts/perf.mjs` loads `?reel=0` for exactly that reason.
 *
 * **There is no switch for this any more.** It used to be a toggle in the topbar next
 * to the call-out one; the reel is the page's second act rather than an overlay on the
 * first, and a control for deleting it belonged in the chrome about as much as a
 * control for deleting the shoe would. What's left is the URL parameter, which is the
 * part the scripts actually needed — so this reads `?reel=` and nothing else writes it.
 */

/** `?reel=0` / `?reel=1`. Read once: with the switch gone, nothing changes it at runtime. */
export function useReelEnabled() {
  return useState(() => {
    if (typeof window === 'undefined') return true
    const raw = new URLSearchParams(window.location.search).get('reel')
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  })[0]
}
