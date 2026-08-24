# Shoe X-Ray

Three pages behind a real nav — see [the pages](#the-pages), and
[the wind tunnels](#the-wind-tunnels) for the airflow comparison that closes the second one. This
is the first page, and the one everything below describes unless it says otherwise: **six
sections, in one scroll, [in whatever order you drag them into](#the-order-is-data)**.

**The x-ray** is the top of the page: a scroll-driven transition between a shoe and its
cross-section. Scrolling doesn't only cut the shoe open — it changes what kind of picture you're
looking at, from a product photograph on a wall you pick the colour of to an annotated engineering
plate.

**[The running reel](#the-running-reel)** takes over past the end of it: six columns of running
footage rising past one line of type, one at a time, each at its own speed and with its own inertia,
in a black room that empties, inverts, and then slides out of the window with the type still in it.
**Reel** in the top bar switches it off, which shortens the page rather than emptying it.

**[The prose](#the-two-sections-with-nothing-to-look-at)** is the pause: a statement at display
size and a paragraph under it, and no picture at all.

**[The colourway strip](#the-colourway-strip)** is the range: five colourways, and one wordmark that
says whichever one you're pointing at.

**[The film](#the-film)** is the closing look: six seconds of footage that arrives filling the window
and plays itself, while scroll closes a rounded frame around it down to 80% and opens it again on the
way back.

**[The FAQ](#the-two-sections-with-nothing-to-look-at)** is last, in the prose section's voice, with
the answers folded away until they're asked for.

```
npm install
npm run dev
```

Two variants, from the switcher in the top right or the keys `1` and `2`.

| | | | |
| --- | --- | --- | --- |
| **1** | **X-ray** | `XRayDissolve` | the cut on its own, with two switchable call-outs |
| 2 | Sketch | `SectionPlate` | the full treatment — blueprint, measurement frame, point cloud, callouts |

The switcher labels are short on purpose; the component names are where the longer description
lives, and the two are allowed to differ.

The dissolve is kept registered deliberately. It's the control: switching to the plate answers
"is the technical treatment carrying this, or is the cut?" without a rebuild.

The registry's order does three jobs at once — it's the switcher's order, index 0 is what the
page loads with, and `?v=` is a 1-based index into it. No separate default flag to fall out of
sync, but reordering does change the landing experience and invalidate any `?v=` link shared
before the change.

The switcher reads its labels straight off the registry, so adding a variant lists it. The choice
is written back to `?v=`, which was already read on load, so it survives a reload and can be sent
to someone. Switching returns to the top: the two pin over different scroll distances, so the
same pixel means a different frame and there's no position worth preserving.

## The x-ray's call-outs

Two call-outs that change what they're pointing at. **Call-outs** in the top bar switches them,
`c` toggles from anywhere, and `?c=0` / `?c=1` pins it.

At `p = 0` they name the outside; each is then replaced by one naming what the cut exposed
underneath it. Engineered knit upper → suede eyestay, midsole sidewall → expanded bead core.

**The labels follow the positions, not the other way round.** Each one is written after looking at a
magnified crop of what its dot actually lands on, because the label is the one part of a call-out
that can be confidently wrong — a leader pointing at the wrong material renders exactly as
convincingly as one pointing at the right material, and nothing in the build will complain. Move a
dot in the editor and its name is now a claim you haven't checked.

**The two phases are deliberately not connected**, and that's a correction. The first version
morphed each mark onto its new target: one leader swinging across the frame with its label
cross-fading en route. It was smooth, and the smoothness was the bug — continuity implies identity,
so it read as *the knit becoming the lining* when those are simply different parts of the shoe that
happen to share an annotation slot. So each phase now has its own arrival and its own exit.

**Arriving**, a mark pivots onto its bearing from beyond it and draws out from its own anchor: line,
then the ring landing on the feature, then the name. The order a hand would do it in.

**Leaving is two beats, and not the arrival reversed.** The ring lets go of the feature, then the
line retracts *out of the target and back into the shelf* — which the geometry gives for free, since
the rule's transform origin is the anchor, so shrinking it withdraws the far end towards the text
rather than sliding the whole line. Only once it has arrived there does the name go. The two beats
don't overlap: the line is fully home at `a = 0.44` and the text doesn't start leaving until `0.36`.
That gap is the point — withdrawing a leader into its label and then removing the label reads as one
gesture with two beats, where doing both at once just reads as a fade.

`easeOutQuad` serves both directions without knowing which one it's in: it's fast-then-slow in its
input, so against a rising ramp it eases out and against a falling one it eases in. It's monotonic
either way, so the part ordering above survives whichever direction the mark is moving.

A departure doesn't swing. The leader is retracting *into* its own label, and pivoting while it does
that turns a withdrawal into a wobble.

**Between the two there's a stretch with no annotation at all.** Not a gap left to be closed — it's
the cut getting the frame to itself, and it's most of what stops the phases reading as one thing
being dragged around.

**Each mark's timing is derived from where its feature sits along the cut.** The front travels
toe → heel, so marks have different deadlines: the knit at x = 41 is dissolved at `p = 0.43` and the
lining that replaces it isn't exposed until `0.58`. So a mark withdraws `LEAD` before the front
dissolves what it's naming and arrives `LAG` after the front has finished exposing the replacement —
nothing is ever named before the cut has made it, and moving a target in the editor keeps that true
with no constant to re-tune. It's the same principle as the section plate's leader lines, run in both
directions.

**A pair that runs against the cut gets squeezed**, and the second one currently does: it withdraws
at the heel (x = 75) and arrives at the forefoot (x = 24). The front doesn't reach the heel until
`p = 0.69`, while the forefoot was exposed back at `0.30` — so the arrival has nowhere to go but the
tail of the reveal, and `windowsFor` clamps it to `0.75`, which is *0.02 inside* the departure's own
window. The two beats overlap slightly instead of clearing each other, and a piece of bead foam sits
visible and unnamed from `0.30` to `0.75`. Nothing breaks — the clamps hold and both end states are
still exact — but forefoot → heel is the direction this timing model is shaped for, and pairs that
run the other way are trading the clean separation for whatever the placement is worth.

**Two, not four.** These sit on a photograph with no measurement frame to hang off, so the only
quiet space is the band above the toe and the band under the sole — one shelf each. A third would
have to go on the shoe.

**The ink flips with the background.** Unlike the plate's leader lines, which are always drawn on
a blueprint the stylesheet controls, these sit on whatever the picker is set to: a light hairline
disappears on Paper and a dark one disappears on Ember, so neither can be the single answer.
`[data-bg-light]` — already published by the background picker — switches both the ink and the
halo that carries a 1px rule across the white foam.

Positions are percentages of the stage, applied by translating a box the size of the stage: a
percentage in `translate` resolves against the element's own border box, so `inset: 0` plus
`translate(41%, 48%)` lands on 41% / 48% of the stage with nothing measured and no `left`/`top` to
animate. Rotation and length live on separate elements, because CSS applies a scale in the
parent's axes and would fatten the line sideways instead of extending it along its bearing. The
rule is a full stage width scaled *down* onto the leader's length rather than a narrow bar scaled
up, which would be the same arithmetic and would blur it.

Reduced motion keeps both phases and their order and drops the movement: no draw, no pivot, no
slide — the marks fade where they stand. A mark's whole life runs off one value (`a`: 0 = absent,
1 = fully drawn on its bearing), and reduced motion just routes it to opacity instead of to
geometry, so the two forms are *pixel-identical* at `p = 0` and `p = 1`. See the note under
Verification for why that's what lets the x-ray keep `cleanEnds` with annotations on screen.

Each part carries its own opacity rather than the mark carrying one for all of them, which is what
keeps a `scaleX(0)` rule from painting. A zero-width box with a spread shadow is a degenerate
transform and that's where a stray antialiased hairline comes from — and on departure the line sits
at zero for the whole second beat, not just for an instant at the end.

### Placing them

`e`, or `?edit=1`. Two ways in, because they answer different questions: **dragging the rings** on
the stage is how you find a position — you're looking at the shoe, not at numbers — and the **number
fields** are how you set one exactly, nudge by a tenth, or get there from the keyboard, which a drag
handle can't offer. Cyan discs are dots, amber rings are text, and the same marks appear beside the
fields so the panel and the stage don't need a legend to connect them.

| | |
| --- | --- |
| **dot** | the ringed point on the feature (`target` in the source) |
| **text** | where the shelf starts, and the end the leader leaves from (`anchor`) |
| **text side** | whether the name sits above its shelf or below it |

**Both states are listed at once**, because what's usually being refined is the relationship between
them — whether the two dots are far enough apart to read as different parts of the shoe, whether the
two shelves want the same height. Comparing that through a toggle means holding one set of numbers in
your head. What stays one-at-a-time is the *handles*: eight on the stage is a thicket, and the two
states are drawn at opposite ends of the reveal anyway, so selecting a state pins the progress to the
end it's fully drawn at and moves the handles there. A frame pinned deliberately (`?p=1&edit=1`, or
the debug scrubber) wins instead, and the state follows it.

`side` is **per state**, not per pair. It was per pair while these positions were fixed in source —
both marks of a pair happened to want the same side, one aiming down off the top band and one up off
the bottom. Once the editor could drag a text past its own dot that stopped being true, and a shared
side left a reachable placement with no way to correct it.

The layout persists to `localStorage`, which is the right home for a value you're still deciding and
the wrong one for a value you've decided — nobody else's checkout has your storage. **Copy** is how a
placement stops being local: it emits the `DEFAULT_PAIRS` literal to paste over the one in
`lib/callouts.ts`. **Reset** goes back to that literal and clears the stored copy; it's disabled when
there's nothing stored, which doubles as the indicator that what you're looking at is source.

Opening the editor forces the layer visible even with the switch off — you can't place what you can't
see. Labels aren't editable here: the text is content, and content lives in source.

## The section plate

The cut itself is the plain dissolve, unchanged. Everything around it is not.

Over the first third the room changes: the page background crosses from the warm wall to a deep
blueprint, an atmosphere grid resolves behind it, and a measurement frame draws itself around the
specimen in real millimetres. Through the middle the shell comes apart — a point cloud sampled
from the photograph itself is released ahead of the section front and carried up into the
airflow, while a band of scan rules travels with the front across the silhouette. Over the back
third the cut finishes and leader lines name what's inside, each one arriving just after the
front has passed the feature it points at.

The environment **leads** the shoe rather than following it. The instrument switches on, then it
cuts. The other order reads as the page catching up.

### The scale is real

The axes are the part most likely to be taken for decoration, so they're the part most worth
being honest about. One measured number anchors everything: a men's US10 road shoe is about
300mm heel to toe, and `measure.mjs` already establishes that the silhouette spans 1.95%–98.83%
of the stage. The rest falls out of those two facts and the box's fixed 3:2 — see `lab/scale.ts`.

```
specimen        300 mm, spanning 1.95%..98.83% of the stage
stage box       309.7 x 206.5 mm   (3:2, so the scale is isotropic)
plot origin     the toe, at ground level — the datum a shoe is measured from
grid            25 mm, square cells, subdivided at 12.5 mm
height axis     0..150 mm, which clears the collar (~144 mm) by a hair
```

The `FRONT` readout converts the section front through that same scale, so scrubbing to 50% shows
~150mm and the front sits on the gridline that says 150. A readout that can't survive being
checked against the thing next to it is set dressing; one that can is the difference between
looking technical and being technical.

### The point cloud

`lib/points.ts` decodes the intact shoe at 384×256 and samples ~12 000 points from it, weighted
by three properties of the source: alpha decides membership (the masters are cutouts, so no point
ever lands off the shoe), the **alpha gradient** concentrates points along the silhouette, and
luminance thins the cloud over the near-black outsole and fills it over the white foam. A stipple
with uniform density reads as noise laid over a shape; one that thickens at the rim reads as the
shape, which is the whole difference between grain and scan.

Two things about the motion cost real time to get right:

- **The drift is weighted hard upward**, not along the front's own axis. Drifting downstream
  keeps every point over the photograph it was sampled from, where a white mark on white foam is
  nothing at all. Lifting them takes the wake into open blueprint within a few tenths of its
  life, which is the only place it can be seen. A wind tunnel photograph looks the same way, so
  the physics and the legibility happen to want the same thing.
- **Horizontal and vertical drift are scaled by different functions of the point's seed.** One
  shared speed varies how far each point travels but not which way, so every streak leaves at the
  same angle and the field reads as a comb dragged across the frame.

**Every position is a pure function of `p`.** Nothing reads the clock. That costs the field its
idle shimmer — stop scrolling mid-transition and it freezes — and buys reproducible screenshots,
a `verify.mjs` that can compare a scrolled frame against a scrubbed one pixel by pixel, and no
rAF running when nobody is scrolling. A frozen field is also the right read: this is an
instrument holding a frame, not an aquarium.

### The cut

Both variants cut with the same front, from `lib/front.ts`. That's the point of keeping the
plain dissolve registered — it can only be a control if the two cuts are provably identical
rather than incidentally similar, and they were separate constants until they weren't.

The intact shoe softens and lifts slightly while the cross-section is revealed behind a soft
front travelling toe → heel. Nothing grades the image: the shoe's own coral and white are
untouched at every frame, so translucency alone carries it.

There is deliberately **no bright sprite riding the front**. One used to, and even with soft
shoulders its light was concentrated enough — a ~40px core inside a 320px sprite — to read as a
hard line sweeping across the shoe, because the moving thing is the thing the eye locks onto.
Without it the soft mask *is* the effect.

The mask ramp spans 32% of the stage width (~370px at 1150px). It's a genuine linear blend, not
an eased-looking step: recovering the per-column blend weight from a render gives 1.00 at x=240
falling smoothly to 0.05 at x=600, which is exactly the span it's configured for.

### Four things that were built twice

Recorded because each one looked correct in the editor and only failed on screen or in the
counters, and each will be tempting again.

**Chrome fades on a function transform, not on keyframes.** `useTransform(scrollYProgress, [0,
0.1], [1, 0])` is a shape motion can hand to the compositor as a scroll-timeline animation, and
here it got it wrong: the fade itself is correct, but past the end of the range the opacity
climbs *back up*, reaching ~0.35 over the finished plate. It never showed, because the paired
`visibility` is computed on the JS path and correctly pinned it hidden — so the page looked
right while resting entirely on a line that reads like a redundant safety net. A function
transform can't be expressed as keyframes, so motion evaluates it per frame. Only values derived
straight from `useScroll` are exposed to this; the plate's own layers transform a plain
`MotionValue`, which has no timeline to be accelerated onto, and `verify.sh` matching to 0.000
is the standing proof.

**Leader lines are rotated divs, not SVG.** The obvious build is an SVG line drawn with
`stroke-dashoffset` and `pathLength="1"`. It renders as a 1px-on-1px dotted rule, because the
line also needs `vector-effect: non-scaling-stroke` to survive a stretched viewBox, and that
moves dash arithmetic into screen space where `pathLength` normalises nothing. Animating the
endpoint instead fixes the look and costs a layout every frame, because geometry attributes
reflow. A rotated 1px div growing by `scaleX` has neither problem — and because the stage is
locked to 3:2, its length and bearing are constants that can be solved once.

**Live figures are digit wheels, not text.** Rewriting `textContent` as you scroll was
measurably the most expensive thing on the plate: a layout on ~66 of 91 frames, against zero for
every other layer. `contain` bounds that cost but doesn't remove it. Pre-rendering each digit as
a column of 0–9 behind a one-row window and translating it means nothing is ever rewritten — and
a figure that rolls between values reads more like a live measurement than one that teleports,
so the cheap version is also the better looking one. See `lab/Odometer.tsx`.

**The portrait camera push is off when a plot frame is present.** `.camera` scales to 1.1 in
portrait, which is right for a bare photograph and wrong here: the axis numbers live in the ~48px
the stage leaves at each edge, and 10% eats exactly that, so the plate arrives with its scale
clipped off. The rule is keyed on `:has(.plot)` rather than on a variant id, so it stays true for
anything else that draws one.

## The running reel

Scroll past the stage and a second section takes over: six columns of running footage rising past
one line of type — *Beginning beats fast.* — one column at a time. They cross the window once each
and leave; the headline is held alone in the black room for a beat; the room and the type invert
together; and then the whole thing slides up out of the window with the type still in it.

**Reel** in the top bar switches it, `r` toggles from anywhere, and `?reel=0` / `?reel=1` pins it.
Off means *unmounted*, not hidden: the section is six decoding videos and its own scroll timeline,
and the switch exists so the x-ray can be looked at on a page that costs what it used to. It also
makes the document shorter rather than emptier, since the colourway strip below it is outside the
switch.

It shares nothing with the stage above it. Its own `useScroll` on its own section, its own room
colour that the background picker doesn't reach, and no `p`, no variant, no call-out state in
common.

### The timeline is in svh, not in progress

`s` is **scroll distance in `svh` since the section's top edge reached the bottom of the window** —
so it covers the 100svh of arrival as well as the pin. One `useScroll` with `offset: ['start end',
'end end']`, multiplied by the section's height. The conversion is exact: that offset pair's scroll
range *is* the section height.

```
  40 →  100   arriving. The rules grow upward from the bottom edge, left to right,
               finishing as the section locks.
 100 →  140   then the headline fades and rises in.
 140 →  260   the six tiles reach the bottom edge, one every 24svh.
 280 →  435   they leave through the top in the same order, and the room empties.
 435 →  465   held: the headline alone in a black room.
 465 →  515   the room and the headline invert together.
 515 →  530   settled, white.
       +100   the pin ends and the room slides up out of the window, type included.
```

**Two of those numbers are sliders**, and both are currently set past the tidy version of this
timeline. The opening at 60 puts the last 20svh of the headline's arrival alongside the first tile;
the inversion at 425 starts the room lifting off black about 10svh before the slowest column has
finished leaving. Both were dialled in by eye, which is what the panel is for — see
[the dials](#the-two-dials).

Not a 0–1 progress, and that's the load-bearing decision in the component. The section is a
sequence of phases at fixed sizes, and as fractions of a total that changes whenever one phase is
retuned they drift into each other — an earlier version had the columns on one normalised timeline
and the room on another, purely because fractions of *different* totals were the only way to say
"start on arrival" and "start at the pin" at once. In `svh` there's one timeline, a column's speed
is literally how far it travels per viewport scrolled, and the numbers above are the storyboard.

It also means the room being `100svh` tall does real work: a tile at 100 is exactly at its bottom
edge and one at 0 is at its top, at any viewport. Nothing is measured, there's no `ResizeObserver`
in the component and no stale-measurement bug to have — a resize just recomputes the unit.

The last line has no code behind it. `SCROLL_VH` is where the *pin* ends; the section's box is a
viewport taller than that, and those 100svh are the sticky room being released and scrolling away
with the page. `s` is clamped at 940 and nothing animates past it — by which point the room has
already taken itself out (below).

### The opening: lines, then type

The rules **grow upward**, from the bottom edge of the room, staggered left to right across
60svh. Upward because that's the direction the section is travelling: while it's arriving, the
room's bottom edge *is* the bottom of the window, so the set rises into the page with it instead of
hanging down from the top of it. The first half of that growth happens below the fold for the same
reason — the room's bottom is off-screen until the pin — and 60svh is what leaves roughly 38 of it
on screen, which is enough for the stagger to read.

Then the headline, over the 40svh after the last rule lands. **Sequential, not overlapping.** It
briefly overlapped — the type used to start 6svh into the rules, which bought 40svh of scroll — and
it read as one event instead of as two, which is the thing an opening is for.

That 100svh of opening is why the first tile is now due at 140 rather than 100: the wall waits for
the room to finish introducing itself.

### The two dials

A panel, bottom left, with two sliders in `svh` — the same unit as the storyboard above, so the
readouts are directly comparable to it.

| | | |
| --- | --- | --- |
| **Opening** | `?ro=` | where the rules start growing; the headline follows 60svh behind |
| **Invert** | `?ri=` | where the room and the type start crossing |

**Opening** stops at 60, which is where it's set. The opening runs 100svh and the first tile is due
at 140, so at 60 the headline's last 20svh of arrival shares the frame with a climbing tile — the
trade the top of this range buys is the latest opening, and so the most of the rules' growth above
the fold. Dial it down for a cleaner order and an earlier start.

**Invert** is bounded above by needing its own 50svh *and* the exit's 130 before the pin ends, so
the room is always white before it starts to leave. At the low end it will overlap the drain, which
at the current 425 it does by about 10svh.

Both persist in `localStorage`, both are pinnable in the URL, and the URL wins field by field so
`?ri=` alone doesn't discard a dialled-in opening. `Reset` appears only once something has moved.

It's a visible panel rather than one behind a key like the debug overlay, because it isn't an
instrument for inspecting the build — it's a control for deciding what the build should be. It also
only fades in within a viewport of the section: fixed and always on, it would sit over the shoe for
the whole first act.

The spans are fixed and the dials move them, so "sooner" is one number rather than four that have to
be kept in order. The rules take 60svh, the headline 40 and the inversion 50 whatever the dials say.

### One clip per column, shown once

```
place(column, s) = column.start - s * column.speed        // svh below the top of the room
```

That's the whole geometry. Each column has one tile, starting below the window, and it rises
through and out the top for good. No column repeats its clip and no clip appears twice on the page.

It looped once — wrapping each tile back to the bottom when it cleared the top — which is where
both the repetition and the pixel arithmetic came from: the wrap is only invisible if it happens
exactly outside the window, and that means knowing how tall a tile is at the current column width.
Dropping the loop dropped the measuring with it.

### One at a time, and all slower than the page

| | clip | shape | start | speed | arrives | leaves |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `forest` | portrait | 233 | 0.95 | 140 | 280 |
| 5 | `uphill` | portrait | 244 | 0.88 | 164 | 315 |
| 3 | `lake` | portrait | 252 | 0.81 | 188 | 352 |
| 4 | `valley` | 16:9 | 259 | 0.75 | 212 | 364 |
| 2 | `desert` | 16:9 | 265 | 0.70 | 236 | 399 |
| 6 | `rest` | 16:9 | 269 | 0.65 | 260 | 435 |

A tile arrives at `(start - 100) / speed`, and each pair of numbers is chosen to put those arrivals
**24svh apart**, starting at 140 — roughly one a quarter-viewport of scroll, and none of them
until the opening has finished. The order is 1, 5, 3, 4, 2, 6: not left to
right, because a sweep across the wall reads as one object being drawn, where an order that jumps
reads as six separate things turning up. They leave in the same order they arrive, so the wall holds
four at most and often two or three. That's the point of the cascade — at any moment there are a
couple of things to look at, not six.

**Every speed is now under 1**, between a twentieth and a third slower than the page. They used to
straddle it (0.80–1.32) and the section was too much to take in: three columns outrunning the page
while three lagged it means six things crossing at once and the eye gets none of them. Under 1
throughout, the footage is something the page moves past rather than something coming at it.

Portrait columns are the faster ones and the wide columns the slower, which is the one arrangement
of the two that reads as depth: a bigger thing passing faster is a nearer thing. It also keeps the
section a sane length — every tile has to clear the top before the room can empty, and a tall tile
on a slow column is the pole that sets that. `leaves` is the one column of that table that moves
with the viewport, because a tile's height is a share of its column's width: a wide short window
makes every tile taller in `svh` and the last one clears nearer 460.

The inertia is one spring per column, at 30–52 stiffness and 12–16 damping. The spring chases a
target the scroll has already moved on from, so a column lags under the wheel and keeps going for a
beat after it stops; damping is low enough to overshoot very slightly at the end of a flick, which
is the difference between inertia and lateness. Each column gets its own so they don't settle in
unison — six things stopping together read as one object.

### The type is over the footage, and mixed into it

The headline sits above every column — nothing is drawn in front of it — and it's a
`mix-blend-mode: difference` layer at a fixed white. So what renders is `|backdrop − white|`, and
that one declaration does three jobs:

- **Over dark footage it's white**, and over bright footage it's the negative of the frame. The type
  takes its colour from the running rather than sitting on top of it, and it's never a flat white
  rectangle over a picture.
- **When the room turns white, the type turns black.** By itself, in exact step, with nothing
  animating. The two transitions the ending needs are one animated value — which is also why the
  colour is fixed: animating it as well would fight the blend, since white over a white room already
  differences to black.
- **It can't be illegible against the wrong frame**, the way a flat ink can. Whatever passes behind
  it, the type is that thing inverted.

Two earlier versions did this differently and are worth recording. The first put two of the six
columns *in front* of the type, which was a nice depth cue and cost words. The second kept the ink
opaque and **stepped** it from light to dark at the midpoint of the flip, because interpolating an
ink one way while the background goes the other puts both at the same grey halfway through and the
headline vanishes for a beat.

The blend doesn't escape that — it's the same arithmetic, and `|grey − white|` is that grey. What it
does is make the crossing look like what it is. It's also fast: `easeInOutCubic` is steepest in the
middle, so the room passes through the low-contrast band in about 5svh of the 50, or roughly a third
of one wheel tick.

### The room empties, inverts, and leaves

Three beats, in that order, with nothing overlapping. The room is empty by 435 and the inversion
doesn't start until 465: those 30svh of headline alone on black are the phase, not a gap. Then 50svh
of the background crossing from `#08080a` to white with the type inverting against it, and nothing
else moving — it only reads as *the room changing* if it's the only thing happening. The **Invert**
dial moves that boundary; drag it below the last exit and the room will start turning white with
tiles still crossing it, which is the one arrangement of these beats the section wasn't built for.

Both ends of the room are solid colours: background and hairline each interpolate between a dark
value and a light one. A translucent hairline over a changing background would need a different
alpha at each end to read the same, and that's a second unknown for no gain.

**Then the section leaves rather than the type leaving — at half the page's speed.** The room is
sticky, so releasing the pin slides it out for free, and that's how this worked first. But a
released sticky moves at exactly page speed, and the type went past too fast to read on the way
out. So the room now translates 65svh across a 130svh window, which is half speed by construction,
and the release that follows is moving a room that has already left. What's revealed underneath is
`--bg` — the page's own wall, which is what the colourway strip below is on too, so the seam where
this section ends and that one begins doesn't exist.

That translation is the one linear transform in the section. Everything else here is eased, but
"half speed" is a *rate*: easing it would make the rate the one thing it isn't, fast in the middle
and slow at the ends, averaging out to the number asked for while never actually being it.

65svh rather than 100 because the headline is ~20svh tall and centred, so it has cleared the top
edge by 60 — past that it's an empty white room leaving an empty white page, and the release can
have it.

Two earlier endings did this differently: the headline translating out under its own power (fast
enough to read as being yanked), and a white plane overlapping the section and covering the type in
place. Both made the *type* or a *plane* the thing that moved. The headline still never moves
relative to the room it's in; the room moves.

The dividing hairlines are behind the footage, so a tile crossing a rule interrupts it — and the
tiles are inset 8px from the rules either side, because footage butted against the line that
divides it from the next column reads as a mistake rather than as a frame sitting in a column.

### The clips

Six loops — five of 4.0 seconds and one of 3.2 — cropped and encoded once at exactly the size
they're displayed at, three portrait at 432×576 and three at 568×320, 24fps, no audio, CRF 27,
`+faststart`. 1.2MB of video and 72KB of posters for the whole section.

```
ffmpeg -i source.mp4 -an -vf "crop=360:480,scale=432:576,fps=24" \\
  -c:v libx264 -profile:v main -crf 27 -preset slow -g 24 -pix_fmt yuv420p \\
  -movflags +faststart public/reel/forest.mp4
ffmpeg -i public/reel/forest.mp4 -frames:v 1 -q:v 6 public/reel/forest.jpg
```

The crop is where the aspect ratio is decided, and it's decided once: the tile is displayed at
exactly the encoded ratio, so `object-fit: cover` never crops a second time and nothing is scaled on
two axes. `loop` stays on the video — that's about the clip, not the tile. Four seconds of footage
has to last the ~160svh of scrolling a tile spends crossing the window, and it only ever crosses
once.

**Check a re-cut clip for dark frames.** One frame of the source's fade is enough to put a black
rectangle in a column, and `reel.sh` exists because that is invisible everywhere else:

```
ffmpeg -v error -i public/reel/valley.mp4 -vf "scale=32:18,format=gray" -f rawvideo -
```

Nothing is fetched until the section is within half a viewport (`preload="none"`, and playback is
what starts the fetch), and everything pauses when it leaves. Which is also what keeps the
colourways' own `lazy` images honest: by the time the reel is playing, the strip below it is still
two sections' worth of scrolling away. The `poster` is the clip's own first
frame, so a column is composed before a byte of video arrives — which is also what shows if autoplay
is refused, and what reduced motion gets.

Columns are dropped, not squeezed, as the page narrows: six above 1024px, four above 640px, three
below. Each column is a decode, so this is also the difference between six of them and three on a
phone. Below 640px every tile becomes portrait regardless of its clip — a 16:9 tile in a 130px
column is 73px tall, which reads as a mistake rather than as a frame, and `object-fit` has far more
source than it needs at that size.

Under reduced motion the wall is parked at s = 280, the frame with the most on screen at once — at 0
they're all still below the window and the section would be an empty room. The videos stay paused on
their posters, the rules are simply *there* rather than growing, and the pin shortens from 940svh to
220. The slow exit goes too — 130svh of scroll whose entire content is a translation is what that
setting exists to decline, and the sticky release still takes the room off the screen without it.
The **Invert** dial doesn't apply in that form either: it's dialled against a 940svh timeline and
would fall off the end of a 220svh one, so reduced motion keeps its own window at 160–205. The headline still fades in, the room and the type still invert, and the section still leaves by
scrolling: those are the content, not the motion.

## The film

Six seconds of footage, last before the questions. It arrives filling the window and playing, and
from the moment the section pins, scroll closes a frame around it: down to 80% of the window in both
directions, corners rounding as it goes, until it's a card sitting on the page. Scroll back up and it
opens out again. It plays once and holds its last frame — no loop.

**This replaced a frame-by-frame scrub, and the failure is the interesting part.** The first version
tied the clip's time to scroll position: 180 frames mapped across the pin, `currentTime` written a
frame at a time. Every mechanical thing about it worked — every frame was a keyframe, a seek
round-tripped in 11ms, and after one bug fix the loop presented 71–95 frames a second, which is as
fast as the display can show them. It still looked terrible.

The reason is that a scrub's smoothness isn't images per second, it's **frames advanced per image**.
A trackpad flick moves 60px in one refresh; at 13px per frame that asks for five frames at once, and
footage advancing five frames at a time strobes. The lever was pixels-of-scroll-per-frame, so the fix
was length: 400svh → 800svh took the step from 3.5 frames to 2.0, and it was still visibly steppy at
walking pace, on an eight-viewport section. A spring doesn't help either — during a continuous scroll
progress advances at the average rate of the scroll whatever the spring does, so a softer one only
adds lag and a bigger catch-up when you stop. Measured that too: it made the step *worse*, 3.5 to
5.3.

So the two are separated now. **The film runs on its own clock and scroll drives the geometry** —
which is the kind of thing that looks good moving at an arbitrary rate, because a box at 91.3% of its
size is not a wrong frame of anything. The section went from 800svh to 260, and the encode from
4.6MB to 1.3MB at a larger 1600×900, because playback doesn't need every frame to be a keyframe.

The parts worth knowing:

- **It starts when three quarters of the pinned box is on screen** — `useInView(pin, { amount: 0.75 })`.
  On the box, not the section: the section is nearly three screens tall, so "75% of it" would never
  be true. It pauses when you leave, and if you come back to a film that already finished it starts
  over.
- **One element animates, with two properties**: `scale` and `border-radius`, both composited or
  paint-only, on a box that already has its own layer. The size is a transform rather than a width,
  so nothing lays out while you scroll.
- **The radius is divided by the scale.** A transform scales a corner radius along with everything
  else, so 28px on the glass at 0.8 means 35px declared. `radiusAt()` in `lib/clip.ts` does the
  division; `scripts/clip.sh` asserts the product, because corners that are right at one end of the
  section and wrong at the other are the classic version of this bug.
- **The shrink spends 60% of the travel and then holds.** Without the hold the section would still
  be mid-transition as the pin released, so the card would never be seen at rest.
- **Reversal isn't implemented.** Scale and radius are a function of scroll position, so going back
  up is the same function read backwards. It's still asserted, because "shouldn't need code" is
  exactly the sort of claim that stops being true.
- The readout down the left carries the film's own frame and time, read back from the decoder via
  `requestVideoFrameCallback`, plus the live frame size — the one figure there that's about the
  scroll rather than the footage.

Reduced motion parks it at the card, 80% and rounded, rather than at full-bleed: that's the
composition the section is *for*, where full-bleed is only where it starts. It renders a still and
never fetches the film at all.

```sh
# 1708×960 is not exactly 16:9 (16:9 of 1708 is 960.75), so crop to 1706 first.
ffmpeg -i source.mp4 -an -vf "crop=1706:960,scale=1600:900" \
  -c:v libx264 -profile:v high -crf 23 -preset slow -g 60 \
  -pix_fmt yuv420p -movflags +faststart public/clip/shoe-1600.mp4      # 1.3MB

# The phone tier, served under 640px.
ffmpeg -i source.mp4 -an -vf "crop=1706:960,scale=768:432" \
  -c:v libx264 -profile:v high -crf 26 -preset slow -g 60 \
  -pix_fmt yuv420p -movflags +faststart public/clip/shoe-768.mp4       # 285KB

ffmpeg -i public/clip/shoe-1600.mp4 -frames:v 1 -q:v 5 public/clip/shoe-0.jpg
ffmpeg -ss 3.0 -i public/clip/shoe-1600.mp4 -frames:v 1 -q:v 5 public/clip/shoe-still.jpg
```

## The two sections with nothing to look at

The prose section and the FAQ — third and last by default, and documented together because they're
one composition used twice: a dot, a statement at display size, and text set small and quiet under
it. The FAQ's answers now sit in individual rounded cards rather than a ruled list — the separation
between two questions is the space between two objects instead of a line belonging to one of them,
which is also what stopped the last row needing a rule of its own so the final answer didn't open
into nothing. After three sections of photographs, footage and product, the
page needs somewhere to say a thing in words — and the reason it reads as a *pause* is that there is
no picture in it at all.

It's a twelve-column grid used at three of its lines. The statement starts on the first, the dot on
the second, the paragraph on the third; nothing is centred and nothing is measured. Below 760px the
grid collapses to one column and the three left edges become one, because a nine-of-twelve statement
in a 390px window is a column of two-word lines.

Both sit on `--bg`, so the picker still governs them, and their ink flips with it off the
`data-bg-light` flag the picker already publishes — near-black on the light walls, near-white on
Ember, and a dimmed version of whichever for the body copy. That's the same mechanism the x-ray's
call-outs use, for the same reason: these sit on a wall someone else chooses.

**The statement is set in the body sans at 400**, not in either display face. Both of those are bold
and this wants the light grotesque the reference uses — and more to the point, the reel's headline is
the page's one place for display bold. A second one would be competing with it.

**The copy is placeholder, and the code says so.** It's written to be plausible about this shoe
rather than true about it: the materials it names are the ones the x-ray's call-outs name, which were
read off magnified crops of the photographs, so the nouns are honest and everything they're claimed
to *do* is invented. Two of the five FAQ answers point at other sections of this page instead of at
the product, which is the honest kind of filler — those two are true. Anything that ships needs the
rest from someone who knows the product, which is the same caveat the call-out labels carry.

### The accordion

One answer open at a time. The answers are long enough that two of them push the third off the
screen, and the question you just asked is the one you want under your eye.

**A closed answer is unmounted, not hidden.** `AnimatePresence` rather than a permanently-mounted
panel at `height: 0`, so what's closed is out of the accessibility tree and out of a find-in-page
rather than merely invisible — which is the difference between an accordion and a list of things the
browser thinks you can read.

**The height animates from and to `auto`**, which motion measures. The alternative is a `max-height`
guess that either clips the long answers or eases through empty space on the short ones, and these
differ by a factor of two — 260 characters against 130. It's the one property here worth checking by
measurement rather than by eye: an `auto` that resolved wrong lands the answer on the page at no
height at all, which looks exactly like a row that didn't open.

The question is a `button` inside the row rather than a clickable row, so it takes focus and
announces its own state; the mark beside it is styled off the same `aria-expanded` the button
carries, so the two can't disagree. It's a plus that rotates into a minus rather than two glyphs
swapped, so opening and closing is one gesture in both directions.

Reduced motion gets the answer and not the fold — the height is what moves the rest of the list, and
that's the movement worth handing back. `transition: { duration: 0 }` rather than a skipped
animation, so the two paths are the same code.

## The order is data

The seven sections are a list, and the panel under the top bar drags them into any order. It's
persisted, and `?order=xray,reel,prose,fabric,colorways,clip,faq` pins a whole arrangement into a
link.

**The sections themselves are draggable because none of them knows where it is.** Each one owns its
own scroll timeline and measures against its own section box — the x-ray's `p`, the reel's `s`, the
prose's fade — so the only thing that changes when one moves is which box it's measuring. Nothing
reads the document, and nothing needed changing to make this work; the feature is a `map` over an
array of ids.

**Rows are keyed by id, not by index**, which is what makes re-ordering *move* the DOM nodes rather
than render different content into the same ones. A section that moved keeps its scroll listeners,
its springs and — for the colourways — whatever you were pointing at. The x-ray keeps its own `key`
inside the shell, which is what still remounts it per variant.

**A list, not the sections themselves.** They're between one and seven viewports tall, so dragging
the thing itself means dragging something whose ends you can't see. A row each is the smallest surface
that shows the whole order at once, which is the thing being edited.

**It recedes with the rest of the chrome**, on the same first scroll as the variant switcher, and for
the same reason: re-ordering is something you do to the page before reading it, and a control that
stayed up would be a control over the content it's covering. Arrow keys move the focused row, which
is the whole feature without a pointer.

An order that can't be honoured still resolves to a whole page: unknown ids are dropped, duplicates
ignored, and anything missing is appended in default order. A saved order is a preference, not a
document — a link from before a section existed should still show every section.

The default is the reading, and it's the one thing here that isn't arbitrary: the cut explains what
the shoe is made of, the reel is what it's for, the prose is the part that needs no pictures, the
range answers "which one", the film is the closing look, and the questions come last because they
always do.

**[The wind tunnels](#the-wind-tunnels) were briefly a seventh entry in this list**, and the
argument for taking them out is worth recording because it's an argument about documents rather
than about code. They are an instrument, like the cut, so the obvious home was next to it — and
two instruments back to back is one long technical passage the page doesn't recover from, which is
why they landed after the prose instead: the prose claims the upper is open where the foot needs
air, and they show that being true. But that is an argument about *adjacency*. What they actually
are is a section about a knit, and there is now a page about a knit. Nothing in the section had to
change to move: it owns its own scroll timeline and doesn't read the document, which is the same
property that made the list draggable in the first place.

## The colourway strip

Below the reveal, the same shoe five times: `components/Colorways.tsx`. The stage answers *what is
this shoe made of*; the strip answers *which one*. It sits on `--bg` like everything else, so the
background picker still governs the whole page.

**Hovering a tile sets the wordmark.** `pop tempo` rests there and each shoe replaces it with its
own colourway, in its own colour. The name is the thing worth reading, so it's set once, large, in
one place, instead of five captions at thumbnail size that all have to be legible at once.
**Clicking pins it**, which closes two holes a hover-only version has — nothing to do on a
touchscreen, and no way to hold a colourway still to look at. Focus drives it the same way the
pointer does, so a keyboard walk through the row reads the range out; hover wins over the pin while
it lasts, so pinning never blocks previewing the rest.

Only **mars red** is a real name, from the supplied lockup. The other four are invented for the
prototype and follow it into orbit: lunar white, neptune blue, eclipse black, venus pink.

### What sets the size of the row

Not the width. A picked-up shoe stands about 83% of a tile's height above its own tile, the section
clips, and the space it stands in is whatever the wordmark leaves over — so past a certain size the
thing the strip exists to show is the first thing cut off. Three things give the row its size, and
two of them are about height:

- `min(860px, 100%, 89vh)` on the strip. The `vh` term is what stops the width writing a cheque the
  height can't cover.
- **Lopsided section padding**, `16vh` at the top against `6vh` at the bottom. With the content
  centred, half of every pixel of top padding becomes space above the row, and the space under the
  wordmark was doing nothing. It costs a resting composition that sits a little low and it buys
  about a fifth on the shoes.
- **A wordmark that knows about height**, `clamp(52px, min(13vw, 22vh), 176px)`. Sizing type off
  the viewport's height isn't usual, but this is a full-viewport lockup where the shoes are
  height-bound: a wordmark that only knew about width would take a fifth of a short screen and take
  it straight out of the shoes.

Measured across seven viewports, the picked-up shoe clears the top of the section by 63px in the
worst case (1440×700) and 90px at 1440×900, where a tile is 151×239 — against 127×200 before this
was worked out. Those clearances were 22 and 35 when the pick-up was a louder one; the numbers here
are set against the tightest case, not the comfortable one.

### Picking a shoe up

A hovered shoe grows to 1.2×, lifts until its sole clears the mark below it, leans a few degrees,
takes a drop shadow, and follows the pointer by a few pixels. Its tile shrinks 4% underneath it.
The lift is measured off the lockup and the scale started there too, at its 1.26.

**The scale is smaller than it was**, having gone 1.26 → 1.39 → 1.2. The 1.39 was set against a row
a fifth smaller than this one, and a pick-up is read as a proportion of what it started from — so
the same multiplier on a bigger shoe is a louder gesture carrying no more information. At 1440×900
it takes a shoe from 282px tall to 348.

**The tile's 4% is a correction too.** It was the shoe's growth exactly, inverted — a 28% shrink at
the time, which is arithmetically tidy and makes the tile the thing you watch. The point of the
gesture is the shoe, so the tile's job is to be felt receding and nothing more; anything larger is
a second animation competing with the one it's supporting.

**The magnet** is `ColorwayTile.tsx`, and it's why a tile is a component rather than a loop body:
each shoe has to return home from wherever it was when the pointer left, on its own spring. One
pair of values shared across the row would drag all five at once, and a fresh pair per hover would
snap the last one home.

The pull is 5px at the edge of the tile, drawn at about 6 once the shoe is picked up — because it
rides `transform` while the pick-up rides `translate`, `rotate` and `scale`, which resolve first.
That composition is the whole trick: a 420ms eased pick-up and a live spring share one element
without either overwriting the other.

It reads the pointer off the event's own `offsetX` into the button rather than off a measured rect.
A pointer move can fire a couple of hundred times a second and every `getBoundingClientRect` on
that path is a forced layout. The offset is already relative to the target — including the part of
the hit area that reaches up over the lifted shoe, which is why the ratio is clamped rather than
trusted. Under reduced motion there's no pull at all.

**The lean is per colourway, not per hover** — between -5° and 5°, off a hash of the slug rather
than a real random number. It's the *set* that wants randomising, not the moment: a shoe that leans
the same way every time you point at it is one of five shoes each sitting slightly differently,
where a new angle on every hover is one shoe twitching. It also keeps the screenshot scripts
comparable run to run. These five land on -4.2, -1, -0.7, 3.3 and 4.2.

Everything pivots about the sole, which is the origin that reads as a shoe standing and leaning
rather than as a picture being rotated — the heel stays put and the toe swings. Individual
transform properties resolve in a fixed order, translate then rotate then scale, so the three
compose without fighting and the sole stays where the mark expects it whatever the other two do.

The shadow is `drop-shadow`, not `box-shadow`: these are cutouts, and a box shadow would hang a
rectangle behind a shoe. It's declared at zero on the resting state rather than `none`, because a
filter can only animate into another filter with the same functions in the same order. Its offsets
are small — 10 and 14 — because the filter is applied before the transform, so the scale draws them
at 12 and 17. It's deeper on a dark wall than on a light one: a shadow works by being darker
than what it falls on, and there's less room to be darker than Ember.

### The swap

`components/SwapWord.tsx`. Every letter sits in its own window the height of the line. **A letter
drops out through the bottom of its window and its replacement comes back up through the same
edge**, so the two words hand over in place rather than one passing the other — the word changes
the way a split-flap board does, position by position and always in the same direction.

**The two halves interleave, and are still never both visible in one place.** Each letter's
entrance is delayed by exactly the length of its own exit, so the column it lands in is empty when
it arrives. What that buys over waiting for the whole word to clear is the middle of the new name
arriving while the ends of the old one are still leaving, which is the swap reading as one movement
instead of two.

The words are laid one over the other and each is centred on its own width — `lunar white` is half
again as wide as `mars red` — so what keeps them apart *horizontally* is the order the stagger runs
in. **From the middle out**, the letters still on screen from the old word are always the outer ones
and the letters already arrived from the new word are always the inner ones: an annulus and a disc,
which don't intersect. Left to right, the same timing would put the new word's opening letters
straight through the old word's closing ones.

That argument is checkable, because during a colour-to-colour swap the two words are different
colours: sample the wordmark every 35ms and count the pixel columns holding ink from both. Across
the widest mismatches in the set, the worst frame is **9 columns of 1392** — the seam between the
last letter leaving and the first one arriving — and most pairs never register a column at all.

| | worst frame | when |
| --- | --- | --- |
| lunar white → mars red | 9 columns | ~70ms |
| mars red → neptune blue | 3 columns | ~35ms |
| mars red → lunar white | none | |
| venus pink → eclipse black | none | |

Middle-out is the better reading order for its own sake as well: the letters carrying most of a
lower-case word's silhouette go first and the ends catch up. Left to right makes the last letter
change a beat after the word is already readable, so the eye finishes the word and then gets
interrupted. And the delay is symmetric, so words of different lengths take the same time.

The exit is quick — it's dead time in the column it's leaving, and the entrance is the part with
something to read: 140ms out against 240ms in, at a 26ms step per letter of distance from the
middle. The middle of a word turns over in 380ms and `lunar white`, the longest, finishes about
140ms after `mars red` would.

**Nothing waits for the pointer to settle.** There was a 110ms hold here, so that a drag across the
row couldn't fire five swaps in as many frames. All it bought was a tenth of a second where the
tile had answered and the name hadn't, on the way in and on the way out.

### The mask has to be open at the sides

`overflow: clip` is the obvious way to write a per-letter window, and it shaves the type. A glyph
is free to paint outside its own advance width, and at display tracking most of them do — so the
cell cuts whatever crosses its edge, and the next cell, pulled left by the negative tracking, lands
on the stump. The `i` in `eclipse` was the tell: its dot squared off flat against the `l` beside
it, which reads exactly like two letters overlapping.

`clip-path: inset(0 -0.12em)` keeps the window the animation needs — top and bottom, at the box —
and lets the sides through. Set the same word twice at the same size, once as ordinary text and
once through this markup, and the mean pixel difference goes from 1.396 to 0.578 of 255. The repo's
own comparison tolerance is 1.0.

### And then the tracking

The lockup's tracking is measurable, because tracking moves ink width and doesn't move ink height:
`mars red` in the supplied artwork has an ink box of 1832 × 392, and 4.6735 has exactly one
solution for this face at this weight — **-0.0298em**, which is what the first version was set at.

It's set looser than that now, at **-0.014em**, and the reason is the split. The lockup is one run
of text and this is twelve, so the kerning between cells is gone — each letter is its own run and
nothing kerns across a box boundary. The pairs that suffer are the ones the reference happens not
to contain: `li`, `cl`, `bl`. At the lockup's own setting they close up; at -0.014em they open back
out, and the word still reads as display type rather than as a label.

Reduced motion swaps the variants for a 120ms cross-fade with no stagger, because a staggered fade
is still something crawling across the screen, and with nothing moving there's no gesture left to
read.

### The mark under the pointer

`components/CursorMark.tsx`. Over the strip the arrow is replaced by the lockup's own dot: same
size, same colour, taken off the tile and put under the cursor, and it holds the colourway you're
pointing at. Mark, tile and wordmark are then all saying the same thing at once. It carries the
reference's diagonal arrow, knocked out in `--bg` rather than white — on a light wall a white arrow
inside Lunar White's grey has nothing to hold onto, and on a dark one it disappears into Eclipse
Black's pale ink, where the wall's own colour is guaranteed to contrast with a mark that was chosen
to contrast with the wall.

**The tile's static dot is still there, and stands down while the mark is up.** Two circles of the
same colour a few pixels apart is one too many, and the one attached to the pointer is the one
answering you. What the dot is for now is the case with no pointer to put a mark under: a keyboard
walk through the row, or a tap.

**The mark belongs to the shoe, not to the neighbourhood.** It began as a padded region around the
strip, and it appeared as soon as the pointer was anywhere near the row — a cursor replaced over
empty page, before there was anything to replace it for. It's keyed on a tile being under the
pointer now, which is as close to the silhouette as this gets without hit-testing the matte.

The tile's own hit area is what makes that work, and it had to grow twice:

- **Up**, by 72% of the tile's height. A hovered shoe stands about that far above its tile and the
  image doesn't take pointer events, so without it, moving up onto the shoe you just raised leaves
  the button — and the thing under the cursor un-lifts while you point straight at it.
- **Sideways**, by half the gap each way, so the five hit areas meet instead of leaving a seam
  between them. The seam is a few pixels wide and it's the width of the mark's whole existence:
  dragged along the row, the mark would blink out and back at every tile boundary. Measured across
  the boundary at 4px a step: no sample without a mark.

`cursor: none` is keyed on the mark actually being up rather than on the region, so a touch device
or a failed mount leaves an ordinary cursor rather than none at all.

It leaves by collapsing to a scale of nothing, with opacity held at 1 the whole way — measured at
~200ms from 1 to 0. A mark that shrinks to a point hands the cursor back; one that fades leaves a
ghost lying over the arrow that has already replaced it.

Position is sprung rather than tracked. A mark pinned exactly to the pointer is just a cursor and
reads as a rendering artefact; the frame or so of lag is what makes it an object being carried
along. Under reduced motion it's pinned — the spring is a thing moving on its own, while the
position has to keep up with the hand either way, so the honest reduction is to drop the lag, not
the mark. Pointer position rides `useMotionValue`, so a move writes a number and the transform
follows it without re-rendering five tiles and a wordmark at pointer-event rate.

**It takes two elements, and that's a bug fix rather than a structure.** Position and appearance
are both transforms. With `x`, `scale` and an `initial` on one element, motion resolves them
together — and since the entrance's target had no `x` in it, mounting the mark animated x to zero:
the mark spawned in the top-left corner of the window and slid out from there, while the motion
value it was supposed to be bound to sat at the right number the whole time. It only showed when
the pointer arrived on a shoe without crossing the section first, because any later move re-set the
target and papered over it. Splitting the element gives each transform one owner. The outer one is
never unmounted, so the binding survives the mark coming and going, and a `jump` on appearance puts
it under the hand rather than letting it fly in from wherever the pointer left last time.

### Two inks per colourway

The wall is a control, and a wordmark set in the shoe's own colour is exactly where that bites.
Three of the five have the chroma to hold both ends of the palette — measured against Ember and
Paper at 3.5:1 or better. The two that don't are the two named after an absence of colour: Eclipse
Black is invisible on a dark wall and Lunar White has nothing to be white against on a light one.
They carry an `inkDark` as well, and CSS picks between the pair off `data-bg-light`, the same flag
the call-outs flip their ink on. The dot and the cursor mark are the same colour and take the same
treatment.

The mark and the wordmark read the same colourway out of the same place, so there's no state in
which the circle under the hand and the name under the strip disagree.

### Preparing the photographs

`node scripts/colorways.mjs`, which is `png.mjs` doing a second job — it now decodes palette images
and can encode as well as decode.

The five arrive matted already, but as contact sheets: a shoe lying toe-right in a wide frame, two
thirds of it empty, canted a couple of degrees off horizontal. The script stands each one up, trims
it to itself and resamples it to a common height, so the file's edges mean the shoe's edges and one
set of CSS numbers frames all five.

**The tilt is measured, not eyeballed** — the major axis of the silhouette, from its covariance. A
shoe is far longer than it is wide, so that axis *is* the shoe, and turning it onto the vertical
squares all five to each other without anyone deciding what "level" looks like. It comes out at
0.3–0.4°, which is small and is also the difference between a row that lines up and a row that
doesn't.

Colour is carried premultiplied through both resamples. Interpolating straight alpha across a hard
matte averages the transparent side's colour into every edge pixel and hangs a halo on the shoe —
the one artefact that would be obvious on a dark tile.

```
eclipse-black   308×760  tilt -0.3°  accent #151516
lunar-white     306×760  tilt -0.4°  accent #c8c7c4
mars-red        308×760  tilt -0.4°  accent #8f1d20
neptune-blue    308×760  tilt -0.3°  accent #072556
venus-pink      309×760  tilt -0.4°  accent #c3115b
```

The accent it reports is the most saturated eighth of the shoe, averaged — a starting point for
each colourway's ink rather than the ink itself. It finds the loudest thing in frame, usually the
insole print, and Lunar White has nothing saturated in it at all, so the values in `lib/colorways.ts`
are hand-set from these.

Sources live in `.context`, untracked; the outputs are committed. Re-running needs the originals
put back at `.context/colorways/src`.

## The pages

The nav's three rows are destinations now — **shoes**, **show zero**, **guest journey** — and the
month names went with the placeholders they annotated. There is still no router: a page is a fact
you can link to, so it rides the house convention as `?page=`, absent meaning shoes, junk meaning
shoes. What separates it from `?v=` and the other params is the verb — a page is *navigation* — so
it writes `pushState` where they write `replaceState`, and Back walks pages without ever walking
your colour choices. The store lives in `lib/page.ts`, shaped like `lib/sheet.ts` and for the same
reason: two components at opposite ends of the tree read it, and the `popstate` listener wants to
exist exactly once. It is never persisted — the URL is the document — which is also what keeps
every verification script honest: a bare load of the root is the shoe page, always.

The shoe page itself moved to `pages/ShoesPage.tsx` unchanged. The move is what scopes the
instrument: `h`, the digits, the sheet key, the panels and the dataset publishing all live in hooks
there, so leaving the page unregisters them and returning re-initialises from the URL, exactly like
a reload. Nothing learned to check which page it's on.

### Show zero

The second page introduces a fabric whose claim is negative — it *doesn't* show sweat — and a
negative claim needs a control group. So the hero is a bench test: two cut samples of cloth hung
side by side under one light, and one call to action — **spray water**. A press sprays both: the
same mist, the same shove into the cloth, the same moisture. The ordinary jersey blooms in
staggered blots and then slowly dries back out; the ShowZero sample takes the identical hit and
never shows a thing. Press again mid-dry and the moisture stacks, the way a second spray would.
The droplets themselves are aimed at the same zone seeds the shader wets — you watch the water
land on both sheets, bead, slide a little, and matter on only one. The feel is on dials (`h`, or
the corner pill) — wind, gust, spray force, moisture per press, seconds to dry, and the dye lot.
Each pins into a link as a URL param (`?fabric=navy&wind=1.4`).

**There was a seventh dial and it's gone: the *hang*.** Flat on the line under even bench light, or
gathered to half its width and dropped into deep S-folds under a warm raking key, where the cavity
term got full authority and the folds carried the light. The gathered staging looked better than the
flat one does — and a sample gathered into folds is a sample whose marks are partly hidden by its
own shadows, which is the one thing a comparison about *showing* can't afford. It, its lighting rig
and its branch of `buildSwatchGrid` are deleted rather than left switchable.
No readouts: the samples are the evidence, the moisture level is published on the document root
for the scripts, and `scripts/showzero.sh` enforces the claim in pixels.

It's the repo's first three.js (`three` + `@react-three/fiber`, lazy-loaded so the shoe page never
pays for it). The samples are built, not bought: a grid with the *hang* baked in — every column of
cloth dropped by the sag of its own x between the clips, sides gathered slightly on the way down,
folds deepening toward the hem — no model, no licence, and the two specimens are literally the
same buffers. Sweat is a distance field grown from seeded zones, wobbled by position-seeded noise
so the wicking edge is blotchy; wet jersey drops ~45% in albedo and goes glossier, and ShowZero's
response to the identical input is zero on both axes — nothing to show is the whole product. Both
samples wear the same dye lot, whichever one the panel picks.

The cloth is simulated, and the sim is the repo's one sanctioned exception to "nothing reads the
clock". Each sample is a small Verlet cloth — structural, shear and bend constraints over the flat
rectangle, heavy damping, a touch of Laplacian smoothing so wrinkles relax back out — a recipe
that follows [holocloth](https://github.com/dmitrykurash/holocloth) (MIT), the reference for how
this fabric should look: big soft billows, tension stars at the held points, folds that shade
themselves (its per-vertex cavity term rides along as an attribute and swallows the indirect light
in the valleys). Where holocloth floats in zero-g gel and moves when grabbed, these samples hang
from pinned clips in a slight travelling-wave breeze, with a weak pull back toward the baked hung
pose so the composition drifts but never wanders. One rAF loop steps both sims and parks when the
hero is off screen; reduced motion, any `?p=` scrub, and `?breeze=0` skip the stepping entirely,
leaving the vertices byte-for-byte the baked pose — which is how the verification script gets
frames that reproduce, and how the page stays a working comparison under reduced motion (the
spray still wets and dries; the cloth just holds still) and without WebGL (the same hang drawn
flat, same zones, same readouts).

**The spray is one mist, arriving all at once.** It was four aimed spritzes, one per sweat zone,
fired 110ms apart in the order the marks bloom — the water and the mark as the same event, with no
overspray to disconnect them. That reasoning was right and the timing wasn't: a single press read
as four, and a bottle of water doesn't tick. So every droplet is released on the same frame now,
four times as many of them and a third the size, and the cloud gets its depth from a spread of
*flight times* rather than from a queue of launches. Every one is still aimed at a zone — an even
shower over the whole cut is exactly what breaks the coupling — which took a correction of its own:
a two-thirds bias that let a third of the mist land anywhere came out once it was on screen.

**The specimens are named, not labelled.** `SPECIMEN A · STANDARD JERSEY` in tracked-out mono
framed the pair as two lab samples, and the comparison isn't jersey against a knit — it's a knit
against its own next version. They're **ShowZero** and **ShowZero v2** now, in Saans Regular at a
size you read rather than decode, and the call to action went to the sans with them. Everything
else on the hero that is a label still speaks in the mono; those two stopped being labels.

**And the claim is stated before you test it.** One line under the headline — the marked area at
full soak, as a figure and as a share of the panel — with the button under *that*, because the
method of this experiment is: read what it's going to show, then press the thing that shows it, and
those two were a screen apart with the samples between them. The figure is integrated from the same
circles the shader draws (`marksArea`), so it can't drift from the pixels; the share's denominator
is `PANEL_CM2` rather than a number typed into the sentence.

Fitting all that above the rail cost the headline two type sizes and the head block its generous
top inset. The alternative was lifting the camera to drop the rig in frame — one number in
`SceneCanvas` — and that's the wrong lever: it moves the composition the verification script pins
in order to make room for type.

**There was a closing statement and it's gone.** "all of the work. none of the evidence." sat
between the prose and the wind tunnels on the prose/FAQ composition, and its job was to be the line
you leave on. What it did was restate the hero in words directly under a paragraph that had already
explained it, and then hand off to a second bench test — so the page said the same thing three
times and ended on a measurement anyway. It ends on the measurement now.

**Under the test, the words** — and they're the shoe page's prose section, not a second copy of it.
The bench test proves the claim and then has nothing to say about the knit itself, which is exactly
the job that composition already does: a small label out on the left, eight of the twelve columns
given to text set large, a row of facts under it, and the whole thing revealed on the section's
arrival. So `Prose` takes its copy as a prop with the shoe's as the default, and the alternative was
duplicating the reveal, the grid classes and the `dl` markup to change three sentences. It also
takes the wall it stands on, which is the one thing that couldn't be shared: `--bg` is the picker's
choice about a photograph and it's persisted, so a section on another page would inherit a near-black
wall from a decision nobody made here. `wall="page"` puts it on the fixed light wall the rest of this
page is on, and the ink stops consulting `data-bg-light` with it. The copy is placeholder and further
from a spec than the shoe's — ShowZero isn't a product, so the weight, the fibre and the date are
invented to the shape of a fabric card. The closing statement still closes: the prose goes between it
and the hero, so the order is evidence, explanation, line you leave on.

## The wind tunnels

**Fast and Free, twice, in the same air** — `components/Fabric.tsx`, `lab/WindTunnel.tsx`,
`lib/air.ts`. The last block on this page, and its second bench test: two channels seen in
cross-section, stacked and full-bleed, **outside air at the left edge and skin at the right**,
with the knit standing across each. Cool air arrives from outside and goes looking for a way in.
In the top channel most of it doesn't find one; in the bottom most of it does, and the
microclimate it flushes stays near ambient instead of banking up warm against the skin.

Under the channels: one large slider, and two figures — **2.5× more air in**, **3.8 °C cooler**.
That is the whole of the type on it, other than the title and two marks along the axis. There were
three: `skin` at the far edge came off, because two say the direction as well as three do — air
comes from the outside and goes through the knit, and where it ends up is the only place left.

**Nothing in it reads scroll.** There was a 380svh pin and a five-beat storyboard: the channels
arrived empty, the fabric knitted itself across them middle-out, the air came on like a tap, then
the readouts and the verdict landed. All of it is gone. This is going on a display, and on a
display nobody scrolls, a section that only starts once you have scrolled into the middle of it is
a section that is never running when it's looked at. The one thing left that depends on where the
page is, is that the loop doesn't step two particle fields while the section is three screens away
— which isn't an activation, it's a frame budget.

**And it's monochrome, in a warm neutral room.** Air used to run cool blue through cream and coral
to red as it sat against the skin, on a deep blueprint background, with a warm wash on the skin
side and a glow on the skin edge. It read well and it isn't the palette: a page that is warm
off-white end to end shouldn't have one screen in navy and crimson. Temperature is carried by
brightness within one ink now — and that is *much* less information than hue was, which it can be,
because the temperature is quoted underneath. What the picture has to carry is how much air gets
through, which is density, which needs no colour. Taking the colour out did take the picture out
with it for one pass: hue was doing most of the contrast, so `PEAK` went up by half to buy the
density difference back in weight.

It's after the closing statement rather than before it because it answers a different question
from the hero: that one is about what the knit *doesn't* do, and this is about what it does. And
it's the one block on this page that isn't on `--page` — a dark instrument, where the seam at the
top of it is the point at which the page stops making a claim and starts measuring one.

**It began as a seventh section on the shoe page and isn't one any more.** A section arguing about
a knit belonged in the document about a knit; the argument for keeping it there — that the shoe
page's prose claims the upper is open where the foot needs air, and this proves it — turned out to
be about adjacency rather than about subject.

### It is a controlled experiment, and the code is what makes that true

The obvious build is two nice-looking loops, one busier than the other. That version can't be
wrong, because it isn't claiming anything. This one is:

- **One emitter, in front of both channels.** `puffs()` is called once per step and the *same*
  list is injected into both, so particle *i* is born at the same instant, at the same height, at
  the same speed, in each.
- **Nothing in `step()` reads a random number.** The wander is two sinusoids keyed on a particle's
  own seed and age, so a paired particle shakes *identically* on both sides. When one gets through
  and its twin doesn't, the fabric is the only thing that can have decided it.
- **The only asymmetry in the entire model is `pores` and `porosity`.**

Which means the ratio on screen is a measurement rather than an assertion, and `scripts/air.sh`
checks that it stays one: at the reference pace the airflow ratio is 2.46×, against a porosity
ratio of 0.44 / 0.18 = 2.44×.

### It runs the other way round now, and that's more than a label swap

The flow used to leave the skin: skin on the left, a plume on the right, heat accumulating
*upstream* of the knit in air that couldn't get out. Reversing it puts every hot thing in the
frame on the side of the fabric the claim is actually about, and it paid for itself three times
over:

- **The temperature became a mean rather than a total**, and stopped needing a normalising
  constant. `load` is now the mean `heat` of the air on the skin side — already in the model's own
  units, already bounded — where every earlier version was a sum divided by some invented maximum
  that moved whenever the pool was resized for drawing reasons.
- **The floor stopped being subtracted and started being earned.** The old reading had to have the
  load of a fabric-less channel taken off it, or a tunnel with nothing across it read warm. A mean
  temperature has a floor for free: a channel with nothing across it still comes out at about
  +2.6 °C, because a body under moving air warms the air moving over it, and only an infinite
  draught would read ambient. `air.sh` checks the *ordering* — open coolest, closed hottest —
  which is the property that has to hold.
- **The heat model became the textbook one.** A body puts out a fixed amount of heat per second
  whatever is over it, so how hot the microclimate gets is that heat *shared among however much
  air is in there to carry it*: `FLUX / (air in the microclimate)`, which makes the temperature
  rise inversely proportional to the ventilation rate. A per-particle soak rate — the first
  version — measures residence time only, and gave a ratio of 1.8 instead of the ratio of the
  throughputs. The flux scales with pace, because you produce more heat when you work harder;
  without that the reading falls off a cliff at the top of the slider and a fabric comparison
  ends up claiming a sprint is cooler than a walk.

### It reads the clock, and that's the one departure on the page

Everything else here is a pure function of scroll, and the point cloud's own notes argue that at
length: reproducible screenshots, a pixel-comparable `verify.mjs`, no rAF at rest. This can't be.
The thing being compared *is* a rate, and a frozen frame of two particle fields shows two
arrangements of dots rather than one fabric moving twice the air.

So it runs on time — but on a fixed 1/60 timestep from a seeded emitter, which keeps it
deterministic: same seed and same pace in, same frames out. That's what lets `scripts/air.mjs`
quote a number the page will also show, and what makes reduced motion's settled still
reproducible. The loop runs only while the pinned box is 40% on screen, and stops rather than
throttles when it isn't.

### Why the knit has to be the bottleneck

Volumetric flow through a porous sheet is limited by open *area*, so each pore passes at a finite
rate — `CAP × poreHeight`, spent from a token bucket — and the rest of the air waits or dies
waiting. Total capacity is therefore `CAP × porosity`, and **while capacity is what's binding, the
airflow ratio is exactly the ratio of the two porosities.**

Two things had to be true for that "while" to hold, and both were built twice.

**The streamlines have to converge on the openings.** Without that, whether a particle got through
was mostly whether its lane happened to be in front of a pore — `porosity` of them, plus about a
third for the wander. That put a ceiling on throughput which had nothing to do with the fabric's
capacity and everything to do with the geometry of the emitter: the open knit capped at ~56%
through however open it was, which capped the *trapped* difference between the two channels at
under 2× and made them look nearly the same. Flow bending into an opening is also what actually
happens, and it's the single thing that made the field read as a flow field rather than as a sheet
of dashes moving right.

**A pore's allowance has to be a token bucket, not a "busy until".** Holding a pore closed for
`1/cap` seconds after each pass passes *at most one particle per frame* whatever `cap` says — so
the throughput came out as a function of the timestep rather than of the fabric. The diagnostic
open channel in `scripts/air.mjs` is what caught it: a channel with nothing across it read 18%
through.

### One feedback term, and one damping term

`FLUX / air.inside` is the feedback: the skin's output shared among the company each parcel is
keeping, read off the previous step's count. One frame of lag on a population that turns over in
seconds is not a thing anyone could measure.

`DAMP` is the damping, and it's only inside. A jet leaving a pore carries whatever sideways speed
the convergence gave it, and with nothing to take that away it keeps it — so a parcel crossed the
microclimate on a straight diagonal and bounced off the far wall. Wrong (a jet's transverse
momentum dissipates into the bulk in a fraction of a second) and, in the streamline look, the
reason the skin side came out as a lattice of long crossing lines rather than as flow. On the
*outside* face the sideways motion is the story — air washing along the knit looking for a way
through — so it isn't damped there.

The predecessor of both was `PRESS`, a back-pressure term that slowed the flow off the skin in
proportion to how backed up the channel was. It went with the reversal, and losing it is a
simplification: continuity does its job better than a pressure hand-wave did.

### The two figures, and which half of each is invented

There were six figures on screen and now there are two. Each channel carried a tag and a porosity
in one corner — `TODAY · 18% OPEN` — and its own `AIR IN` / `SKIN` readout in the other: eight
pieces of type over two pictures whose whole argument is visible without reading any of it. What's
left says it once, underneath.

**What that costs is worth stating plainly: nothing on screen now names which channel is which.**
The order is the current fabric and then the new one, and the figures are phrased as a comparison,
so the reading is available — but it is implied rather than labelled. One word per channel would
fix it and would put type back over the picture, which is the trade.

The two per-channel measurements didn't stop existing; they stopped having a readout. They're
published on each channel's canvas as data attributes — the same reason the film writes
`dataset.frame` on its video — and with the figures now solved rather than measured, that is the
*only* thing keeping the quoted numbers tied to the drawn ones: `fabric.sh` reads them back and
asserts the two agree.

| | measured | invented |
| --- | --- | --- |
| **more air in** | all of it — crossings / releases, both smoothed as rates | |
| **cooler** | the difference of two mean temperatures on the skin side | the conversion to °C |

Turning a mean into degrees needs a heat-transfer model this prototype doesn't have, so `RISE` is
chosen to put the closed knit at about +7 °C — the sort of figure a microclimate under running kit
actually sits at. **It's placeholder in exactly the way the two porosities are**, and the figure to
check with someone who owns the real data first. The same caveat the call-out labels and the prose
carry. What is *not* invented is the relationship: 7.0 °C against 3.2 °C at the reference pace, in
the ratio the two throughputs are in.

### The pace is the only control, and the figures are what it answers

One slider, between the picture and the figures, because that is what it connects: it changes the
diagram above it and it changes the numbers below it, and standing between the two is how a control
says so. It's the second version of it — the first was 11px of mono in the corner of the header
beside a 2px track, which is a mouse's control. This one has a 44px hit area, a thumb you can find
without aiming, and its value set at the figures' size, because the slider's position is as much
the answer as the two numbers it produces.

**The figures used to be a live reading and they aren't any more.** An EMA of two particle fields
is never quite still: the headline sat between 2.43× and 2.47× and the last digit of everything
crawled, which reads as instability rather than as liveness. What they should do instead is answer
the slider — one position, one pair of numbers, every time.

So they're `predict()`: the model's steady state, solved. Every line of it is one of the constants
rearranged, and the last line is the reason a temperature can be quoted without running anything:

```
through   = capacity / production  = (CAP/EMIT) · porosity · wind^(PACE_LAW − 1)
residence = (1 − WALL) / (DRIVE · WAKE · wind)
population= through · EMIT · wind · residence        — the winds cancel
soak      = FLUX · wind / population
mean heat = ambient + soak · residence / 2           — and cancel again
          = ambient + FLUX / (2 · EMIT · through)
```

The microclimate's rise depends on the *fraction* that gets through and on nothing else about the
pace, which is also the physical statement: more air means more heat to shift and more air to shift
it with.

**And it's a table rather than a formula, which was two attempts.** The closed form above agrees
with the simulation to 2% over the top two thirds of the slider and drifts to 12% at the bottom,
because the mean of a population is only `exit / 2` if its ages are uniformly distributed and at the
slowest pace they aren't. A fitted correction would have been a fudge on top of an approximation.
So `CURVE` is the numbers `settle()` actually produces, one row per whole km/h, generated by
`air.sh` and pasted into the source — the same arrangement `lib/shoe.ts` has with `measure.mjs`.
The harness re-derives every row on each run and prints a replacement block if any has moved, which
is the property that makes a committed table safer than a formula rather than lazier: it cannot be
*approximately* right. The half-steps the slider lands on are interpolated, and that's checked too.

The slider runs **4 to 12 km/h and opens at 8**, which is also the pace every constant in the model
is tuned at — `windFor` is `pace / ref`, so the reference is where the wind is 1. Moving it moved
the whole range the physics sees, and `LIFE.inside` had to grow from 5 to 9 with it: at the bottom
of the range a parcel's transit is twice the reference's, and if that approaches its allowance the
population stops being uniform in age.

**Scroll deliberately doesn't drive the pace.** That's the reader's own variable, and the
interesting thing about it is that a harder pace makes *both* fabrics worse and the closed one much
worse: capacity goes as pace^0.85 while production goes linearly, which is Forchheimer's regime
written as one exponent. A story you can only watch is a diagram; one you can push on is an
instrument.

It's the one control on this page that is **not** persisted and not in the URL, and that's a point
of difference rather than an omission. The reel's dials and the background picker are *settings* —
someone decided them, and a link should carry that decision. This is an experiment you run while
you're here, and the section's copy is written against the reference pace, so a link that opened on
someone else's 19 km/h would put the headline figure next to a field that doesn't produce it.

It's a native `range`, restyled rather than replaced: arrow keys, Home, End, a screen reader and a
touch drag all come free, and every one of them is a thing a custom thumb gets wrong.

### The knit is a mesh, and it took five goes

Filaments crossing on the diagonal — a zig-zag down each face of the membrane, the two out of
phase so they cross in the middle, alternated per run so consecutive runs don't line their
diagonals up into one long chevron.

**It was a chain of circles first**, on the reasoning that a cross-section cuts across yarn and
yarn in section is round. The geometry was right and the picture was of beads on a wire. Then it
was four shapes on a switcher — interlocking loops, a plain rounded rib, a plied twist, and this —
all of them treating the frame as a magnified *elevation*, where what you see is yarn passing
through itself. The other three are deleted rather than left switchable, because a renderer nobody
has chosen is a renderer nobody maintains.

The physics never cared: a pore is a gap of a given height and total capacity is `CAP × porosity`
however the solid parts between them are shaped. What the shapes did have to share is a constraint
— **a filament wider than the gap next to it closes that gap up**, and then both knits read as one
continuous run and the section has no picture left. `GAUGE` has to stay under the narrower of the
two pore heights, which is what sets the pore counts as much as it sets the thickness.

### The picture, and five things that were built twice

Additively composited on a near-black channel, like the point cloud. Brightness is temperature, in
one ink, and streak length is the parcel's own velocity — so a jet through a pore draws long and one
queued against the membrane draws as a dot, with no separate parameter deciding which.

**Full-bleed cost a third of the backing resolution.** The channels used to sit in a 1180px frame
with a tag column to their left and a figure column to their right, which put the diagram — the
entire content — in about two thirds of the width. Edge to edge there is no margin left to hold a
column in, so both moved *over* the picture into corners a 1440px channel has going spare, and
then came off altogether. What the bleed bought in composition it charged for in fill rate: at a
2× backing ratio each channel is 2880 × 486 device pixels and the pair measured 8ms a frame
against 3.5. `MAX_DPR` is 1.5 here rather than the point cloud's 2 — every mark is a soft additive
stroke, and none has an edge that 1.5 can't carry.

**A full-bleed grid needs `minmax(0, 1fr)`, not `1fr`.** A grid track grows to its widest item's
min-content width, so one head row that couldn't shrink — four switcher pills beside a slider, at
390px — stretched the track to 443 and took both channels off the side of the window with it.
`fabric.sh` asserts the canvas is the width of the viewport, which is how that surfaced.

**A colour ramp from cyan to coral needs a stop below the temperature air enters at**, because the
two interpolate through grey at the midpoint and a two-stop ramp came out neutral across the whole
field. Recorded because it was two passes of work and it is now deleted: the section is
monochrome.

**The membrane is drawn from `WALL` outward, not centred on it.** Refused particles are held a hair
upstream of `WALL`, so a membrane centred there had the whole hot boundary layer painted inside its
own yarn — the chain came out with a red line drawn down it and the openings stopped reading as
openings. Everything the fabric occupies is now downstream of the air that can't get past it. For
the same reason the vents' glow is clipped to the outside: unclipped, a glow near a pore reached
back through the gap and lit it, so the openings came out *brighter* than the yarn instead of
darker.

**The pore count is set by what a reader can count, not by what a fabric has.** Total capacity is
`CAP × porosity` however it's divided up, so the count changes nothing about the physics. Divided
finely, each pore came out narrower than the membrane is thick and both knits read as one
continuous chain of beads — same porosity, no visible difference. At three against eight the
openings are wider than the yarn and the answer to "how many ways out are there" is a number you
can see.

**The reveal adds beads rather than scaling the run.** Each chain grows out of its own middle at
full thickness. Scaling the extent is the obvious version and it draws a fabric out of specks: a
run at a third of its height has its bead radius clamped to a third of its thickness, so the first
half of the beat is a column of dots that then inflate. Knitting adds loops; it doesn't grow them.

### The frame budget set the density

Every particle costs two canvas path calls a frame, and path construction is what this section
spends its time on. At an emission of 420 the loop measured **~17ms a frame under a 4× CPU
throttle** — a mid-range laptop at 20fps. Nothing else moved the number: the pool size tracks it
linearly and rasterisation is under a millisecond of it.

So the density came down by half and is bought back with weight — a wider, brighter mark at half
the count reads about the same and costs half. Under the same throttle the loop is now
indistinguishable from the frame floor.

Lengthening the marks instead was the hope, and it doesn't work: coverage is count × length, and
a fifth more length cost as much rasterisation as the extra particles cost in path calls. Both
halves of coverage are paid for.

### Reduced motion

One settled frame, drawn once, and the pace slider still works.

The comparison is the content and the movement is the medium, so what this hands back is the
movement: the fields are run to steady state with nothing on screen — `settle()`, the same
function the harness measures — and then drawn. The still shows the numbers the moving version
would have arrived at rather than an early frame of them, and the section shortens from 380svh to
150 because the five beats were the only thing the distance was for. A slider drag re-settles from
scratch rather than continuing, which costs about ten milliseconds and buys reproducibility: the
same pace is always the same picture.

**`settle()`'s duration is not a free parameter.** It has to clear the longest life in the model —
`LIFE.inside` is 5s — or the field is still filling and every reading is low. At 2.6 the closed
channel measured a little over half its true steady-state population, which reads as a fabric
doing rather better than it does.

## Type

Everything technical is set in **Saans Mono** — the call-out labels, the measurement frame's
numbers, the plate's HUD and leader lines, the editor's source dump. One `--mono` token, so the
annotation voice is one decision rather than four. The page's own chrome stays on the system sans
stack: it's UI, not part of the drawing.

Shipped as WOFF2 at 44KB, repackaged from the supplied 94KB `.otf`. That's a lossless container
swap, not a re-render — the round trip decompresses byte-for-byte back to the original 93,760 with
every table, name record and all 505 mapped glyphs intact. CFF outlines are the case WOFF2
compresses hardest, hence 53%. The conversion used `wawoff2` installed with `--no-save` and removed
after, so the app's own dependency list didn't grow for it.

The face's own OS/2 weight class is **380**, a little lighter than a normal regular. It's declared
as 400 so `font-weight: normal` finds it, but it does read finer than the system mono it replaced —
which the annotations can afford now the default wall is Paper and the ink is near-black, and would
be worth re-checking against Ember.

**The stage waits for it.** `font-display: block` keeps the fallback from ever being shown, because
each shelf is the label's own border and therefore exactly as wide as its text — swapping faces
would visibly resize the rule under every call-out. The gate in `lib/preload.ts` is what makes that
invisible rather than a 3-second hold, and it also stops the verification scripts racing a font
load, since they screenshot shortly after `.loading` clears.

That gate calls `document.fonts.load()` explicitly and *then* awaits `document.fonts.ready`, which
is the part worth remembering: `ready` resolves once **pending** loads finish, and at gate time
there are none — the only elements set in Saans Mono are inside the stage, which is the thing being
gated. Awaiting `ready` alone would resolve instantly and the font would arrive afterwards, exactly
the flash the gate exists to prevent.

The preload in `index.html` carries `crossorigin` even though the file is same-origin. Fonts fetch
in CORS mode, and without it the preload lands in a different cache partition and the file is
fetched twice — verified as a single request.

**Two more faces, and they are two cuts of the same family.** Both are display bold, both set
exactly one thing, and they are not interchangeable — swapping either for the other would change a
composition that was settled against it.

**Saans Display Bold** is the colourway wordmark: the tighter cut, and the one the letter-swap's
per-letter windows were measured against, since their widths come from the face. Preloaded
alongside the mono, so in practice the swap has happened long before the section is scrolled to.

**Lululemon Saans Bold**, 56KB, is the reel's headline: the wider cut, supplied for it. Not
preloaded and not in the gate — it's further down again, in a section that can be switched off, so
gating the shoe on it would charge every visitor for it. `lib/preload.ts` starts its fetch as soon
as the stage's own gate clears, which is a minute of reading before anyone reaches the reel.

Both get `font-display: swap`, the opposite call to the mono's `block`, for the same two reasons in
both cases. Nothing is measured off either at layout time, so the worst a late arrival does is
reflow a word nobody is reading yet. And both sit two or more viewports below the fold, where
`block`'s invisible-text period would be spent on an empty screen — and its timeout would be the
only way anyone saw the text at all if the file failed. Their fallbacks are the heaviest grotesques
the platforms have, because what has to survive a missing file is the **weight**: display type set
in a regular reads as a mistake, where the wrong bold grotesque reads as a substitution.

They sit on separate tokens for that reason — `--display` for the wordmark, `--headline` for the
reel — so neither can quietly become the other.

## The images

Two 1536×1024 RGBA cutouts: 44% solid shoe, 2.4% feathered edge, 54% clear. The shoe has no
backdrop of its own, which changes three things fundamentally:

- **The page background *is* the photograph's background.** Changing it changes the shot, so the
  colour control isn't chrome — it's part of the image.
- **Outside the silhouette there is nothing in either image**, so blending there is a literal
  no-op. The reveal's seam only ever lands on shoe.
- **Layers can be transformed independently.** The previous pair had a studio backdrop baked
  into the pixels, so moving one layer tore the background against the other. With cutouts
  there's nothing to tear — which is what makes the registration fix below possible.

`node scripts/measure.mjs` derives every constant in `src/lib/shoe.ts` from the pair:

```
canvas         1536x1024  (1536/1024 = 1.5000)
matte          53.8% clear · 2.4% feathered edge · 43.9% solid
silhouette A   (30,200)-(1518,893)   1488x693
silhouette B   (36,192)-(1515,905)   1479x713
registration   silhouettes disagree over 4.52% of their area uncorrected,
               2.07% after scaleY 0.97 + translate (-6, 10)px about (774, 196).
difference     x 30..1509 (2%..98.2%)  focus (704, 569) = 45.8%, 55.6%
shoe red       #e34e57  (mean of 126331 chromatic red pixels)
```

### Registration

These two were cut out separately and don't agree the way the previous pair did. Their tops
align to within ~5px but the section's sole sits ~12px lower along its whole length — the shoe
is 2.9% taller, so **no translation fixes both ends**. A 0.97 vertical squash does
(`END_FIT` in `shoe.ts`), taking silhouette disagreement from 4.52% of its area to 2.07%;
measured on the sole line alone, the median offset goes from −12px to −1px.

The residual ~7px spread along the sole is genuine shape difference between the two renders and
can't be transformed away. It doesn't matter here: it's spread across a 370px-wide soft front,
so there's no edge for it to show at. Press `d` then `x` to see it — the difference view shows a
pure black background, a hairline rim, and bright interior, which is the transition's subject.

## Background colour

Swatches in the top bar, plus a colour input for anything else. The choice persists in
`localStorage`, and `?bg=1d1616` pins it (used by the screenshot scripts).

Two groups doing two different jobs.

**Neutrals** are for judging the product honestly: one near-black, two at the light end.

| | | |
| --- | --- | --- |
| Ember | `#1d1616` | |
| Bone | `#e3d9d9` | |
| **Paper** | `#f7f3f3` | **default** — the lightest swatch in the set |

**Pops** are six hues at 20% saturation and 80% lightness.

| | | |
| --- | --- | --- |
| Amber | `#d6cec2` | 36° |
| Acid | `#ced6c2` | 84° |
| Jade | `#c2d6ce` | 156° |
| Azure | `#c2ced6` | 204° |
| Iris | `#cec2d6` | 276° |
| Fuchsia | `#d6c2ce` | 324° |

They hold the hues the palette originally found by permuting `#8e1adb`'s own channel values —
roughly even spacing, alternating 48° and 72° — and fixing S and L keeps a structure worth having.
Convert `hsl(h 20% 80%)` back to 8-bit and you land on the six permutations of `c2`, `ce` and `d6`:
the same "one triple, six arrangements" property the full-chroma version had, which isn't a
coincidence but what holding two of the three HSL terms fixed while stepping hue produces. (The
round trip reads 19.6% rather than 20% — that's 8-bit rounding, not a different intent.)

At this saturation they're near-neutral, which is the point. Full chroma behind a coral shoe was a
decision about the page; a tint is a decision about the wall. It also flattens the luminance problem
the full-chroma set had — green carried most of it, so Acid and Jade sat far brighter than Iris —
because every one of them is now at the same lightness by construction.

**Paper is the default**, replacing the near-black Ember. The trade runs opposite: on a light wall
the near-black outsole and the dark plate separate cleanly, where against `#1d1616` the outsole
disappeared into the page; what it costs is the white foam, which no longer has anything to be white
against. Both are one click away, and Paper is what the product is normally photographed on. It also
flips the call-out ink to dark via `data-bg-light`, which is what that flag exists for.

Earlier still, the palette ran a ramp of five warm browns holding the shoe's own red hue —
`hsl(356.4)`, measured as the mean of 126k chromatic red pixels — at 9–18% saturation. They read as
one wall at five brightnesses, which is four more than a picker needs.

Chrome carries its own dark translucent background rather than sitting on a page-wide scrim, so
it stays legible against every one of these.

## Everything is confined to the silhouette

`.on-shoe` masks a layer with the photograph's own alpha (`mask-mode` for an image defaults to
alpha). The wash uses it, because on a flat background anything that lands off the shoe has
nothing to act on and reads as a band dragged across the page — obvious in a way it never was
against a textured backdrop. Unmasked, the wash's blur bleeds a soft bright rim outside the
silhouette that comes and goes with the transition, which reads as a bad cutout rather than as a
glow; remove `on-shoe` from the wash in `XRayDissolve.tsx` to get the halo back.

Two structural notes, kept here because they cost real time to work out and will bite again if
anything moving is added back:

- **A mask travels with its element's transform.** Masking a moving sprite drags the shoe-shaped
  hole along with it; the mask has to sit on a static wrapper with the sprite moving inside.
- **A mask creates a stacking context**, so a `mix-blend-mode` inside one composites against the
  wrapper instead of against the photographs. The blend mode belongs on the wrapper.
- **Two masks on one layer means two elements.** The scan rules need both the silhouette and a
  window travelling with the front. `mask-composite` would do that on a single element, but it's
  the corner of the masking spec with the least agreement between engines, and nesting — matte on
  the wrapper, window on the child — needs none of its power.

The scan rules themselves are **dark**, which is the opposite of the intuition. Light rules read
beautifully on the blueprint and are invisible on the shoe, because most of what the front
crosses is white foam and white knit. The blueprint's own deep blue reads on every part of the
specimen except the outsole, which is small and already black.

## Debug

`d` panel · `x` difference blend · `g` geometry · `c` call-outs · `e` call-out placement

URL params pin any frame: `?p=0.45`, plus `&bg=`, `&c=0`, `&edit=1`, `&diff=1&gain=4`, `&grid=1`,
`&debug=1`, and `&nx=&ny=` to nudge the section layer on top of `END_FIT`.

The film takes `&clip=0` to drop it and `&cv=` to shorten its pin, both read once at load like
`?reel=`.

The two panels take opposite bottom corners so both can be open at once — placing a call-out and
scrubbing the progress are the same job. The editor moves to the top left of that, because both
call-out shelves live in the lower left of the stage and a panel there covers the thing it exists to
position.

`c` isn't only a convenience. All the chrome recedes as soon as you scroll, so the switch itself is
gone by the time the call-outs are doing anything — the key is how you compare annotated against
bare at a frame you're actually looking at.

## Verification

Playwright comes from the npx cache rather than the dependency list.

```
scripts/verify.sh   # scroll really reaches both end states; end states are the clean photos
scripts/perf.sh     # does the transition trigger layout?
scripts/reel.sh     # does every column of the reel paint, and does the room change?
                    #   W=390 H=844 for the three-column form · STEPS=
scripts/sections.sh # does the page reorder, does the copy arrive, do the answers fold?
                    #   W=390 H=844 for the one-column form
scripts/clip.sh     # does the film play once at 75%, and does its frame close and reopen?
                    #   W=390 H=844 for the phone encode
scripts/air.sh      # what do the two wind tunnels settle at, and is the airflow ratio still
                    #   the porosity ratio? No browser — it runs lib/air.ts under node
scripts/fabric.sh   # do the channels draw, and are the figures on screen the fields' own?
                    #   REDUCED=1 · KNIT=2 for the ribs · W=390 H=844
scripts/shots.sh    # screenshot at fixed points → .context/shots
                    #   FULL=1 includes the chrome · EXTRA='&bg=e3d9d9' · REDUCED=1 · W= H=
scripts/showzero.sh # the fabric hero: pinned frames reproduce, the spray dries, b stays clean
```

`verify.sh` matters because the debug scrubber and the scroll path share everything downstream
of `useStageProgress` — the transition can look perfect under `?p=` while dead zones, easing or
the spring leave real scrolling short of 0 or 1. It scrolls for real and compares against the
scrubbed reference. Both variants currently match exactly:

```
variant  end      scrolled vs scrubbed (mean |diff| of 255)
   1     start   0.000  ok
   1     end     0.000  ok
   2     start   0.000  ok
   2     end     0.000  ok

end states are the bare photographs (vs reduced motion) · 1 exempt via cleanEnds:false
   1     start   0.000  ok
   1     end     0.000  ok
```

**Both scripts run to the end of the stage's own section, not to the bottom of the document.**
That distinction didn't exist while the reveal was the whole page. Now there's a colourway section
below it, and the bottom of the document is a viewport of something else: `perf.sh` would spend a
share of its steps measuring static page and thin out the ones over the reveal, and `verify.sh`
would be relying on Playwright scrolling the sticky stage back into view to land on `p = 1`. That
recovery happens to be exact — the minimum scroll that brings a sticky element back is the end of
its own range — but it's a coincidence of this page's proportions, and a colourway section two
viewports tall would quietly start photographing the reveal mid-flight. The section is what the
timeline is measured against, so that's what both now measure.

The second check changed shape. It used to prove end states were clean *transitively* — make
every variant agree with variant 1, whose own ends were bare by inspection — which only asserted
anything while two or more variants were registered, and went silent the moment the registry was
down to one. A check that can be disarmed by deleting the thing it compares against isn't much of
a check. The reference is now `prefers-reduced-motion`, which collapses these variants to
`Crossfade`: two photographs and an opacity, with nothing that could leave residue. Each variant
is compared against its own reduced form, so the assertion holds however many exist.

The section plate publishes `cleanEnds: false` and is exempt **from that check only**. Its
treated state is the design and has to survive at `p = 1`. It still has to reach both ends by
scroll alone, which is the check that catches easing and spring bugs.

The x-ray keeps `cleanEnds: true` with its call-outs switched on, which is worth being precise
about. What the check compares is a variant against its *own* reduced-motion form, so it's about
residue — grades, washes and sprites the transition forgot to put away — not about the frame being
empty. The call-outs are content, deliberately up at both ends, and present in the reduced form
too; because that form is built from the same component with the same geometry, the two agree to
`0.000` at both ends. An overlay that only appeared in the full render would still fail, which is
the property worth keeping.

`perf.sh` measures the design question directly, via Chrome's own counters:

```
variant           layouts  layout ms  restyles  restyle ms  frames
X-ray                  5        0.4       117         7.6      91
Sketch                12        1.0       110         9.2      91
```

The dissolve itself is exactly zero; the handful on the x-ray is the call-out layer. **Read the
magnitude, not the digit** — the same build measures anywhere from 4 to 10 run to run, so a change of
one or two means nothing on its own. Two things are stable and are what the number is for:

- **They don't scale with frames.** Measured across 45, 90, 180 and 360 scroll steps the count stays
  flat while restyles rise with the frames. So they're the boundaries where a mark's values start and
  stop changing, not a cost paid every frame — which is the actual design question.
- **They're attributable.** Remove the layer and the dissolve measures 0 again.

Under a millisecond across an entire scroll either way. Chasing the rest would mean `will-change` on
the leaders, and the plate already tried that trade: it bought two layouts in exchange for four
permanent compositor layers and was reverted.

The plate's ~11 layouts across a full scroll — 0.01ms a frame — are what's left after the digit
wheels and leader lines were rebuilt; it was 80 before, and each remaining one costs less than a
tenth of what the style pass does. `will-change` appears in exactly two places here and both were
measured.

These counters don't cover raster/composite, which happens off the main thread; a DevTools
Performance recording on the target machine is still the final word on frame rate. The point
cloud in particular is ~12 000 stroked segments a frame, batched into 16 paths by colour and
alpha, and that cost lands in raster where this doesn't see it.

`verify.sh` and `perf.sh` enumerate variants from `document.documentElement.dataset.variants`,
published by `App.tsx`, alongside `dataset.cleanEnds`. They used to count switcher pills, which
broke the moment the switcher came out.

`reel.sh` exists because the reel's failures are silent in the DOM. A `<video>` that is playing —
`readyState` 4, `paused` false, `videoWidth` set, `error` null — and painting nothing looks
identical from script to one painting footage. So it screenshots the section across its own
timeline and samples the middle of every tile substantially inside the window, out of the pixels
the page actually produced:

```
reel · 1440×900 · 6 columns · rules 60–120, type 120–160, tiles 140–260,
                              invert 425–745, exit 810–940, pin ends 940

   svh   showing  dimmest tile  room       rules  head  room top  next
  90        0/6          0.0  8, 8, 10     70%  0.00        90     0%
  120       0/6          0.0  8, 8, 10    100%  0.00         0     0%
  160       1/6        196.0  8, 8, 10    100%  1.00         0     0%
  200       3/6         54.5  8, 8, 10    100%  1.00         0     0%
  280       5/6         80.5  8, 8, 10    100%  1.00         0     0%
  340       4/6         65.0  8, 8, 10    100%  1.00         0     0%
  400       1/6        126.8  8, 8, 10    100%  1.00         0     0%
  440       0/6          0.0  9, 9, 11    100%  1.00         0     0%
  500       0/6          0.0  27, 27, 29   100%  1.00         0     0%
  580       0/6          0.0  125, 125, 126   100%  1.00         0     0%
  660       0/6          0.0  235, 235, 235   100%  1.00         0     0%
  745       0/6          0.0  255, 255, 255   100%  1.00         0     0%
  810       0/6          0.0  255, 255, 255   100%  1.00         0     0%
  875       0/6          0.0  255, 255, 255   100%  1.00      -293     0%
  940       0/6          0.0  255, 255, 255   100%  1.00      -585     0%
  1040      0/6          0.0  255, 255, 255   100%  1.00     -1485   100%

phases
   ok    arrives empty                          0 tiles on screen
   ok    arrives dark                           rgb(8, 8, 10)
   ok    rules grow on the way in               tallest 97%
   ok    and they are staggered                 spread 66%
   ok    headline waits for them                opacity 0.00
   ok    rules finish first                     shortest 100%
   ok    headline still holding                 opacity 0.00
   ok    nothing on screen before the wall      0 tiles
   ok    headline lands                         opacity 1.00
   ok    footage gone as the room lifts         0 tiles
   ok    and it is still nearly black           rgb(52, 52, 54)
   ok    headline stays put                     opacity 1.00
   ok    type is light on the dark room         lightest 203 of 255
   ok    turns white                            rgb(255, 255, 255)
   ok    still pinned                           room top 0px
   ok    headline is still there                opacity 1.00
   ok    type went dark with the room           darkest 0 of 255
   ok    room behind it is white                lightest 255
   ok    leaves at about half page speed        33svh moved per 65 scrolled
   ok    room has left the window               room bottom -585px
   ok    headline went with it                  head bottom -948px
   ok    next section has the window            100% of it
```

It asserts the phases as well as the paint, in the same `svh` the component is written in. Each
phase is only correct relative to the others, so each gets a plain assertion about one frame — no
tile on screen before the first arrival, four or more up just after the last, the room empty again by
the time the inversion starts, white when it ends, gone a viewport past the pin — and a tile arriving
early fails as loudly as one that never arrives. The frame sampled at 80 is the only one before the
pin, which is the only way to prove the rules grow on the way *in* rather than after the section
lands — and the spread between the tallest and the shortest at that frame is the evidence that
they're staggered rather than drawing in unison.

The three checks around the opening are an *ordering*: the headline is at zero while the rules are
still growing, still at zero when the last one lands, and at one by the time the first tile is due.
That sequence is the request, and it's the kind of thing that quietly stops being true the next time
a window gets nudged.

**None of those numbers are in the script.** Two of them are sliders, so `Reel.tsx` publishes its
resolved timeline as JSON on `document.documentElement.dataset.reel` and the check reads it — the
same arrangement as `dataset.variants`, and for the same reason: the check states the invariants, the
page states the numbers. Every frame it samples is derived from that, including the mid-growth frame
for the stagger and the midpoint of the exit for the rate, so moving a dial moves the checks with it.

The one boundary that isn't published is the last tile's exit, because it depends on how tall a tile
is at the current column width and only the browser knows that. So the emptiness assertion is placed
a third of the way into the inversion rather than at its start: the dial *can* be set to overlap the
drain — at 425 it is, by about 10svh — and what the check is for is the part that isn't a judgement,
which is that no footage is left on a room that has visibly changed.

**The exit's rate is checked, not just its outcome.** Halfway through the window the room should have
travelled a quarter of a viewport for the half a viewport scrolled. That ratio is the entire reason
the exit is a transform instead of a released sticky, so it's the thing worth asserting — the
outcome (gone by the end) was true of the old version too.

**The inversion is only observable in pixels.** The headline's colour never changes: it's a fixed
white `difference` layer, so the type going from light to dark is the *backdrop* changing, and
`getComputedStyle` says the same thing at both ends. So those two checks read the extremes inside the
headline's own box rather than its mean — the box is glyphs and room, so its average says almost
nothing. On the dark room the lightest thing in it is 247; on the white room the darkest is 0. That
pair is the assertion.

It earned itself within a minute of being written. `valley` is cut from a 37-second source, and the
first trim ran 1.6 seconds past the end of the shot into the source's own fade to black — so every
loop of that column ended dark, in two columns at once while it was still a two-tile design. It
read as a compositing failure and was very nearly written up as one. Nothing but the pixels said
otherwise. Every clip has since been scanned frame by frame for the same thing; the darkest single
frame across the six measures 53.

The thresholds are deliberately loose. A tile counts as showing once a fifth of it is inside the
window, and half the columns have to be up 20svh after the last one arrives — they arrive and leave
at six different times by design, so that catches the starts and the speeds drifting out of tune with
each other rather than holding a composition. The luminance floor is 12 against a darkest real frame
of 53: it's looking for the black backing behind a video, not for a dark scene.

**`verify.sh` hides the chrome before it shoots.** Every screenshot in it is an element shot of
`.stage`, and for a long time that excluded the page's furniture by geometry alone: the stage is
1152px of a 1440px window, so the picker at the top and the hint at the bottom both fall outside it.
That was a coincidence of the proportions, and the section-order panel is what broke it — 190px wide
against 144px of margin, so it lands in the shot, and it's *up* in a scrubbed reference (scroll is at
zero) and receded in a scrolled one. 2.9 of mean difference, in a check whose tolerance is 1.0 and
whose entire job is to notice a difference that size. One `display: none` on the chrome is what the
check meant all along, and it stops every future panel being a proportions problem.

`sections.sh` covers the three things about the newest sections that are easy to break and quiet
about it.

**The order**, by comparing what `App.tsx` publishes on `dataset.sections` against the actual DOM
order of the section elements. Those two agreeing *is* the feature — a render that dropped a
section, or a `key` that put content into the wrong node, shows up there and nowhere else. It drags a
row with the mouse, moves one with the arrow keys, reloads to prove the save, and then loads a link
to prove the link wins.

**The accordion**, by height. A closed answer is unmounted, so "closed" is a DOM assertion; an open
one is animated from `height: 0` to `auto`, so "open" has to be measured — an `auto` that resolved
wrong lands the answer on the page at no height, which reads exactly like a row that didn't open. It
also checks that opening a second answer closes the first, and that reduced motion gets the answer
after 120ms rather than a fold.

**The prose reveal**, because it's scroll-linked opacity and can be left parked at 0 — a section that
never fades in is indistinguishable from an empty one, and the copy is the section.

Two of its own bugs are worth recording, because both were the check being wrong rather than the
page. Every frame it loads now names the order it wants in the URL: the panel *saves* what it's set
to, one browser context runs every block, and a step that ended on a dragged order was silently the
starting state of the next one. And the FAQ is read where it actually lives, last and scrolled to,
rather than dragged to the top — at a phone width the stacked top bar and the panel under it cover
the first two questions, and Playwright reported a colour swatch intercepting the click, which is
exactly what a thumb would have found.

`air.sh` and `fabric.sh` split the airflow section down the middle, and the split is the point.

`air.sh` is the only check here with no browser in it. It compiles `lib/air.ts` on its own with
`tsc` and runs the model under node — which is why that file has no imports and no DOM in it, and
why `clamp` is redeclared at the foot of it rather than taken from `lib/remap`: `tsc` emits an
extensionless import that node can't resolve, and one duplicated line is cheaper than a build step
for a physics module. What it's for is the four things about a live field that a screenshot can't
tell you:

- **The pool filling.** `dropped > 0` means the emitter was refused, which turns every figure on
  screen into a measurement of a clamp rather than of a fabric. It has to be zero across the whole
  pace range, not just at the reference.
- **The airflow ratio drifting off the porosity ratio.** That equality *is* the section's claim, and
  it's the thing that quietly stops being true — a wandering particle finding its own way through,
  a capacity constant that has crept above the arrival rate.
- **The readout constants.** `RISE` converts a measured load into degrees, and the only honest way
  to pick it is against the loads this prints. The open reference channel, which is where the floor
  it subtracts comes from, is defined in the script rather than in the page.
- **Determinism.** Two runs from the same seed have to agree exactly, or reduced motion's settled
  frame isn't reproducible and neither is anything built on it.

`fabric.sh` is the other half, and every one of its failures looks like a working page. A channel
whose `ResizeObserver` never fired leaves a 0 × 0 backing store — the axis, the slider and the
figures all render and the diagram is simply absent. Nothing gates the section on scroll any more,
so "it starts when you reach it" isn't a thing that can be checked; what can is that there is air
in *both* channels without anybody having touched anything, and that the open knit's is the busier
one — the whole picture in one number. Then it drives the slider with the arrow keys, because
that's the path a custom thumb would have broken and it's exact, and checks four things at once:
the figures move, the text matches what the component published, the *fields* moved too (the ref
the loop reads and the value the figures use are two paths to one number and can come apart), and
the running fields still agree with the solved headline.

**Neither of the other two scripts scrolls the document any more, and only one of them switches
anything off.** Both `verify.sh` and `perf.sh` run to the end of the *stage's own section*, which is
what the variant's timeline is measured against — with nine viewports of reel and colourways below
it, "the bottom of the page" stopped meaning `p = 1` some time ago. Scoped that way, `verify.sh`
needs nothing disabled: it verifies the page as it ships.

`perf.sh` still passes `reel=0` and `frames=0`, for a reason the scoping doesn't cover. The reel's
videos start playing when its section is within half a viewport, and the scrub starts fetching 4.6MB
when its own is within one and a half — both of which the last few steps of that sweep are. Leaving
either mounted would put a decoder on the main thread over the frames being counted and attribute its
cost to the variant. Neither exclusion is a gap in coverage — that's what `reel.sh` and `clip.sh`
are for — they're statements about what those two scripts are measuring.

## Known limits

- **The airflow figures are a committed table and the picture is a simulation, and the two are only
  checked to agree — they are not the same computation.** `CURVE` is nine rows of settled steady
  state pasted into the source; the fields are a finite pool of parcels realising the same model
  live. `air.sh` re-derives the table on every run and fails on any drift, which is the only thing
  standing between the page and quoting a number its own picture disagrees with.
- **One press of the spray only ever brings two of the four sweat zones up.** The default moisture
  per press is 0.4 and the zones' onsets are 0.02, 0.22, 0.45 and 0.62, so the last two never
  trigger and the first two arrive at partial size. A second press stacks and gets there. The dial
  and the onsets are independent knobs and either would fix it — a higher default, or onsets
  rescaled into the range one press covers — and which of the two is right is a decision about what
  a single press is supposed to mean.
- **The temperatures are a real measurement through an invented conversion.** `load` is read off
  the field; the degrees are `RISE × load` with `RISE` chosen by eye to land a plausible
  microclimate figure. The ratio between the two channels is the model's; the absolute values on
  screen are not claims about a fabric, and neither are the two porosities they come from.
- **Three pores against eight is a drawing decision, not a fabric.** Total capacity is
  `CAP × porosity` however it's divided up, so the physics is indifferent — but a real knit has
  thousands of openings across the width of this view, and this one has enough to count. The
  section is honest about being a diagram; it is not a micrograph.
- **Nothing in the airflow section names which channel is which.** The tags came off with the rest
  of the type over the picture, so which one is the new fabric is carried by reading order and by
  the figures being phrased as a comparison. One word per channel is the fix and type back over
  the diagram is the cost.
- **The airflow section runs a rAF loop for as long as it is on screen**, which on a display left
  on all day is all day. Two fields at ~1 200 parcels each measured ~17ms a frame under a 4× CPU
  throttle, so it holds 60fps on the hardware it's aimed at — but it is the one thing on this page
  that never idles, and `frameloop="demand"` is not available to it the way it is to the cloth.

- **The film's frame is 16:9 and the window isn't.** `object-fit: cover` crops from the centre, so a
  portrait phone shows a much tighter slice than a desktop window does — the shoe fills it and the
  lake goes. It reads as a deliberate close-up rather than as a mistake, but it is a different shot,
  and `contain` under a portrait query is a one-line change if that stops being the trade you want.
- **A refused autoplay leaves a still.** Muted inline playback is allowed without a gesture, but Low
  Power Mode can decline it, and the section then holds its poster with the readout parked at frame
  0. Survivable by design, and indistinguishable from a slow network at a glance.
- **Reduced motion ghosts at the collar.** The cut collapses to a scroll-linked opacity crossfade
  with no movement, which is the right trade, but the collar and heel counter genuinely differ
  between the renders and a crossfade has no motion to hide that. The plate keeps its blueprint,
  frame and callouts under reduced motion — they arrive as one opacity ramp instead of drawing —
  because reduced motion should mean gentler, not "you don't get the instrument". What it loses
  is the point cloud, which is nothing but movement.
- **The point cloud freezes when you stop scrolling.** A consequence of every position being a
  function of `p` and not of time. It's defensible as a held frame, but it is a choice, and
  reintroducing a clock term would cost the pixel-exact `verify.sh` comparison.
- **The reel's wall is never full, by design, and the tail is thin.** With arrivals 28svh apart and
  every clip shown once, the most that is ever on screen at one time is four of six, and from 336 to
  415 it's down to two and then one — a single small 16:9 tile crossing a large black room. That
  drain is the phase the request asked for, and the cascade is what makes the section legible rather
  than busy, but the last 80svh of it are the weakest stretch in the page. Tightening it means
  shortening the arrival spacing, which is the thing that made it calm.
- **Only three of the six clips are ever seen on a phone.** Columns are dropped from the end below
  640px, so `valley`, `uphill` and `rest` never render there. Dropping from the end is what keeps
  the composition predictable, but which clips get dropped is currently an accident of registry
  order rather than a decision about the edit.
- **The headline all but vanishes at the midpoint of the inversion.** It's a `difference` layer, so
  its rendered ink is `|room − white|`, and when the room is mid-grey so is the type — about 1.25:1
  against its own backdrop. This is not a bug in the blend; it's arithmetic, and *every* continuous
  simultaneous inversion has it. Interpolating an opaque ink the other way puts both at the same grey
  too, and stepping the ink (which is what this did before) keeps the contrast but is no longer
  "transition them at the same time". The mitigation is speed: `easeInOutCubic` is steepest in the
  middle, so the crossing takes ~5svh of the 50 — about a third of a wheel tick — and a screenshot is
  the only way to catch it looking washed.
- **`difference` can be locally illegible over mid-grey footage.** A road, pavement or overcast sky
  under a glyph renders that glyph as near the same grey. It's rare in this set — the clips are
  mostly bright or dark — and it moves, so it never sits on one letter for long. A flat ink with a
  halo would be safer and would give up the whole reason for the blend.
- **The reel is 940svh of pin plus a viewport of tail**, and four decisions made it that long:
  slowing the columns so they can be read (nothing is faster than 0.95, and every tile has to clear
  the top before the room can empty), giving the opening its own 100svh before the wall starts,
  taking the room out at half speed rather than letting the sticky release do it for nothing, and —
  the largest single item — spending 320svh on the inversion, a third of the whole section. The
  last 100svh — after the room has gone and before the colourways arrive — is empty page either
  way, which is the one stretch here that is genuinely just distance. Reduced motion
  cuts the pin to 220svh, which is the floor: under that the opening and the inversion collide.
- **The inversion overlaps the drain, and how much depends on the aspect ratio.** It's dialled to
  425 and the slowest column leaves at 435, so the room starts lifting off black with the last tile
  still crossing — deliberately, by eye. The overlap isn't a fixed 10svh though: a tile's height is a
  share of its column's width, so a wide short window makes every tile taller in `svh` and clears
  later. At 2560×800 the last exit is nearer 460 and `scripts/reel.sh` reports it as a failure at
  *footage gone as the room lifts*, which is the check doing its job rather than a bug in it. Dial
  **Invert** to 445 for a setting that's clean at every aspect, at the cost of the ending arriving
  20svh later.
- **The prose and the FAQ copy is invented.** Plausible about this shoe, not true about it — see
  the note in that section. It's the largest block of unverified claims on the page, and unlike the
  call-out labels it isn't anchored to anything in a photograph.
- **Re-ordering the page can put a section somewhere it doesn't read.** The panel will happily drag
  the FAQ above the x-ray, and every section still *works* there — but the reel's dark room arriving
  over the colourways, or the FAQ opening the page, are arrangements nobody designed. The default is
  the reading; the panel is for trying alternatives, not for shipping one.
- **The section panel covers the top of a section that is dragged to the top.** It recedes on the
  first scroll, so it's only in the way at the very top of the document — but at a phone width the
  stacked top bar and the panel together cover about 300px, which is the first two rows of the FAQ
  if the FAQ has been dragged first. `sections.sh` hit exactly this and reads the FAQ where it
  normally lives instead.
- **The dials are two of about a dozen numbers that shape the section.** The column speeds, the
  arrival spacing, the 30svh of held black and the 50svh of inversion are all still constants —
  which is a judgement about which ones can't be settled without scrolling, not a claim that the
  rest are right. Anything that needs a third slider probably needs the panel rethought rather than
  extended.
- **Autoplay can be refused**, and the reel then rises six stills past the headline instead of six
  clips. The posters are the clips' own first frames so the composition is intact and the parallax
  still runs, but nothing announces that the footage isn't playing — worth knowing before concluding
  a clip is broken.
- **Nothing checks the inertia.** `reel.sh` waits 1.4s at each point precisely so the springs have
  settled before it looks, which means the one thing a viewer feels most — six columns carrying past
  the wheel and settling at different times — is the one thing verified only by eye. Asserting it
  would mean sampling mid-flight, and mid-flight is exactly when the numbers are meaningless.
- **Retina sharpness.** The masters are 1536×1024 and the stage caps at 1180 CSS px, so on a 2×
  display the shoe is still upsampled about 1.6×.
- **Portrait shows a small shoe**, and smaller still on the plate, which gives up the 1.1 camera
  push to keep room for its axis numbers. A 3:2 master in a portrait viewport is small whatever
  we do, and cropping the product would be worse.
- **Every callout target is eyeballed.** The plate's four and the x-ray's eight are placed by
  reading the photographs, not derived by `measure.mjs` like everything else in `lib/shoe.ts`.
  They'd need re-checking against a re-shoot, and unlike the rest of the geometry nothing would
  fail loudly if they weren't — a target on the wrong material renders exactly as confidently as
  one on the right material. `?edit=1` makes re-placing the x-ray's cheap; the plate's four are
  still constants in `lab/Callouts.tsx` with no editor.
- **The labels describe what's visible**, not a spec — an engineered knit, a sueded eyestay, a
  midsole sidewall, expanded beads, an embedded plate, a heel unit. Read off magnified crops of the
  photographs, so they're honest about what's in frame and say nothing about what any of it is made
  of. Anything more specific would need to come from someone who knows the product.
- **A label at x ≈ 93 runs off the right edge on narrow viewports.** `Midsole sidewall` sits at
  `anchor: [92.6, 101.2]` and text flows right from its anchor, so it needs ~13% of stage width that
  isn't there. Fine at 1280×800 and up; measured 54px off-screen at 1000×1200, where the portrait
  camera push also scales the type 1.1×. An anchor around x = 87 would clear it.
- **~6.2MB of unoptimised PNGs** — 4.4MB of stage photographs and 1.8MB of colourway cutouts —
  and one is also fetched as a CSS mask (same URL, so it's the same decoded image, not a second
  download). Needs WebP/AVIF via `sharp` before this goes anywhere real: alpha survives both.
  The colourways are the worse offenders per pixel, because `colorways.mjs` writes true-colour
  RGBA where the sources were indexed — 380KB each for a 308×760 thumbnail, against 300KB for the
  1376×768 original it came from. Nothing in the pipeline needs them to be true-colour; a
  quantising encoder would take most of it back. They're at least `loading="lazy"`, a full
  viewport below the fold, so they don't compete with the two photographs the stage is gated on.
  The reel's 1.2MB of video is a quarter of the stage's two photographs and isn't fetched until
  you're nearly at it, which makes the still images the glaring ones — as do the fonts, the only
  assets here that *have* been optimised.
- **The reel ships one H.264 rendition and no WebM/AV1**, at one size for every viewport. A 432px
  clip in a 427px column on a 2× display is upsampled about 2×, which video hides better than a
  photograph would, but a `<source>` set is what this would want if it shipped.
- **~6.2MB of unoptimised PNGs** — 4.4MB of stage photographs and 1.8MB of colourway cutouts —
  and one is also fetched as a CSS mask (same URL, so it's the same decoded image, not a second
  download). Needs WebP/AVIF via `sharp` before this goes anywhere real: alpha survives both.
  The colourways are the worse offenders per pixel, because `colorways.mjs` writes true-colour
  RGBA where the sources were indexed — 380KB each for a 308×760 thumbnail, against 300KB for the
  1376×768 original it came from. Nothing in the pipeline needs them to be true-colour; a
  quantising encoder would take most of it back. They're at least `loading="lazy"`, a full
  viewport below the fold, so they don't compete with the two photographs the stage is gated on.
  The fonts are the one asset here that *has* been optimised, which makes the images the more
  glaring for it.
- **The colourway inks are tuned against two of the nine walls.** Ember and Paper — the extremes,
  and the two the page actually loads on — where every name clears 3.5:1. Against Bone and the six
  pops, which all sit around 0.65 luminance, the coloured names land between 2.3:1 and 3.1:1.
  Display sizes carry that better than body text does, and Eclipse Black clears 10:1 everywhere,
  but the honest statement is that the pair of inks is a two-point fit and the middle of the
  palette is where it's loosest. A third ink for mid-tone walls, or deriving the ink from the
  wall's luminance rather than from a boolean, would close it.
- **The strip has no hover on a touchscreen**, so a tap has to do both jobs: it focuses the tile,
  which sets the wordmark, and it pins it. That works, but the preview-then-commit distinction the
  pointer gets is collapsed, and a second tap on the same shoe unpins it while leaving it focused —
  the word stays, correctly, and there's nothing on screen saying which of the two states you're in.
- **The wordmark doesn't kern.** Twelve inline-blocks are twelve text runs, and nothing kerns
  across a box boundary, so every name is set slightly wider than the same string as one run — 5px
  on `mars red`, 12px on `lunar white`, at 120px type. The tracking is chosen for the unkerned
  rendering, which makes it a compensation rather than a fix. Doing it properly means measuring
  each letter's kerned offset off a hidden full-string copy and placing the cells absolutely, which
  is a measurement pass, a font-load dependency and a resize observer for a difference of half a
  pixel per pair.
- **The cursor mark's target is a rectangle, and the shoes aren't.** A tile is the closest thing to
  a silhouette available without hit-testing the matte, and it's wider than the shoe standing in it
  — at rest by about 16px a side. So the mark still appears slightly before the pointer is over
  anything, just by a margin now rather than by a region.
- **A leaning shoe nearly reaches its neighbour.** At rest there's 48px between adjacent
  silhouettes; picked up and leaning, the tightest gap measures 12px — on the side the shoe leans
  towards, against 37px on the other. It clears, but only by luck of the angles: this used to be a
  genuine overlap at the louder scale, and a colourway whose hash landed nearer 5° than 4.2° would
  put it back.
- **The row's size is held by a `vh` cap and three measured clearances**, which is a set of numbers
  that agree with each other rather than one number deriving the rest. Add a caption under the
  wordmark, or change the display face's metrics, and the tightest case — a short landscape window
  — starts clipping the top of the picked-up shoe, with nothing to say so.
- **The arrow says "go", and there's still nowhere for *it* to go.** The site has real pages now —
  the nav's three rows navigate, with history — but a colourway tile still pins a wordmark rather
  than opening a product, so that mark is promising a page the prototype doesn't have.
- **None of the three fonts is subsetted, and two of them are nearly the same file.** All 505
  glyphs of the mono ship for what is, in the annotations, uppercase Latin and digits; 77KB of
  Saans Display Bold ships for six lower-case names, nineteen distinct letters and a space; 56KB
  of Lululemon Saans Bold ships for one 27-character line. The two display cuts are the same
  family at different widths, which is defensible — each composition was measured against its own
  face — but it is 133KB to set two lines of type, and a page that wanted one voice for both would
  save all of the smaller file. Subsetting the mono is the fiddliest of the three: `--mono` is also
  what the editor's source dump is set in — braces, quotes, lowercase — so the safe character set
  is wider than the call-outs suggest, and getting it wrong fails silently as tofu in a debug
  panel.
- `.on-shoe` references `/shoe/start.png` absolutely, so a deploy under a sub-path would need
  that made relative.
- Earlier explorations — blade wipe, cut-line bloom, slice bands, aperture — are still in
  `src/variants/`, unregistered. They compile and their geometry constants are current, but
  their fronts predate the cutouts and would want `.on-shoe` instead of rectangular masks. The
  `.blade` and `.bandedge` styles they use are still in `global.css`; the Backlit and Mono
  treatments are gone entirely.
- The page chrome recedes on **raw page scroll**, not on the stage's progress, so under a pinned
  `?p=` it stays put and screenshots taken with `FULL=1` show a picker and switcher that wouldn't
  be there in use. Deliberate — it keeps `p` owned by one component — but worth knowing before
  reading a screenshot as final.
- The switcher recedes with the rest of the chrome, so **comparing variants means returning to the
  top**. No real loss, since switching resets the scroll anyway. The call-out switch recedes too,
  which is why `c` exists: unlike a variant change it doesn't reset the scroll, so annotated
  against bare *is* A/B-able at a specific frame, and variants still aren't.
- The top bar **stacks onto two rows** rather than shrink, below 578px on the x-ray and below
  462px on the plate — the ~116px difference is the call-out switch, which only one variant
  offers. Both numbers are measured, and both move: the picker grew by two swatches when the pops
  went in, so the threshold shifts every time the palette does. The alternative was a second set
  of short labels, a maintenance cost for a case this demo doesn't really have.
