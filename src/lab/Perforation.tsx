import { useEffect } from 'react'
import {
  type FabricSpec,
  type Field,
  HOT,
  type Stir,
  buildMembrane,
  createField,
  sample,
  step,
  windFor,
} from '../lib/perforation'

/**
 * Two channels of air, drawn — and coloured by how warm it is, not by how fast.
 *
 * The physics is `lib/perforation.ts`. This file is three pictures of the same solved field,
 * composited in one order, and the loop that drives both channels:
 *
 * - **Heat**, the temperature field as a low-resolution raster, transparent at ambient and
 *   glowing where warmth has banked up. Under everything, because it is the answer and the rest
 *   is the mechanism.
 * - **Streaklines**, particles advected through the flow into a buffer that fades rather than
 *   clears. A still frame of points is a speckle; the same points with a fourteen-frame tail are
 *   the airflow.
 * - **Glyphs**, a monospace grid sampling direction into `- \ | /`. The plotter reading of the
 *   same field, and the reason this reads as an instrument rather than a smoke machine.
 *
 * **Colour is temperature. Brightness is speed.** That split is the whole visual grammar and it is
 * worth stating plainly, because the obvious version — colour by velocity — is what this section
 * used to do and it said the wrong thing entirely. Fast air rendered hot, so the *better* fabric
 * looked like the hotter one. Now the hue of every mark is the temperature of the air it is made
 * of and its brightness is how fast that air is moving, so the open knit reads as what it is: more
 * movement, less heat.
 *
 * **Ambient is a quiet cool slate and only heat is coloured.** Not a blue-to-red thermal ramp —
 * `lab/WindTunnel.tsx` records why that was dropped once already ("a section that arrives in cyan
 * and crimson is a different brand for one screen"), and it was right. Cool here is barely a hue
 * at all, just a cold grey that sits down against the ground; everything with any saturation in it
 * is warmth. The palette stays lululemon and red still means one thing.
 */

/* Ink
   ------------------------------------------------------------------ */

/* Palettes
   ------------------------------------------------------------------ */

type Stops = [number, number, number, number][]

type Scheme = {
  /** Human name, for the note below and for anyone reading a diff. */
  label: string
  /** The chamber behind the marks. The canvas paints it and hands it to CSS as a custom property. */
  ground: string
  /** The heat raster: ambient at 0, a cell with no airflow at all at 1. */
  heat: Stops
  /** The tracers and glyphs: still air at 0, the fastest jet at 1. */
  wind: Stops
}

/**
 * Two palettes, both kept.
 *
 * Colour maps **temperature** in either one — that mapping is the section's argument and does not
 * change with the skin. What changes is which colours the scale is made of.
 *
 * `ember` is the shipped scheme: a cool slate at ambient rising through brand red to gold, built so
 * red means heat and nothing else on the page has to compete with it.
 *
 * `tide` is the one under test, drawn off the wind-map reference — deep indigo at ambient through
 * teal and green to a pale chartreuse at the top. Worth naming the tension honestly: in its source
 * that palette encodes *wind speed*, where bright means fast, and the reason `ember` exists is that
 * an earlier version of this section coloured by speed and so made the better fabric look hotter.
 * Mapped onto temperature, `tide`'s bright end reads as energetic before it reads as hot — striking
 * to look at, and a weaker carrier of the one thing the picture is trying to say.
 */
/** Ember's ramp, kept verbatim — the shipped scheme's exact values. */
const EMBER_RAMP: Stops = [
      [0.0, 104, 122, 148],
      [0.16, 126, 118, 148],
      [0.32, 158, 92, 108],
      [0.48, 186, 62, 68],
      [0.62, 216, 48, 44],
      [0.76, 238, 59, 51],
      [0.88, 243, 126, 62],
  [1.0, 248, 186, 116],
]

const SCHEMES: Record<'ember' | 'tide', Scheme> = {
  /* Ember drives both layers off one ramp, which is what it always did — temperature everywhere,
     brightness from speed. Listed twice rather than special-cased, so the two-ramp machinery has
     nothing to branch on. */
  ember: {
    label: 'ember',
    ground: '#2d2c30',
    heat: EMBER_RAMP,
    wind: EMBER_RAMP,
  },
  tide: {
    label: 'tide',
    /* Darker than the reference's own background: the marks composite additively, so the chamber
       has to sit under the scale rather than beside it. An earlier pass used the reference navy
       here and the ambient flow vanished into it — same hue, almost no luminance between them. */
    ground: '#0e1028',
    /**
     * Heat, in blues alone — deep navy where the air is at ambient, pale ice where it has banked
     * up against the skin. Two things made this the fix. Green in the microclimate read as gas
     * rather than warmth, which is a hard thing to un-see once someone says it; and with the
     * tracers now carrying speed, the raster is the only layer left telling the heat story, so it
     * wants a scale of its own rather than a slice of a shared one. Brighter means hotter because
     * the ground is dark: on a dark chamber, darker cannot mean more.
     */
    heat: [
      [0.0, 26, 38, 88],
      [0.22, 36, 58, 128],
      [0.42, 50, 90, 176],
      [0.6, 74, 130, 212],
      [0.78, 116, 172, 232],
      [1.0, 176, 214, 246],
    ],
    /**
     * Wind, light blue through teal to green — slow air is a pale blue thread, a jet through a
     * perforation is bright green. This is the reference's own mapping put back the right way
     * round: it is a wind map, bright means fast, and that is now exactly what it means here.
     */
    wind: [
      [0.0, 128, 172, 230],
      [0.4, 104, 180, 226],
      [0.66, 88, 192, 206],
      /* The freestream lands about here — still teal, so green stays the mark of accelerated air. */
      [0.82, 78, 204, 162],
      [0.92, 96, 220, 112],
      /* The jet cores. Brighter and yellower than the last pass: this is the top of the scale and
         it should look like it. */
      [1.0, 186, 246, 96],
    ],
  },
}

