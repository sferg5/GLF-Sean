import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, ShaderMaterial } from 'three'
import type { Points } from 'three'
import { ZONES } from './sweatZones'

/**
 * The spray: one press, one mist, arriving all at once.
 *
 * **It was four aimed spritzes and now it's a cloud**, and the two are worth
 * contrasting because the first version was defensible. It fired one tight burst
 * per sweat zone, in the order the zones' onsets bloom, so each patch of droplets
 * landed exactly where — and roughly when — a mark appeared beneath it: the water
 * and the mark as the same event, with no overspray to disconnect them. What that
 * cost was that a single press read as four, 110ms apart, and a bottle of water
 * doesn't tick.
 *
 * So it's simultaneous now. Every droplet is released on the same frame, and the
 * cloud gets its depth from *flight time* instead of from launch time — a spread
 * of speeds and distances rather than a queue of bursts. Every droplet is still
 * aimed at a zone, which is the part of the original that was right: the water and
 * the mark are the same event, and a general shower over the whole cut is what
 * disconnects them.
 *
 * Droplets are aimed at the *deformed* surface (the hero passes the pose sampler),
 * so the water lands on the cloth however it hangs — flat or gathered into folds.
 * Three phases each: a drift out of the nozzle that wanders as it goes, then
 * beading — cling, slide a little way down the fabric — then drying off.
 *
 * Per-droplet opacity and size need vertex attributes, so this is the one place the
 * repo writes a raw ShaderMaterial — twenty lines of point sprite, not a material
 * system. Random per droplet on purpose: it only exists in the live mode, where the
 * clock is already running.
 */

/**
 * Droplets in one press.
 *
 * Four times what the aimed version used, because a mist is made of the thing four
 * spritzes were not: many small drops rather than a few visible ones. They cost a
 * vertex each and nothing else — one draw call, one buffer update a frame — so the
 * ceiling here is the buffer, not the frame.
 */
const COUNT = 560

/**
 * How far past a zone's own radius the mist reaches.
 *
 * **Every droplet is aimed at a zone**, and the two-thirds bias that let a third of
 * them land anywhere on the cut is gone: an even shower over the whole sample is
 * what disconnects the water from the marks it leaves, which was the original
 * version's whole argument and it was right. What the mist changed is that all four
 * are hit at once instead of in a queue — not that the water stopped being aimed.
 *
 * A little past the radius rather than exactly at it, so the wet patch is softer
 * than the mark it produces and doesn't read as a stencil.
 */
const ZONE_REACH = 1.25

const MATERIAL = () =>
  new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color('#7d919c') },
      /* Smaller than the aimed version's 5.5, and varied per droplet by `aSize`. A mist is
         made of drops you can't quite resolve; at the old size 560 of them is weather. */
      uPx: { value: 3.9 * Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aSize;
      varying float vAlpha;
      uniform float uPx;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uPx * aSize * (4.8 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    /* A softer falloff than the aimed version's: `smoothstep(0.5, 0.12, d)` gives a droplet
       with an edge, which is right for something you can see individually and wrong for a
       cloud. Taking the inner stop to the centre makes every drop a gradient, so overlapping
       ones read as density rather than as a pile of discs. */
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    /* Normal blending, dark droplets: additive would brighten, and against a
       near-white wall a brightened droplet doesn't exist. */
    transparent: true,
    depthWrite: false,
  })

