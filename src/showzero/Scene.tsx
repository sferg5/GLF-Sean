import { useCallback, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import type { Group } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { MotionValue } from 'motion/react'
import { Swatch, hardwareMaterial } from './Swatch'
import { SWATCH_H } from './geometry'
import type { Tuning } from './clothSim'
import { useMotionUniform } from './useMotionUniform'

/**
 * The comparison, staged: two samples of cloth hung side by side under one light,
 * waiting to be sprayed.
 *
 * That identity is the experiment's control, so both hang inside a single parallax
 * rig and every light lives outside it. The spray bus reaches both swatches with
 * the same event — one press, one impulse, one mist, twice.
 *
 * **The breeze loop.** Each swatch registers its sim step here; one rAF drives
 * them both and invalidates the demand-mode canvas — so the cloth stirs
 * continuously while the hero is on screen and costs nothing when it isn't (an
 * IntersectionObserver parks the loop). `frozen` means the loop never starts and
 * the swatches hold their baked pose: reduced motion asks for stillness, and the
 * verification scripts need a frame that can be reproduced. This is the repo's one
 * sanctioned exception to "nothing reads the clock", and it comes with its own off
 * switch.
 *
 * Lighting follows the reference (holocloth): image-based light from three's own
 * RoomEnvironment, one white key, and a *pair* of rims — cool from back-left, warm
 * from back-right — so every fold turns through two colour temperatures instead of
 * one grey. No shadows, no postprocessing.
 */
export function Scene({
  moisture,
  tiltX,
  tiltY,
  frozen,
  bus,
  tuning,
  fabric,
  coarse,
}: {
  moisture: MotionValue<number>
  /** Parallax rig rotation, sprung from the pointer. */
  tiltX: MotionValue<number>
  tiltY: MotionValue<number>
  /** Park the cloth: reduced motion, `?p=` scrubs, `?breeze=0`. */
  frozen: boolean
  /** The spray trigger, shared with the DOM's one button. */
  bus: { on: (fn: () => void) => () => void }
  /** Live dial values — the panel mutates, the sims read. */
  tuning: Tuning
  /** The dye lot, as a hex — always the same on both samples. */
  fabric: string
  /** Clothesline, or gathered into folds — the light changes with the hang. */
  coarse: boolean
}) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = env.texture
    return () => {
      scene.environment = null
      env.texture.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  /* One hang, one light rig: even bench light. The gathered staging and its raking key are gone
     — see the note in `SprayDials`. */
  useEffect(() => {
    scene.environmentIntensity = 0.5
    invalidate()
  }, [scene, invalidate])

  /** The swatches' sim steps — registered on mount, driven by the loop below. */
  const steps = useRef(new Set<(dt: number) => void>())
  const register = useCallback((step: (dt: number) => void) => {
    steps.current.add(step)
    return () => {
      steps.current.delete(step)
    }
  }, [])

  useEffect(() => {
    if (frozen) {
      invalidate()
      return
    }
    let raf = 0
    let visible = true
    let last = performance.now()
    const tick = (now: number) => {
      raf = 0
      if (!visible) return
      const dt = (now - last) / 1000
      last = now
      for (const step of steps.current) step(dt)
      invalidate()
      raf = requestAnimationFrame(tick)
    }
    /* Park the loop when the hero has been scrolled past — the sticky viewport is
       out of frame, so there is nothing to stir. */
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    })
    io.observe(gl.domElement)
    raf = requestAnimationFrame(tick)
    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [frozen, gl, invalidate])

  const rig = useRef<Group>(null)

  useMotionUniform(tiltX, (v) => {
    if (rig.current) rig.current.rotation.x = v
  })
  useMotionUniform(tiltY, (v) => {
    if (rig.current) rig.current.rotation.y = v
  })

  return (
    <>
      <directionalLight position={[1.5, 3, 4]} intensity={1.4} />
      {/* The reference's rim pair, turned well down for a light wall: cool one side,
          warm the other, so a fold's two faces never read as the same grey. */}
      <directionalLight position={[-4, 2.5, -3]} intensity={0.5} color="#bcd6f2" />
      <directionalLight
        position={[4.5, -1.5, -2.5]}
        intensity={0.35}
        color="#f2ded0"
      />

      {/**
       * Below centre, and further than it was: the head block owns the top of the frame.
       *
       * It was -0.06 when the head was a headline on its own. The head now carries the claim and
       * the call to action under it — 200px on a 900px window — and "lots of air under the nav"
       * is the point of the composition rather than a nice-to-have, so the rig gives up 0.21 of a
       * world unit (about 75px at this framing) and the whole thing still clears the hem.
       *
       * `.sz__tag`'s offset from the bottom of the window is the other half of this number. They
       * are a pair; moving one without the other floats a caption under nothing.
       */}
      <group ref={rig} position={[0, -0.27, 0]}>
        {/* ONE rail, long enough to leave the frame on both sides — the samples
            hang from the same line, in the same air, which is the experiment. */}
        <mesh
          material={hardwareMaterial()}
          position={[0, SWATCH_H / 2 + 0.045, 0.012]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.005, 0.005, 8, 12]} />
        </mesh>
        <Swatch
          x={-0.62}
          markResponse={1}
          sheenWet={0.55}
          phase={0}
          moisture={moisture}
          frozen={frozen}
          register={register}
          bus={bus}
          tuning={tuning}
          fabric={fabric}
          coarse={coarse}
        />
        <Swatch
          x={0.62}
          markResponse={0}
          sheenWet={0}
          phase={2.3}
          moisture={moisture}
          frozen={frozen}
          register={register}
          bus={bus}
          tuning={tuning}
          fabric={fabric}
          coarse={coarse}
        />
      </group>
    </>
  )
}