/**
 * Which palette is live.
 *
 * `DEFAULT_SCHEME` is the one that ships; `?scheme=ember` on the URL overrides it, so both can be
 * looked at on the same build without a rebuild between them — which is the only way to actually
 * compare two colour schemes, since nobody can hold the first one in their head while waiting for
 * the second to compile. Read once at module scope: a palette change is a rebuild of every buffer,
 * not something to hot-swap mid-frame.
 */
const DEFAULT_SCHEME: keyof typeof SCHEMES = 'tide'

const chosen = (): keyof typeof SCHEMES => {
  if (typeof window === 'undefined') return DEFAULT_SCHEME
  const raw = new URLSearchParams(window.location.search).get('scheme')
  return raw && raw in SCHEMES ? (raw as keyof typeof SCHEMES) : DEFAULT_SCHEME
}

const PALETTE = SCHEMES[chosen()]

/** One mixer, two scales. Linear between stops; clamped at both ends. */
const mixStops = (stops: Stops, t: number): [number, number, number] => {
  if (t <= 0) return [stops[0][1], stops[0][2], stops[0][3]]
  const last = stops[stops.length - 1]
  if (t >= 1) return [last[1], last[2], last[3]]
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0])
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k]
    }
  }
  return [last[1], last[2], last[3]]
}

/** Temperature → colour, for the heat raster. */
const heatRamp = (t: number) => mixStops(PALETTE.heat, t)
/** Speed → colour, for the tracers and the glyphs. */
const windRamp = (t: number) => mixStops(PALETTE.wind, t)

/**
 * Where the top of the wind *colour* scale sits, as a multiple of the freestream.
 *
 * Separate from the brightness normalisation, and that separation was the fix: brightness runs to
 * 2.3× the freestream, generous headroom that keeps a gust from blowing out — but nothing in this
 * flow goes that fast. The peak through a perforation is about 1.2× the freestream, so on a 2.3×
 * scale every jet sat mid-ramp and the green end was never reached.
 *
 * **The freestream must land mid-scale and the jets must reach the top.** At 1.2 the freestream sat
 * at 0.83, which painted the whole approach flow green and left the wake blue — true (upstream *is*
 * the fastest broad region, and a resistive membrane decelerates what passes it) but backwards to
 * read. At 1.35 green went too scarce: with a 60%-open knit the jets are faster than they were, and
 * they were still stopping short of the top of the ramp. 1.25 puts the freestream near 0.8 — still
 * teal, because the ramp's green is weighted above that — and lets a jet core actually reach the
 * bright end, which is where the eye is meant to go.
 */
const WIND_TOP = 1.25

