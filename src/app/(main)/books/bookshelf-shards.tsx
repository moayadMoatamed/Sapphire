'use client'

import { useRef, useEffect } from 'react'

interface Shard {
  x: number
  y: number
  size: number
  baseY: number
  speed: number
  phase: number
  opacity: number
  rotation: number
}

export function BookshelfShards() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    ctx.scale(dpr, dpr)

    // Fewer, slower shards — decorative, not dominant
    const shards: Shard[] = Array.from({ length: 25 }, () => ({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      size: 2 + Math.random() * 6,
      baseY: Math.random() * rect.height,
      speed: 0.003 + Math.random() * 0.008,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.06 + Math.random() * 0.12,
      rotation: Math.random() * Math.PI * 2,
    }))

    const animate = () => {
      ctx.clearRect(0, 0, rect.width, rect.height)

      for (const s of shards) {
        s.phase += s.speed
        s.y = s.baseY + Math.sin(s.phase) * 30

        const alpha = s.opacity * (0.7 + Math.sin(s.phase * 1.7) * 0.3)

        // Soft glow
        const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2.5)
        gradient.addColorStop(0, `rgba(127, 161, 212, ${alpha * 0.7})`)
        gradient.addColorStop(0.5, `rgba(62, 102, 176, ${alpha * 0.25})`)
        gradient.addColorStop(1, 'rgba(62, 102, 176, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2)
        ctx.fill()

        // Diamond shape
        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.rotation)

        ctx.fillStyle = `rgba(127, 161, 212, ${alpha})`
        ctx.beginPath()
        ctx.moveTo(0, -s.size)
        ctx.lineTo(s.size * 0.5, 0)
        ctx.lineTo(0, s.size)
        ctx.lineTo(-s.size * 0.5, 0)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    />
  )
}
