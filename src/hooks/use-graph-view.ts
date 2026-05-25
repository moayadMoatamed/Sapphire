'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { GraphNode, GraphEdge } from '@/types'

export interface LayoutNode {
  id: string
  label: string
  type: string
  color: string
  x: number
  y: number
  vx: number
  vy: number
}

export interface LayoutEdge {
  source: string
  target: string
  color: string
}

const NODE_COLORS: Record<string, string> = {
  Entity: '#7FA1D4',
  Theme: '#E2B96A',
  Claim: '#D5E1F2',
  Question: '#D5E1F2',
  Decision: '#E2B96A',
  Concept: '#9DA3B0',
}

const EDGE_COLORS: Record<string, string> = {
  supports: '#6B9F7E',
  contradicts: '#B86B6B',
  refines: '#3E66B0',
  'derived-from': '#3E66B0',
  answers: '#C99A3F',
}

function runForceLayout(nodes: LayoutNode[], edges: LayoutEdge[], iterations: number) {
  const area = 800 * 600
  const k = Math.sqrt(area / Math.max(1, nodes.length))
  const gravity = 0.1
  const speed = 0.3

  for (let iter = 0; iter < iterations; iter++) {
    const temp = Math.max(0.1, 10 * (1 - iter / iterations))

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
        const force = (k * k) / dist * temp
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        nodes[i].vx += fx
        nodes[i].vy += fy
        nodes[j].vx -= fx
        nodes[j].vy -= fy
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const src = nodes.find((n) => n.id === edge.source)
      const tgt = nodes.find((n) => n.id === edge.target)
      if (!src || !tgt) continue
      const dx = src.x - tgt.x
      const dy = src.y - tgt.y
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
      const force = (dist * dist) / k * temp
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      src.vx -= fx
      src.vy -= fy
      tgt.vx += fx
      tgt.vy += fy
    }

    // Gravity + apply velocity
    for (const node of nodes) {
      node.vx += (0 - node.x) * gravity * temp
      node.vy += (0 - node.y) * gravity * temp
      node.vx *= speed
      node.vy *= speed
      node.x += node.vx
      node.y += node.vy
    }
  }
}

interface UseGraphViewReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  loading: boolean
  error: string | null
  nodeCount: number
  edgeCount: number
  NODE_COLORS: Record<string, string>
}

export function useGraphView(
  endpoint: string,
  refreshKey?: number,
): UseGraphViewReturn {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layoutNodesRef = useRef<LayoutNode[]>([])
  const layoutEdgesRef = useRef<LayoutEdge[]>([])
  const animRef = useRef<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)

  const viewRef = useRef({ offsetX: 0, offsetY: 0, zoom: 1, targetZoom: 1 })
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)
  const hoveredNodeRef = useRef<string | null>(null)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const v = viewRef.current
    v.zoom += (v.targetZoom - v.zoom) * 0.15

    ctx.clearRect(0, 0, w, h)

    const cx = w / 2
    const cy = h / 2

    const nodes = layoutNodesRef.current
    const edges = layoutEdgesRef.current

    // Draw edges
    ctx.lineWidth = 1
    for (const edge of edges) {
      const src = nodes.find((n) => n.id === edge.source)
      const tgt = nodes.find((n) => n.id === edge.target)
      if (!src || !tgt) continue
      const sx = cx + (src.x + v.offsetX) * v.zoom
      const sy = cy + (src.y + v.offsetY) * v.zoom
      const tx = cx + (tgt.x + v.offsetX) * v.zoom
      const ty = cy + (tgt.y + v.offsetY) * v.zoom
      ctx.strokeStyle = edge.color
      ctx.globalAlpha = 0.4
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }

    // Draw nodes
    ctx.globalAlpha = 1
    for (const node of nodes) {
      const nx = cx + (node.x + v.offsetX) * v.zoom
      const ny = cy + (node.y + v.offsetY) * v.zoom
      const radius = Math.max(3, Math.min(12, 6 * v.zoom))

      if (nx < -20 || nx > w + 20 || ny < -20 || ny > h + 20) continue

      if (hoveredNodeRef.current === node.id) {
        ctx.shadowColor = node.color
        ctx.shadowBlur = 16
      }

      ctx.fillStyle = node.color
      ctx.beginPath()
      ctx.arc(nx, ny, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.shadowBlur = 0

      if (v.zoom > 0.5) {
        ctx.fillStyle = '#D5E1F2'
        ctx.font = `${Math.max(9, 11 * v.zoom)}px Inter, system-ui, sans-serif`
        ctx.fillText(node.label, nx + radius + 4, ny + 4)
      }
    }

    animRef.current = requestAnimationFrame(render)
  }, [])

  // Render loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [render])

  // Mouse handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const getNodeAt = (mx: number, my: number): string | null => {
      const v = viewRef.current
      const rect = canvas.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      for (const node of layoutNodesRef.current) {
        const nx = cx + (node.x + v.offsetX) * v.zoom
        const ny = cy + (node.y + v.offsetY) * v.zoom
        const radius = Math.max(3, Math.min(12, 6 * v.zoom))
        if (Math.hypot(mx - nx, my - ny) < radius + 4) return node.id
      }
      return null
    }

    const onMouseDown = (e: MouseEvent) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, ox: viewRef.current.offsetX, oy: viewRef.current.offsetY }
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      hoveredNodeRef.current = getNodeAt(mx, my)
      canvas.style.cursor = hoveredNodeRef.current ? 'pointer' : 'grab'

      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startX) / viewRef.current.zoom
        const dy = (e.clientY - dragRef.current.startY) / viewRef.current.zoom
        viewRef.current.offsetX = dragRef.current.ox + dx
        viewRef.current.offsetY = dragRef.current.oy + dy
      }
    }

    const onMouseUp = () => {
      dragRef.current = null
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = -e.deltaY * 0.001
      viewRef.current.targetZoom = Math.max(0.1, Math.min(5, viewRef.current.targetZoom * (1 + delta)))
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  // Sync data from API
  useEffect(() => {
    let cancelled = false

    const fetchAndSync = async () => {
      try {
        const res = await fetch(endpoint)
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        const data = (await res.json()) as { nodes: GraphNode[]; edges: GraphEdge[] }
        if (cancelled) return

        const incoming = data.nodes ?? []
        const edges = data.edges ?? []
        const existing = layoutNodesRef.current
        const existingIds = new Set(existing.map((n) => n.id))

        for (const node of incoming) {
          if (!existingIds.has(node.id)) {
            existing.push({
              id: node.id,
              label: node.label,
              type: node.type,
              color: NODE_COLORS[node.type] ?? '#94a3b8',
              x: (Math.random() - 0.5) * 200,
              y: (Math.random() - 0.5) * 200,
              vx: 0,
              vy: 0,
            })
          }
        }

        const edgeList: LayoutEdge[] = edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          color: EDGE_COLORS[edge.type] ?? '#475569',
        }))
        layoutEdgesRef.current = edgeList

        if (existing.length > 0 && edgeList.length > 0) {
          runForceLayout(existing, edgeList, 60)
        }

        setNodeCount(existing.length)
        setEdgeCount(edgeList.length)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load graph')
          setLoading(false)
        }
      }
    }

    fetchAndSync()
    const interval = setInterval(fetchAndSync, 10000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [endpoint, refreshKey])

  // Resize handler
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * (window.devicePixelRatio || 1)
      canvas.height = rect.height * (window.devicePixelRatio || 1)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return { canvasRef, containerRef, loading, error, nodeCount, edgeCount, NODE_COLORS }
}