const windOf = (speed: number, wind: number) => {
  const n = speed / Math.max(1e-4, WIND_TOP * wind)
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/**
 * Quantisation: the number of `fillStyle` changes a frame costs, not a number of colours.
 *
 * Off the **wind** ramp — a tracer's colour is how fast the air it is made of is moving. It used to
 * be its temperature, which left the streaklines and the raster saying the same thing twice and the
 * flow itself unlabelled.
 */
const BINS = 14
const INK = Array.from({ length: BINS }, (_, i) => {
  const [r, g, b] = windRamp((i + 0.5) / BINS)
  return `rgb(${r | 0},${g | 0},${b | 0})`
})

/**
 * The yarn, in the knit's own colour.
 *
 * Sampled off a macro shot of the real mesh and then pulled up and desaturated. Two constraints
 * fight here: the fabric should read as the fabric, which is a pale sage, and it must not read as
 * *data*, which on this screen is a light-blue-to-green ramp that a saturated sage sits right on
 * top of. So the hue survives and the saturation mostly doesn't — sage-tinted paper rather than
 * sage. The three tones are one material under one light: mid, the lit face, and the shadow the
 * loops cast on each other.
 */
const YARN = '203,216,210'
const YARN_HI = '243,247,244'
const YARN_MID = '158,180,173'
const YARN_LO = '92,116,111'

/**
 * The perforations, recovered exactly from the field the air meets.
 *
 * `buildMembrane` cuts a *slot* — one hole of `dia` repeating on `pitch` — and supersamples each
 * cell row into a coverage fraction, so a row on a hole's edge carries a value between 0 and 1.
 * Reading that back with a threshold would round every hole to whole cells, which is the caricature
 * the supersample exists to avoid. Read as mass instead: a run of non-zero rows has a total open
 * height of `Σcoverage` and a centre at its coverage-weighted centroid, and for a slot that is not
 * an approximation — it is the hole, to sub-cell precision.
 *
 * This is what lets the drawing sit exactly on the solve. The slots returned here are where air is
 * getting through, so the material drawn between them covers every cell the flow is being deformed
 * by and nothing it isn't.
 */
function slotsOf(field: Field, sy: number): [number, number][] {
  const out: [number, number][] = []
  let j = 0
  while (j < field.h) {
    const c0 = field.perm[field.band + j * field.w]
    if (c0 <= 0) {
      j++
      continue
    }
    let mass = 0
    let moment = 0
    let k = j
    while (k < field.h) {
      const c = field.perm[field.band + k * field.w]
      if (c <= 0) break
      mass += c
      moment += (k + 0.5) * c
      k++
    }
    const height = mass * sy
    const centre = (moment / mass) * sy
    out.push([centre - height / 2, centre + height / 2])
    j = k
  }
  return out
}

/**
 * The knit, sliced.
 *
 * **Five attempts came before this one and the fifth was wrong in a new way, which is the useful
 * one.** Four drew the membrane as an edge and failed on craft — a brick wall, a column of pills, a
 * punched sheet, a thread. The fifth gave up on the edge and drew the *face* of the mesh instead,
 * which looked like the fabric and was the wrong picture: a face is an oblique view, and this
 * channel is a section. Everything else on screen is a section — the flow, the jets, the wake — so a
 * ribbon of mesh face in the middle of it is one object in a different projection, and the jets
 * appeared to come out of the middle of the cloth rather than through it.
 *
 * So: a cut. The fabric sliced through the perforations and pressed against glass, which is exactly
 * what the section wants — the holes opened along their length, the material between them showing
 * the stratified interior of a cut, and the air visibly threading the slots you can see the walls
 * of.
 *
 * **The alignment is the requirement, not a detail.** The strip is `field.thickness` cells wide and
 * sits on `field.band`, because that is the region the solver actually blocks: any narrower and the
 * flow visibly deforms in bare space beside the cloth, any wider and it masks air that is really
 * moving. The slots come from `slotsOf`, so a hole in the picture is a hole in the solve. The
 * material is opaque, so a tracer caught inside the band is hidden by the thing that caught it.
 *
 * **What makes it read as a cut rather than a wall.** Three things, and none of them is texture for
 * its own sake. The slabs are hourglassed — each slot is flared at the two faces and pinched at
 * mid-thickness, which is the profile of a hole sliced lengthways and also, not coincidentally, the
 * throat that makes the jet. The interior is darker than the faces, because a cut face is lit and
 * the inside of a cut is not. And the material is stratified in courses with cut yarn ends catching
 * the light along them — a knit sliced is a stack of severed loops, and stratification is the one
 * cue that separates "cut through" from "cut out".
 *
 * Built once per size. The geometry cannot change between resizes, and a texture that reshuffles
 * every frame reads as noise rather than as thread.
 */
function sliceKnit(field: Field, sx: number, sy: number, chPx: number, dpr: number) {
  const T = Math.max(6, field.thickness * sx)
  /* A hair of bleed each side, so the material's own soft edge falls outside the blocked band
     rather than leaving a bright seam one pixel inside it. */
  const bleed = Math.max(1.5, sx * 0.4)
  const W = T + bleed * 2
  const x0 = bleed
  const x1 = bleed + T

  const slots = slotsOf(field, sy)
  /* The material: everything the slots are not. */
  const slabs: [number, number][] = []
  let at = 0
  for (const [a, b] of slots) {
    if (a - at > 0.2) slabs.push([at, a])
    at = b
  }
  if (chPx - at > 0.2) slabs.push([at, chPx])

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(2, Math.round(W * dpr))
  canvas.height = Math.max(2, Math.round(chPx * dpr))
  const kx = canvas.getContext('2d')
  if (!kx) return { canvas, x: 0, w: W }
  kx.setTransform(dpr, 0, 0, dpr, 0, 0)

  /**
   * The sheet is thinner than the band, and the difference is the nap.
   *
   * **Two requirements pull opposite ways here and this is the join between them.** The strip has to
   * cover `field.thickness` — four cells — because that is the region the solver blocks, and cloth
   * drawn any narrower leaves the flow visibly bending in bare space beside it. But four cells is
   * 1.2mm at this grid, and 1.2mm of solid material against a 2mm hole pitch is not fabric, it is
   * stock: the slabs come out wider than they are tall and read as a row of bricks. That is the same
   * mistake as the third attempt, which drew at the solver's thickness and looked, exactly as it was
   * described at the time, like a hole punch taken to a sheet of paper. Four cells is a numerical
   * device — a pressure difference needs somewhere to fall across — not a measurement of cloth.
   *
   * So the *sheet* is the middle 40% of the band and the rest is nap: the fibre fuzz standing off
   * both faces of a real knit, which is genuinely there, genuinely soft-edged, and happens to sit
   * exactly where the flow is being deformed. The cut reads as a thin sheet with slots taller than it
   * is thick, and nothing in the blocked band is left bare.
   */
  const skin = T * 0.3
  const s0 = x0 + skin
  const s1 = x1 - skin
  const D = s1 - s0

  /* Across the cut: both faces lit, the interior not. The outside face takes the stronger rim — the
     light in this chamber comes from the side the air arrives on, which is the left. */
  const body = kx.createLinearGradient(s0, 0, s1, 0)
  body.addColorStop(0, `rgba(${YARN},0.94)`)
  body.addColorStop(0.16, `rgba(${YARN_MID},1)`)
  body.addColorStop(0.5, `rgba(${YARN_LO},1)`)
  body.addColorStop(0.86, `rgba(${YARN_MID},1)`)
  body.addColorStop(1, `rgba(${YARN},0.9)`)

  /* The bevel on a slot's mouth. A fabric perforation has no machined edge — the yarn rolls into the
     hole — so the mouth is a soft turn rather than a corner. */
  const bevel = Math.min(1.8, D * 0.3)

  /* The course pitch — the vertical rhythm of the stitch. Deliberately coarser than the cell: at
     half a cell each loop was two pixels of nothing, and stitching you cannot resolve is just
     noise. Deterministic, because a slice does not shimmer. */
  const course = Math.max(3.2, sy * 0.95)

  /**
   * The fibre that crosses the holes.
   *
   * **This is what stops the slabs reading as bricks.** A slice through a perforated knit really does
   * leave short bridges of material between the holes, and at this gauge those bridges are about
   * twice as tall as the sheet is thick — so they are chunky, and no amount of shading makes a chunky
   * isolated rectangle look like cloth. What makes it cloth is that the yarn does not stop at the
   * hole: a cut leaves loose fibre spanning it, which is visible in any macro shot of a mesh and is
   * the one mark that ties the bridges into a single sheet. Drawn under the slabs, so each strand
   * disappears into the material at both ends rather than being pinned on top of it.
   */
  kx.lineCap = 'round'
  for (let si = 0; si < slots.length; si++) {
    const [a, b] = slots[si]
    const strands = 1 + (si % 2)
    for (let m = 0; m < strands; m++) {
      const u = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(si * 2.1 + m * 3.3))
      const x = s0 + u * D
      const sag = (b - a) * 0.12 * Math.sin(si * 1.4 + m)
      kx.strokeStyle = `rgba(${YARN},${(0.16 + 0.12 * Math.abs(Math.sin(si * 1.9 + m))).toFixed(3)})`
      kx.lineWidth = Math.max(0.5, D * 0.09)
      kx.beginPath()
      kx.moveTo(x, a - course * 0.4)
      kx.quadraticCurveTo(x + sag, (a + b) / 2, x, b + course * 0.4)
      kx.stroke()
    }
  }

  for (const [a, b] of slabs) {
    const r = Math.min(bevel, (b - a) * 0.34)
    /**
     * The slab, with straight faces.
     *
     * **This is the correction to the first cut.** That one hourglassed the silhouette — pinched
     * each slab at the faces to flare the mouth — and every slab came out a floating pill. The faces
     * are what make a slice a slice: they are one plane, held against glass, and a silhouette that
     * pulls away from that plane at every hole dissolves the plane into objects. So the sides run
     * dead straight and the mouth is bevelled with light instead of with geometry.
     */
    const path = new Path2D()
    /* The top and bottom edges carry a small deterministic waver — a cut edge of knit is eaten by
       yarn, and a dead-straight one is the last thing making these read as machined parts. The two
       faces stay straight, because the faces are the plane. */
    const bite = Math.min(course * 0.5, (b - a) * 0.16)
    const wa = bite * Math.sin(a * 0.9)
    const wb = bite * Math.sin(b * 1.3)
    path.moveTo(s0, a + r)
    path.quadraticCurveTo(s0, a + wa, s0 + r, a + wa)
    path.quadraticCurveTo(s0 + D / 2, a - wa * 0.8, s1 - r, a + wa)
    path.quadraticCurveTo(s1, a + wa, s1, a + r)
    path.lineTo(s1, b - r)
    path.quadraticCurveTo(s1, b - wb, s1 - r, b - wb)
    path.quadraticCurveTo(s0 + D / 2, b + wb * 0.8, s0 + r, b - wb)
    path.quadraticCurveTo(s0, b - wb, s0, b - r)
    path.closePath()

    /**
     * The nap, as a halo off the sheet's own silhouette.
     *
     * **The version before this drew it as a gradient-filled rectangle across the band with a comb of
     * whiskers standing off each face, and it read as exactly that: a grey box with a comb on it.**
     * Fibre has no rectangle in it anywhere. Concentric strokes of the slab's own path instead —
     * widening, fading — which puts the fuzz on every edge at once, including the top and bottom,
     * so a little fibre hangs into each hole the way it does in cut cloth. Four passes rather than a
     * canvas blur: `ctx.filter` is not on every iPad this will run on, and a filter that silently
     * does nothing would leave a hard slab twice the width it should be.
     *
     * It also has a job. The solver blocks four cells and the sheet is drawn across less than half of
     * them, so without something in the margin the tracers would visibly stop short in bare space —
     * the artefact this whole strip exists to cover. The halo is what they stop in, and stopping in
     * fibre is what stopping at cloth looks like.
     */
    for (const [reach, alpha] of [
      [skin * 2.1, 0.1],
      [skin * 1.5, 0.14],
      [skin * 1.0, 0.2],
      [skin * 0.5, 0.26],
    ] as const) {
      kx.strokeStyle = `rgba(${YARN_MID},${alpha})`
      kx.lineWidth = reach
      kx.stroke(path)
    }

    kx.save()
    kx.clip(path)

    kx.fillStyle = body
    kx.fillRect(s0 - 1, a - 1, D + 2, b - a + 2)

    /* The shadow between one course and the next. It used to be the whole texture; now it is only
       the seating the loops sit in, so it gives most of its weight back to them. */
    kx.lineWidth = Math.max(0.45, course * 0.12)
    kx.strokeStyle = 'rgba(36,50,47,0.38)'
    kx.beginPath()
    for (let y = a + course; y < b - course * 0.4; y += course) {
      /* Bowed, not ruled: a course of knit is a row of loops and sags between them. */
      kx.moveTo(s0, y)
      kx.quadraticCurveTo(s0 + D / 2, y + course * 0.18, s1, y)
    }
    kx.stroke()

    /**
     * The stitch, cut through.
     *
     * **What a slice of knit actually shows is not fibre, it is loops.** The version before this put
     * one lit ellipse per course down the middle of the cut, which gave the material grain but no
     * structure — it read as a fibrous solid rather than as something knitted. A knit is one yarn
     * travelling front-to-back-to-front, so a section through it cuts each loop twice: two yarn ends
     * per course, one near each face, and *which* of the two is forward alternates course by course
     * because that is what interlocking means.
     *
     * So: two ends per course, offset either side of the centreline, swapping sides each course,
     * with the far one smaller and dimmer because it is deeper in the cut. A thin arc links them —
     * the crown of the loop crossing the thickness — and a second arc carries down to the next
     * course's opposite leg, which is the yarn continuing. Drawn together they zigzag down the cut,
     * and that zigzag is the thing the eye reads as stitching.
     */
    const rx = Math.max(0.75, D * 0.15)
    const ry = Math.max(0.7, course * 0.24)
    const lean = D * 0.21
    const legX = (k: number) => s0 + D / 2 + (k % 2 === 0 ? -1 : 1) * lean

    let i = Math.round(a / course)
    /* The yarn's path first, under the ends it connects — a loop crown crossing the thickness, then
       the carry down to the next course on the other side. */
    kx.lineCap = 'round'
    kx.lineWidth = Math.max(0.5, rx * 0.7)
    kx.strokeStyle = `rgba(${YARN_HI},0.16)`
    kx.beginPath()
    {
      let k = i
      for (let y = a + course * 0.5; y < b; y += course) {
        k++
        const near = legX(k)
        const far = s0 + D - (near - s0)
        kx.moveTo(far, y)
        kx.quadraticCurveTo(s0 + D / 2, y - ry * 0.9, near, y)
        if (y + course < b) {
          kx.moveTo(near, y)
          kx.quadraticCurveTo(near, y + course * 0.5, legX(k + 1), y + course)
        }
      }
    }
    kx.stroke()

    for (let y = a + course * 0.5; y < b; y += course) {
      i++
      const near = legX(i)
      const far = s0 + D - (near - s0)

      /* The far leg: deeper in the cut, so smaller and barely lit. */
      kx.fillStyle = `rgba(${YARN_HI},0.13)`
      kx.beginPath()
      kx.ellipse(far, y, rx * 0.72, ry * 0.78, 0, 0, 6.284)
      kx.fill()

      /* The near leg: a round yarn end, lit from the upstream side and shadowed opposite, which is
         the whole difference between a blob and something with a section. */
      kx.fillStyle = 'rgba(28,40,37,0.52)'
      kx.beginPath()
      kx.ellipse(near + rx * 0.22, y + ry * 0.22, rx, ry, 0, 0, 6.284)
      kx.fill()
      const lit = 0.3 + 0.14 * Math.abs(Math.sin(i * 0.9))
      kx.fillStyle = `rgba(${YARN_HI},${lit.toFixed(3)})`
      kx.beginPath()
      kx.ellipse(near, y, rx, ry, 0, 0, 6.284)
      kx.fill()
      kx.fillStyle = `rgba(255,255,255,${(lit * 0.7).toFixed(3)})`
      kx.beginPath()
      kx.ellipse(near - rx * 0.28, y - ry * 0.26, rx * 0.42, ry * 0.4, 0, 0, 6.284)
      kx.fill()
    }

    /* The mouths, in light rather than in silhouette: the yarn rolling into the hole turns away from
       the viewer, so the last sliver of material before a slot goes dark. */
    const mouth = (edge: number, dir: number) => {
      const depth = Math.min(bevel * 2.2, (b - a) * 0.4)
      const shade = kx.createLinearGradient(0, edge, 0, edge + dir * depth)
      shade.addColorStop(0, 'rgba(24,34,32,0.55)')
      shade.addColorStop(1, 'rgba(24,34,32,0)')
      kx.fillStyle = shade
      kx.fillRect(s0 - 1, Math.min(edge, edge + dir * depth), D + 2, depth)
    }
    mouth(a, 1)
    mouth(b, -1)
    kx.restore()

    /* The two cut faces, where the material meets the glass. Straight, and drawn per slab but
       collinear across all of them — that alignment is the plane, and the plane is what says this is
       a section through something rather than a row of parts. */
    kx.lineWidth = Math.max(0.6, D * 0.09)
    kx.strokeStyle = `rgba(${YARN_HI},0.26)`
    kx.beginPath()
    kx.moveTo(s0 + 0.3, a + r * 0.5)
    kx.lineTo(s0 + 0.3, b - r * 0.5)
    kx.stroke()
    kx.strokeStyle = `rgba(${YARN_HI},0.12)`
    kx.beginPath()
    kx.moveTo(s1 - 0.3, a + r * 0.5)
    kx.lineTo(s1 - 0.3, b - r * 0.5)
    kx.stroke()
  }

  /* The glass. Two hairlines at the plane of each face, running the full height — across the slots
     too, which is the whole point: the specimen is pressed against something, and the something is
     what makes this a section rather than a floating piece of cloth. Faint enough that the air
     coming through a slot is not veiled by it.
     ------------------------------------------------------------------ */
  kx.strokeStyle = 'rgba(255,255,255,0.1)'
  kx.lineWidth = 1
  kx.beginPath()
  kx.moveTo(x0 + skin * 0.5, 0)
  kx.lineTo(x0 + skin * 0.5, chPx)
  kx.moveTo(x1 - skin * 0.5, 0)
  kx.lineTo(x1 - skin * 0.5, chPx)
  kx.stroke()

  return { canvas, x: field.band * sx - bleed, w: W }
}

