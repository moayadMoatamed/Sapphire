'use client'

import { useGraphView } from '@/hooks/use-graph-view'
import { LoadingSpinner } from '@/components/ui/loading'

interface GraphViewProps {
  endpoint: string
  refreshKey?: number
  className?: string
  emptyMessage?: string
}

export function GraphView({ endpoint, refreshKey, className, emptyMessage }: GraphViewProps) {
  const { canvasRef, containerRef, loading, error, nodeCount, edgeCount, NODE_COLORS } =
    useGraphView(endpoint, refreshKey)

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className ?? ''}`}>
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-4 ${className ?? ''}`}>
        <p className="text-sm text-ink-300 text-center">{error}</p>
      </div>
    )
  }

  if (nodeCount === 0) {
    return (
      <div className={`flex items-center justify-center ${className ?? ''}`}>
        <p className="text-sm text-ink-300">
          {emptyMessage ?? 'No graph data yet'}
        </p>
      </div>
    )
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      <div className="absolute bottom-2 right-2 text-xs text-ink-300 bg-sapphire-950/80 px-2 py-1 rounded-sm font-mono pointer-events-none">
        {nodeCount} nodes &middot; {edgeCount} edges
      </div>
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 text-[10px] bg-sapphire-950/80 px-1.5 py-0.5 rounded-sm pointer-events-none">
        {Object.entries(NODE_COLORS)
          .filter(([type]) => ['Claim', 'Question', 'Decision', 'Concept'].includes(type))
          .map(([type, color]) => (
            <span key={type} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {type}
            </span>
          ))}
      </div>
    </div>
  )
}