export function Mist({
  bus,
  register,
  frozen,
  surface,
}: {
  bus: { on: (fn: () => void) => () => void }
  register: (step: (dt: number) => void) => () => void
  frozen: boolean
  /** Flat garment coords → where that point of cloth actually hangs. */
  surface: (x: number, y: number) => [number, number, number]
}) {
  const points = useRef<Points>(null)

  const { geometry, material, alpha, size, state } = useMemo(() => {
    const geometry = new BufferGeometry()
    const position = new BufferAttribute(new Float32Array(COUNT * 3), 3)
    position.setUsage(DynamicDrawUsage)
    geometry.setAttribute('position', position)
    const alpha = new BufferAttribute(new Float32Array(COUNT), 1)
    alpha.setUsage(DynamicDrawUsage)
    geometry.setAttribute('aAlpha', alpha)
    /* Set once per press and never per frame, so it isn't in the update loop's cost. */
    const size = new BufferAttribute(new Float32Array(COUNT), 1)
    size.setUsage(DynamicDrawUsage)
    geometry.setAttribute('aSize', size)
    const material = MATERIAL()
    const state = {
      life: -1,
      vel: new Float32Array(COUNT * 3),
      flight: new Float32Array(COUNT),
      /** −1 while flying; set to the arrival time when the droplet beads. */
      landed: new Float32Array(COUNT),
      origin: new Float32Array(COUNT * 3),
      /** Phase and rate of each droplet's own wander, so no two drift alike. */
      wander: new Float32Array(COUNT * 2),
      /** How long this droplet clings before it has dried. */
      bead: new Float32Array(COUNT),
      /** Peak opacity. Varied, so the cloud has depth rather than one density. */
      peak: new Float32Array(COUNT),
    }
    return { geometry, material, alpha, size, state }
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useEffect(() => {
    if (frozen) return

    const pos = geometry.attributes.position as BufferAttribute
    const arr = pos.array as Float32Array
    const aArr = alpha.array as Float32Array
    const sArr = size.array as Float32Array

    /** Somewhere on a sweat zone to aim at — nowhere else. */
    const target = (): [number, number] => {
      const z = ZONES[(Math.random() * ZONES.length) | 0]
      const ang = Math.random() * Math.PI * 2
      /* `pow(_, 0.7)` rather than `sqrt`: an even fill of the disc spreads the cloud to the rim,
         and a wet patch is heaviest in the middle. Not linear either, which piles it all on the
         centre point and reads as a dot. */
      const r = Math.pow(Math.random(), 0.7) * z.r * ZONE_REACH
      return [z.x + Math.cos(ang) * r, z.y + Math.sin(ang) * r]
    }

    const offSpray = bus.on(() => {
      /**
       * The whole cloud, on one frame.
       *
       * The nozzle is one place rather than four leaning aims, and every droplet leaves it at
       * the same instant. What gives the cloud its depth is the spread of *flights* — 0.3 to
       * 0.75 of a second, so the near edge is beading while the far edge is still crossing —
       * and a per-droplet wander on the way, so the field expands rather than converging on a
       * point the way an aimed burst does.
       */
      for (let i = 0; i < COUNT; i++) {
        const [tx, ty] = target()
        const [sx, sy, sz] = surface(tx, ty)

        /* A nozzle with a mouth, not a point: a cone of origins in front of the cloth. */
        const ox = (Math.random() - 0.5) * 0.34
        const oy = 0.12 + (Math.random() - 0.5) * 0.34
        const oz = 0.78 + Math.random() * 0.34

        const flight = 0.3 + Math.random() * 0.45
        state.origin[i * 3] = ox
        state.origin[i * 3 + 1] = oy
        state.origin[i * 3 + 2] = oz
        state.flight[i] = flight
        state.vel[i * 3] = (sx - ox) / flight
        state.vel[i * 3 + 1] = (sy - oy) / flight
        state.vel[i * 3 + 2] = (sz + 0.02 - oz) / flight
        state.wander[i * 2] = Math.random() * Math.PI * 2
        state.wander[i * 2 + 1] = 4 + Math.random() * 5
        state.bead[i] = 0.55 + Math.random() * 0.8
        state.peak[i] = 0.2 + Math.random() * 0.26
        state.landed[i] = -1
        arr[i * 3] = ox
        arr[i * 3 + 1] = oy
        arr[i * 3 + 2] = oz
        aArr[i] = 0
        sArr[i] = 0.55 + Math.random() * 0.9
      }
      pos.needsUpdate = true
      alpha.needsUpdate = true
      size.needsUpdate = true
      state.life = 0
      if (points.current) points.current.visible = true
    })

    const offStep = register((dt) => {
      if (state.life < 0) return
      state.life += dt
      const t = state.life
      let alive = 0
      for (let i = 0; i < COUNT; i++) {
        const peak = state.peak[i]
        if (state.landed[i] < 0) {
          const flight = state.flight[i]
          if (t < flight) {
            /**
             * Drift, not flight. The straight line to the target is there — it's what puts the
             * water on the cloth wherever the cloth happens to be — with a wander across it
             * that grows as the droplet travels, so the cloud opens out on the way. A mist
             * that goes where it was pointed in a straight line is a jet.
             */
            const phase = state.wander[i * 2]
            const rate = state.wander[i * 2 + 1]
            const swell = (t / flight) * 0.045
            arr[i * 3] = state.origin[i * 3] + state.vel[i * 3] * t + Math.sin(phase + t * rate) * swell
            arr[i * 3 + 1] =
              state.origin[i * 3 + 1] + state.vel[i * 3 + 1] * t + Math.cos(phase * 1.7 + t * rate * 0.8) * swell
            arr[i * 3 + 2] = state.origin[i * 3 + 2] + state.vel[i * 3 + 2] * t
            /* Fading up over a fifth of the flight rather than a fixed 60ms: the whole cloud
               starts on one frame now, and a fixed ramp made that one frame a flash. */
            aArr[i] = Math.min(1, t / (flight * 0.22)) * peak
            alive++
            continue
          }
          state.landed[i] = t
        }
        /* Beading: cling where it landed, slide a little way down, dry off. */
        const bead = t - state.landed[i]
        const span = state.bead[i]
        if (bead < span) {
          arr[i * 3 + 1] -= 0.075 * dt
          /* Held, then dried, rather than fading from the moment it lands — water sits before
             it goes, and a linear fade from arrival makes the cloth look like it never got wet. */
          aArr[i] = peak * Math.min(1, (1 - bead / span) * 2.2)
          alive++
        } else {
          aArr[i] = 0
        }
      }
      pos.needsUpdate = true
      alpha.needsUpdate = true
      if (alive === 0) {
        state.life = -1
        if (points.current) points.current.visible = false
      }
    })

    return () => {
      offSpray()
      offStep()
    }
  }, [frozen, bus, register, geometry, alpha, size, state, surface])

  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      visible={false}
      frustumCulled={false}
    />
  )
}