/**
 * Exposure, and the one place a display decision is allowed to shape the picture.
 *
 * **Never against a channel's own maximum.** Auto-exposing per channel would normalise away the
 * entire comparison: the open knit's warmest air would render as hot as the closed knit's, because
 * it would be the warmest thing in its own frame. Both channels are measured against the same
 * fixed scale, so cooler genuinely looks cooler.
 *
 * `HOT` is the stagnant ceiling — what a cell with no airflow at all settles at — and nothing ever
 * reaches it. Settled headlessly at the reference pace, today's microclimate *means* sit at 0.35 of
 * it and the new one's at 0.21, but the cells hard against the skin run well above their own mean,
 * so exposing on the means alone clipped every one of them to white. At 0.62 of the ceiling the two
 * means land at 0.46 and 0.24 of the ramp and the hot cells reach ember without going to paper.
 *
 * The curve is a transfer function, not a thumb on the scale: monotonic, identical for both
 * channels, and it changes neither the ordering nor the ratio between them. It spends more of the
 * ramp on the range the two fabrics actually occupy, which is what a thermal image does. The °C
 * printed under the picture are the solver's own and are not curved at all.
 */
const EXPOSE = HOT * 0.92
const CONTRAST = 1.5

const tempOf = (t: number) => {
  const n = t / EXPOSE
  const c = n < 0 ? 0 : n > 1 ? 1 : n
  return Math.pow(c, CONTRAST)
}

