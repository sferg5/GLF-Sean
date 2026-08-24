import { useState } from 'react'
import { useMotionValue } from 'motion/react'
import { COLORWAYS, MODEL } from '../lib/colorways'
import { ColorwayTile } from './ColorwayTile'
import { CursorMark } from './CursorMark'
import { SwapWord } from './SwapWord'

/**
 * The range, under the x-ray.
 *
 * The stage above it answers "what is this shoe made of"; this answers "which one". The
 * shoes are cutouts for the same reason the stage's are.
 *
 * It sits on `--page` rather than on the picked wall. The strip used to follow the picker
 * with everything else, and it's the section that lost most by it: five wordmark inks and a
 * cursor mark, every one of them chosen against a known wall, all overrulable by a swatch.
 * The wall here is fixed and light, which is the one those values were solved for.
 *
 * **Hovering a tile sets the wordmark**, which is the entire mechanic: the model name
 * rests there, and each shoe replaces it with its own colourway in its own colour. The
 * name is the thing worth reading, so it's set once, large, in one place, instead of
 * five captions at thumbnail size that all have to be legible at once.
 *
 * **Clicking pins it.** A hover-only version has two holes: nothing to do on a
 * touchscreen, and no way to hold a colourway still to look at it. Pinning is also
 * what makes the tile a real button — `aria-pressed` describes something that
 * actually persists. Focus previews the same way the pointer does, so tabbing along
 * the row reads the range out and Enter holds one.
 */
export function Colorways() {
  /**
   * Pointer and focus write the same slot — hence `preview` rather than `hovered` —
   * so a mouse taking over from the keyboard, or the reverse, can't leave two
   * colourways claiming the word. Whichever moved last owns it.
   */
  const [preview, setPreview] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)

  // A preview wins over the pin, so a pinned colourway doesn't block looking at the
  // rest of the row. Letting go returns to whatever was pinned, not to the model.
  const active = preview ?? pinned

  /**
   * Straight through: the word turns over on the same event that lights the tile, both
   * on the way in and on the way out.
   *
   * There was a 110ms hold here, to stop a pointer dragged across the row firing five
   * swaps in as many frames. It was solving a problem the swap itself no longer has, and
   * all it bought after that was a tenth of a second where the tile had answered and the
   * name hadn't.
   */
  const shown = active === null ? MODEL : COLORWAYS[active]

  /**
   * Where the pointer is, and whether it's on a shoe.
   *
   * Position rides motion values rather than state: a pointer move writes a number and
   * the mark's transform follows it, where through `useState` the same move would
   * re-render five tiles and a wordmark at pointer-event rate.
   *
   * **Visibility is the shoe's, not a region's.** This used to be a padded box around
   * the strip, and the mark appeared as soon as you were near the row rather than on
   * anything — a cursor replaced over empty page. It's a tile now, which is as close to
   * the silhouette as it gets without hit-testing the matte, and the tile's own hit area
   * already reaches up over the space its shoe lifts into.
   */
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const [pointed, setPointed] = useState<number | null>(null)
  const marking = pointed !== null

  // Touch has no pointer to replace, and a mark would sit under a finger that's already
  // covering it. Mouse and pen only.
  const aim = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    px.set(e.clientX)
    py.set(e.clientY)
  }

  return (
    <section
      className="cways"
      id="colourways"
      aria-labelledby="cways-title"
      data-marking={marking}
      /* Tracked at the section rather than at each tile: a mark that only learned the
         pointer's position once it was over a shoe would arrive at wherever it had last
         been left. Writing a motion value costs no render, so the wider net is free. */
      onPointerMove={aim}
    >
      {/* Unseen, and it earns its place anyway: the section's visible text is a wordmark
          that changes on hover, which is no name for a landmark. It started out as a
          visible mono eyebrow above the strip, which is where the hovered shoe grows
          to — a label that a shoe passes through isn't a label. */}
      <h2 className="cways__title" id="cways-title">
        Pop Tempo colourways
      </h2>

      <ul className="cways__strip">
        {COLORWAYS.map((c, i) => (
          <li key={c.slug}>
            {/* Pointer and focus both preview the colourway; only the pointer raises a
                mark, and only over a shoe — hence the two slots rather than one. */}
            <ColorwayTile
              colorway={c}
              active={active === i}
              pinned={pinned === i}
              onPreview={(on) => setPreview((p) => (on ? i : p === i ? null : p))}
              onPoint={(on) => setPointed((p) => (on ? i : p === i ? null : p))}
              onPin={() => setPinned((p) => (p === i ? null : i))}
              onAim={aim}
            />
          </li>
        ))}
      </ul>

      <SwapWord className="cways__word" text={shown.name} ink={shown.ink} inkDark={shown.inkDark} />

      {/* The same colourway the word is set in — one source, so the mark under the hand
          and the name under the strip can't disagree. */}
      <CursorMark shown={marking} x={px} y={py} ink={shown.ink} inkDark={shown.inkDark} />
    </section>
  )
}
