import { useEffect, useRef } from 'react'
import type { MotionValue } from 'motion/react'
import { PIN_X, SWATCH_H, SWATCH_W, sag } from './geometry'
import { ZONES, zoneGrowth } from './sweatZones'

/**
 * The comparison without WebGL: the same two hung samples — sagging top edge, the
 * gentle inward gather, the same zone seeds as soft blobs — drawn flat on a 2D
 * canvas. Still where the GL version stirs, but the claim survives intact: same
 * sweat, one fabric shows it.
 *
 * Redraws only when moisture changes, coalesced onto one rAF.
 */

const HW = SWATCH_W / 2
const HH = SWATCH_H / 2

export function FallbackHero({
  moisture,
  fabric,
}: {
  moisture: MotionValue<number>
  /** The dye lot's hex — same source as the GL material's. */
  fabric: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    let frame = 0
    const draw = () => {
      frame = 0
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = el.clientWidth
      const h = el.clientHeight
      if (el.width !== w * dpr || el.height !== h * dpr) {
        el.width = w * dpr
        el.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const m = moisture.get()
      /* Specimen boxes at the quarter points, sized like the GL framing. */
      const gh = Math.min(h * 0.56, w * 0.42)
      const gw = gh * (SWATCH_W / SWATCH_H)
      const top = h * 0.52 - gh / 2
      const scale = gw / SWATCH_W

      const stations: { cx: number; response: number }[] = [
        { cx: w * 0.28, response: 1 },
        { cx: w * 0.72, response: 0 },
      ]

      for (const { cx, response } of stations) {
        /* The hang, in outline: top edge dipped by the sag, sides gathered 5%
           toward the hem — the same numbers the mesh bakes. */
        const px = (gx: number, t: number) => cx + gx * (1 - 0.05 * t) * scale
        const py = (gy: number, gx: number) => top + (HH - gy + sag(gx)) * scale

        ctx.beginPath()
        for (let i = 0; i <= 24; i++) {
          const gx = -HW + (i / 24) * SWATCH_W
          const x = px(gx, 0)
          const y = py(HH, gx)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.lineTo(px(HW, 1), py(-HH, HW))
        ctx.lineTo(px(-HW, 1), py(-HH, -HW))
        ctx.closePath()
        ctx.fillStyle = fabric
        ctx.fill()

        /* The rail and its clips, still and in ink. */
        ctx.fillStyle = '#232326'
        ctx.fillRect(cx - (HW + 0.11) * scale, top - 0.05 * scale, (SWATCH_W + 0.22) * scale, 2)
        for (const pin of [-PIN_X, PIN_X]) {
          ctx.fillRect(cx + pin * scale - 2, top - 0.045 * scale, 4, 0.07 * scale)
        }

        if (response <= 0) continue

        /* Marks, clipped to the cloth — multiplied, so they read as darkened dye
           in any colourway rather than grey paint. */
        ctx.save()
        ctx.clip()
        ctx.globalCompositeOperation = 'multiply'
        for (const z of ZONES) {
          const g = zoneGrowth(m, z.onset)
          if (g <= 0.001) continue
          const r = z.r * Math.sqrt(g) * scale
          const bx = px(z.x, (HH - z.y) / SWATCH_H)
          const by = py(z.y, z.x)
          const grad = ctx.createRadialGradient(bx, by, r * 0.2, bx, by, r)
          grad.addColorStop(0, 'rgba(96, 90, 86, 0.5)')
          grad.addColorStop(0.75, 'rgba(96, 90, 86, 0.42)')
          grad.addColorStop(1, 'rgba(96, 90, 86, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(bx, by, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }

    draw()
    const off = moisture.on('change', schedule)
    window.addEventListener('resize', schedule)
    return () => {
      off()
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [moisture])

  return <canvas className="sz__fallback" ref={canvas} aria-hidden="true" />
}