const GLYPHS = ['-', '\\', '|', '/'] as const
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/* Particles
   ------------------------------------------------------------------ */

const COUNT = 4200

type Swarm = { x: Float32Array; y: Float32Array; life: Float32Array }

const makeSwarm = (f: Field): Swarm => {
  const s: Swarm = {
    x: new Float32Array(COUNT),
    y: new Float32Array(COUNT),
    life: new Float32Array(COUNT),
  }
  for (let i = 0; i < COUNT; i++) {
    s.x[i] = Math.random() * f.w
    s.y[i] = Math.random() * f.h
    s.life[i] = Math.random() * 160
  }
  return s
}

/**
 * Advance the swarm.
 *
 * Most respawns go to the inlet, a fifth go anywhere. The fifth keeps the recirculation behind a
 * closed knit from reading as a rendering hole: nothing reaches it from upstream, which is true
 * and is the point, and an entirely empty region reads as a bug rather than as stagnant air.
 */
function move(f: Field, s: Swarm, live: number): void {
  for (let i = 0; i < live; i++) {
    const px = s.x[i]
    const py = s.y[i]
    const uu = sample(f, f.u, px, py)
    const vv = sample(f, f.v, px, py)
    let x = px + uu
    let y = py + vv
    s.life[i] += 1

    if (x < 0 || x >= f.w - 1 || y < 0.5 || y >= f.h - 1.5 || s.life[i] > 240) {
      const anywhere = Math.random() < 0.18
      s.x[i] = anywhere ? Math.random() * f.w : Math.random() * 3
      s.y[i] = Math.random() * f.h
      s.life[i] = 0
      continue
    }
    if (f.solid[(x | 0) + (y | 0) * f.w]) {
      x -= uu * 1.4
      y -= vv * 1.4 + (Math.random() - 0.5) * 0.7
    }
    s.x[i] = x
    s.y[i] = y
  }
}

