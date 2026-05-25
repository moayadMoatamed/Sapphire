'use client'

import { useRef, useEffect, useCallback } from 'react'

interface Shard {
  x: number
  y: number
  size: number
  rotation: number
  speedX: number
  speedY: number
  rotSpeed: number
  opacity: number
  pulse: number
  pulseSpeed: number
  hue: number
  vertices: number
}

function createShard(canvas: HTMLCanvasElement): Shard {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: 3 + Math.random() * 12,
    rotation: Math.random() * Math.PI * 2,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.3 - 0.15,
    rotSpeed: (Math.random() - 0.5) * 0.002,
    opacity: 0.15 + Math.random() * 0.45,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.005 + Math.random() * 0.02,
    hue: 215 + Math.random() * 30,
    vertices: Math.random() > 0.5 ? 4 : 6,
  }
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
) {
  const half = size * 0.7
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(half, 0)
  ctx.lineTo(0, size)
  ctx.lineTo(-half, 0)
  ctx.closePath()
  ctx.restore()
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    const px = Math.cos(angle) * size
    const py = Math.sin(angle) * size
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.restore()
}

export function SapphireShards({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shardsRef = useRef<Shard[]>([])
  const animationRef = useRef<number>(0)

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    resize()
    const dpr = window.devicePixelRatio

    const count = Math.min(80, Math.floor((canvas.width / dpr) * (canvas.height / dpr) * 0.00015))
    shardsRef.current = Array.from({ length: count }, () => createShard(canvas))

    const drawConnections = (shards: Shard[], a: Shard, i: number) => {
      for (let j = i + 1; j < shards.length; j++) {
        const b = shards[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const maxDist = 120

        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.12 * Math.min(a.opacity, b.opacity)
          ctx.strokeStyle = `rgba(127, 161, 212, ${alpha})`
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const shards = shardsRef.current

      for (let i = 0; i < shards.length; i++) {
        const s = shards[i]

        s.pulse += s.pulseSpeed
        const glow = 0.5 + Math.sin(s.pulse) * 0.5
        const alpha = s.opacity * (0.7 + glow * 0.3)

        s.x += s.speedX
        s.y += s.speedY
        s.rotation += s.rotSpeed

        if (s.x < -20) s.x = canvas.width + 20
        if (s.x > canvas.width + 20) s.x = -20
        if (s.y < -20) s.y = canvas.height + 20
        if (s.y > canvas.height + 20) s.y = -20

        // Outer glow
        const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2)
        gradient.addColorStop(0, `hsla(${s.hue}, 60%, 65%, ${alpha * 0.6})`)
        gradient.addColorStop(0.5, `hsla(${s.hue}, 55%, 50%, ${alpha * 0.2})`)
        gradient.addColorStop(1, `hsla(${s.hue}, 50%, 40%, 0)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * 2, 0, Math.PI * 2)
        ctx.fill()

        // Shard body
        const fillAlpha = alpha * (0.8 + glow * 0.2)
        ctx.fillStyle = `hsla(${s.hue}, 50%, 58%, ${fillAlpha})`
        ctx.strokeStyle = `hsla(${s.hue}, 40%, 72%, ${fillAlpha * 0.7})`
        ctx.lineWidth = 0.6
        ctx.shadowColor = `hsla(${s.hue}, 60%, 70%, ${glow * 0.5})`
        ctx.shadowBlur = s.size * 0.8

        if (s.vertices === 4) {
          drawDiamond(ctx, s.x, s.y, s.size, s.rotation)
        } else {
          drawHexagon(ctx, s.x, s.y, s.size, s.rotation)
        }
        ctx.fill()
        ctx.stroke()
        ctx.shadowBlur = 0

        // Facet line inside the shard
        ctx.strokeStyle = `hsla(${s.hue}, 30%, 80%, ${alpha * 0.35})`
        ctx.lineWidth = 0.4
        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.rotation)
        ctx.beginPath()
        ctx.moveTo(0, -s.size * 0.6)
        ctx.lineTo(0, s.size * 0.6)
        ctx.stroke()
        ctx.restore()

        // Subtle connections between nearby shards
        drawConnections(shards, s, i)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    const handleResize = () => {
      resize()
      shardsRef.current = Array.from({ length: count }, () => createShard(canvas))
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [resize])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    />
  )
}