/* Options
   ------------------------------------------------------------------ */

export type Layers = { particles: boolean; glyphs: boolean; heat: boolean }

export type ChannelRefs = {
  flow: React.RefObject<HTMLCanvasElement | null>
  glyph: React.RefObject<HTMLCanvasElement | null>
  spec: FabricSpec
}

type Options = {
  channels: readonly ChannelRefs[]
  /** Live, so a parent re-render never restarts a running field. */
  pace: React.RefObject<number>
  layers: React.RefObject<Layers>
  showing: boolean
  reduced: boolean
}

/** Everything one channel needs, built once per layout. */
type Runtime = {
  spec: FabricSpec
  field: Field
  swarm: Swarm
  host: HTMLElement
  fc: HTMLCanvasElement
  fx: CanvasRenderingContext2D
  gc: HTMLCanvasElement
  gx: CanvasRenderingContext2D
  trail: HTMLCanvasElement
  tx: CanvasRenderingContext2D
  /** Built whether or not the heat layer is on — see the note in `composite`. */
  heat: HTMLCanvasElement
  hx: CanvasRenderingContext2D
  raster: ImageData
  /** The knit, sliced once at this size by `sliceKnit`, and blitted every frame. */
  knit: HTMLCanvasElement
  /** Where the slice's left edge goes, in CSS px — it sits on `field.band`, not centred on it. */
  knitX: number
  /** The slice's width in CSS px, so the blit is 1:1 and the alignment survives the resample. */
  knitW: number
  cw: number
  ch: number
  density: number
  stir: { on: boolean; x: number; y: number; px: number; py: number }
  detach: () => void
}

/**
 * The loop, driving both channels.
 *
 * One `requestAnimationFrame` for the pair rather than one each — two independent loops drift apart
 * under load, and two channels of a controlled experiment stepping at different rates is not a
 * controlled experiment. Both fields take the same wind and the same deterministic inflow
 * perturbation, so the only difference between them is the knit.
 */
export function usePerforation({ channels, pace, layers, showing, reduced }: Options): void {
  useEffect(() => {
    const runtimes: Runtime[] = []

    /* Two raster scales. The flow buffers are fill-rate bound and look no worse at 1.5×; the glyph
       layer is text and wants the full ratio, or the marks blur into dashes. */
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const dprFlow = Math.min(1.5, dpr)

    let cellPx = 12
    let frameMs = 16
    let quality = 1
    let glyphEvery = 2
    let live = COUNT

    const build = (): boolean => {
      for (const ch of channels) {
        const fc = ch.flow.current
        const gc = ch.glyph.current
        if (!fc || !gc) return false
        const fx = fc.getContext('2d')
        const gx = gc.getContext('2d')
        const host = fc.parentElement
        if (!fx || !gx || !host) return false

        const trail = document.createElement('canvas')
        const tx = trail.getContext('2d')
        const heat = document.createElement('canvas')
        const hx = heat.getContext('2d')
        if (!tx || !hx) return false

        const cw = Math.max(240, host.clientWidth)
        const cheight = Math.max(90, host.clientHeight)
        cellPx = cw < 700 ? 10 : 12

        gc.width = Math.round(cw * dpr)
        gc.height = Math.round(cheight * dpr)
        for (const c of [fc, trail]) {
          c.width = Math.round(cw * dprFlow)
          c.height = Math.round(cheight * dprFlow)
        }

        const field = createField(cw / cheight)
        buildMembrane(field, ch.spec)
        field.wind = windFor(pace.current)
        heat.width = field.w
        heat.height = field.h

        host.style.setProperty('--tunnel-ground', PALETTE.ground)

        const stir = { on: false, x: 0, y: 0, px: 0, py: 0 }

        const at = (e: PointerEvent): [number, number] => {
          const box = host.getBoundingClientRect()
          return [
            ((e.clientX - box.left) / box.width) * field.w,
            ((e.clientY - box.top) / box.height) * field.h,
          ]
        }
        const down = (e: PointerEvent) => {
          const [x, y] = at(e)
          stir.on = true
          stir.x = x
          stir.y = y
          stir.px = x
          stir.py = y
          host.dataset.stirred = 'true'
        }
        const moved = (e: PointerEvent) => {
          if (!stir.on) return
          const [x, y] = at(e)
          stir.x = x
          stir.y = y
        }
        const up = () => {
          stir.on = false
        }

        host.addEventListener('pointerdown', down)
        window.addEventListener('pointermove', moved)
        window.addEventListener('pointerup', up)
        window.addEventListener('pointercancel', up)

        fx.setTransform(1, 0, 0, 1, 0, 0)
        fx.fillStyle = PALETTE.ground
        fx.fillRect(0, 0, fc.width, fc.height)

        /* Sliced here rather than in the loop: the geometry only changes when the box does, and
           this is the one place that knows both the field and the size. */
        const cut = sliceKnit(field, cw / field.w, cheight / field.h, cheight, dpr)

        runtimes.push({
          spec: ch.spec,
          field,
          swarm: makeSwarm(field),
          host,
          fc,
          fx,
          gc,
          gx,
          trail,
          tx,
          heat,
          hx,
          raster: hx.createImageData(field.w, field.h),
          knit: cut.canvas,
          knitX: cut.x,
          knitW: cut.w,
          cw,
          ch: cheight,
          /**
           * Particles per unit area, not per channel. A fixed population in a narrow channel is the
           * same number of marks in a fraction of the pixels, which over-accumulates in the trail
           * and washes the field out. Scaled against the box the constants were tuned in.
           */
          density: Math.max(0.32, Math.min(1.15, (cw * cheight) / (1400 * 300))),
          stir,
          detach: () => {
            host.removeEventListener('pointerdown', down)
            window.removeEventListener('pointermove', moved)
            window.removeEventListener('pointerup', up)
            window.removeEventListener('pointercancel', up)
          },
        })
      }
      return true
    }

    const teardown = () => {
      for (const r of runtimes) r.detach()
      runtimes.length = 0
    }

    if (!build()) {
      teardown()
      return
    }

    /* Drawing
       ---------------------------------------------------------------- */

    const drawHeat = (r: Runtime) => {
      const d = r.raster.data
      const { field } = r
      for (let i = 0; i < field.temp.length; i++) {
        const t = tempOf(field.temp[i])
        const [cr, cg, cb] = heatRamp(t)
        const o = i * 4
        d[o] = cr | 0
        d[o + 1] = cg | 0
        d[o + 2] = cb | 0
        d[o + 3] = field.solid[i] ? 0 : (Math.min(1, 0.13 + Math.pow(t, 1.15) * 1.1) * 228) | 0
      }
      r.hx.putImageData(r.raster, 0, 0)
    }

    /**
     * The slice, blitted.
     *
     * All the drawing is in `sliceKnit`, which runs once per size. What's left is the placement, and
     * the placement is the whole contract: the strip goes on `field.band` at `field.thickness` wide,
     * which is exactly the region the solver blocks. Blitted at its natural size rather than
     * stretched to a rectangle — a resample here would smear the alignment the slice was built for.
     *
     * `source-over`, deliberately, in a file that composites the flow additively. The specimen is
     * the one opaque object on screen; adding it to the field behind it would make it glow.
     */
    const drawMembrane = (r: Runtime) => {
      const { gx } = r
      gx.globalCompositeOperation = 'source-over'
      gx.globalAlpha = 1
      gx.drawImage(r.knit, r.knitX, 0, r.knitW, r.ch)
    }

    const drawGlyphs = (r: Runtime) => {
      const { field, gx } = r
      const cols = Math.ceil(r.cw / cellPx)
      const rows = Math.ceil(r.ch / cellPx)
      const base = layers.current.particles ? 0.36 : 1

      gx.font = `${cellPx - 1}px ${MONO}`
      gx.textBaseline = 'middle'
      gx.textAlign = 'center'
      gx.globalCompositeOperation = 'lighter'

      const B = 8
      const bins: number[][][] = Array.from({ length: B }, () => [[], [], [], [], []])
      const lo = 0.06 * field.wind
      const hi = 2.3 * field.wind

      for (let rr = 0; rr < rows; rr++) {
        const cy = rr * cellPx + cellPx / 2
        const gy = (cy / r.ch) * field.h
        for (let c = 0; c < cols; c++) {
          const cx = c * cellPx + cellPx / 2
          const gxv = (cx / r.cw) * field.w
          const gi = gxv | 0
          const gj = gy | 0
          if (gi < 0 || gi >= field.w || gj < 0 || gj >= field.h) continue
          if (field.solid[gi + gj * field.w]) continue
          const uu = sample(field, field.u, gxv, gy)
          const vv = sample(field, field.v, gxv, gy)
          const raw = Math.hypot(uu, vv)
          let sp = (raw - lo) / Math.max(1e-4, hi - lo)
          sp = sp < 0 ? 0 : sp > 1 ? 1 : sp
          if (sp < 0.03) continue
          let g = 4
          if (sp >= 0.07) {
            const q = Math.round(Math.atan2(vv, uu) / (Math.PI / 4))
            g = ((q % 4) + 4) % 4
          }
          const bi = Math.min(B - 1, (windOf(raw, field.wind) * (B - 1)) | 0)
          bins[bi][g].push(cx, cy, sp)
        }
      }

      for (let b = 0; b < B; b++) {
        const [cr, cg, cb] = windRamp((b + 0.5) / B)
        gx.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`
        for (let gi = 0; gi < 5; gi++) {
          const list = bins[b][gi]
          if (!list.length) continue
          const chr = gi === 4 ? '.' : GLYPHS[gi]
          for (let i = 0; i < list.length; i += 3) {
            gx.globalAlpha = base * (0.2 + 0.8 * list[i + 2])
            gx.fillText(chr, list[i], list[i + 1])
          }
        }
      }
      gx.globalAlpha = 1
    }

    const updateTrail = (r: Runtime) => {
      const { field } = r
      const sx = r.cw / field.w
      const sy = r.ch / field.h
      const lo = 0.06 * field.wind
      const hi = 2.3 * field.wind
      const span = Math.max(1e-4, hi - lo)

      r.tx.setTransform(1, 0, 0, 1, 0, 0)
      r.tx.globalCompositeOperation = 'destination-out'
      r.tx.fillStyle = 'rgba(0,0,0,0.045)'
      r.tx.fillRect(0, 0, r.trail.width, r.trail.height)
      r.tx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)
      r.tx.globalCompositeOperation = 'lighter'

      /* Bucketed by speed, which is both the colour axis and the brightness axis: a slow thread is
         a dim pale blue, a jet is a bright green. One bucket is one `fillStyle`; alpha varies
         inside it, so a bucket is a shade rather than a flat band. */
      const buckets: number[][] = Array.from({ length: BINS }, () => [])
      const n = Math.round(live * r.density)
      for (let i = 0; i < n; i++) {
        const x = r.swarm.x[i]
        const y = r.swarm.y[i]
        const raw = sample(field, field.spd, x, y)
        let sp = (raw - lo) / span
        sp = sp < 0 ? 0 : sp > 1 ? 1 : sp
        const bi = Math.min(BINS - 1, (windOf(raw, field.wind) * (BINS - 1)) | 0)
        buckets[bi].push(x * sx, y * sy, sp)
      }
      for (let b = 0; b < BINS; b++) {
        const list = buckets[b]
        if (!list.length) continue
        r.tx.fillStyle = INK[b]
        const size = b > BINS * 0.62 ? 1.6 : 1.25
        for (let i = 0; i < list.length; i += 3) {
          r.tx.globalAlpha = 0.3 + 0.7 * Math.pow(list[i + 2], 0.8)
          r.tx.fillRect(list[i], list[i + 1], size, size)
        }
      }
      r.tx.globalAlpha = 1
    }

    const composite = (r: Runtime) => {
      const { field, fx, gx, fc } = r
      const L = layers.current

      if (L.particles) updateTrail(r)

      fx.setTransform(1, 0, 0, 1, 0, 0)
      fx.globalCompositeOperation = 'source-over'
      fx.globalAlpha = 1
      fx.fillStyle = PALETTE.ground
      fx.fillRect(0, 0, fc.width, fc.height)
      fx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)

      /**
       * The heat raster, off for now.
       *
       * `layers.heat` is `false` in the section, so this branch never runs — but the raster, its
       * buffer and its ramp are all still here and still built. Turning it back on is one boolean
       * in `components/Perforation.tsx`, which is the point: the temperature field is still solved
       * every frame, so the layer has real data waiting for it rather than a cold start.
       */
      if (L.heat) {
        drawHeat(r)
        fx.imageSmoothingEnabled = L.particles
        fx.globalAlpha = L.particles ? 0.55 : 0.94
        fx.drawImage(r.heat, 0, 0, r.cw, r.ch)
        fx.globalAlpha = 1
      }
      if (L.particles) {
        fx.globalCompositeOperation = 'lighter'
        fx.setTransform(1, 0, 0, 1, 0, 0)
        fx.drawImage(r.trail, 0, 0)
        fx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)
        fx.globalCompositeOperation = 'source-over'
      }

      /* The glyph layer keeps its own canvas and is not cleared on the frames it skips, which is
         what makes running it at half rate free rather than flickery. */
      if (!L.glyphs || field.tick % glyphEvery === 0) {
        gx.setTransform(dpr, 0, 0, dpr, 0, 0)
        gx.clearRect(0, 0, r.cw, r.ch)
        drawMembrane(r)
        if (L.glyphs) drawGlyphs(r)
      }
    }

    const advance = () => {
      const wind = windFor(pace.current)
      for (const r of runtimes) {
        r.field.wind = wind
        const s = r.stir
        const push: Stir = s.on
          ? { x: s.x, y: s.y, dx: (s.x - s.px) * 0.9, dy: (s.y - s.py) * 0.9 }
          : null
        if (push) {
          s.px = s.x
          s.py = s.y
        }
        step(r.field, push)
        move(r.field, r.swarm, Math.round(live * r.density))
      }
    }

    let resizeTimer = 0
    let relayout = false
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        relayout = true
      }, 140)
    }
    window.addEventListener('resize', onResize)

    /* The loop
       ---------------------------------------------------------------- */

    let frame = 0
    let last = performance.now()
    let qualityAt = last

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)

      if (relayout) {
        relayout = false
        teardown()
        if (!build()) return
      }

      const delta = now - last
      last = now
      if (delta > 0 && delta < 400) frameMs += (delta - frameMs) * 0.12

      /**
       * The governor. Two fields solve and two composite every frame, at half a screen each — the
       * heaviest this section has been — so it sheds glyph cadence first, then particle population.
       */
      if (now - qualityAt > 900) {
        qualityAt = now
        if (frameMs > 32 && quality > 0.5) quality -= 0.1
        else if (frameMs < 20 && quality < 1) quality += 0.06
        quality = Math.min(1, quality)
        live = Math.round(COUNT * (0.45 + 0.55 * quality))
        glyphEvery = frameMs > 40 ? 4 : frameMs > 26 ? 3 : 2
      }

      advance()
      for (const r of runtimes) composite(r)
    }

    if (reduced || !showing) {
      for (let i = 0; i < 260; i++) advance()
      for (const r of runtimes) composite(r)
    } else {
      /* A formed flow before the first live frame, so nobody watches an empty chamber fill. */
      for (let i = 0; i < 120; i++) advance()
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      teardown()
    }
    /* `pace` and `layers` are refs by design — they must not restart the fields. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, reduced, channels, pace, layers])
}
