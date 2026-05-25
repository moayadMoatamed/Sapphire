'use client'

import { useState, useEffect } from 'react'
import type { MemoryData } from '@/types'

export function useMemoryPanel(sessionId: string) {
  const [memory, setMemory] = useState<MemoryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const res = await fetch(`/api/graph/chat/${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          const nodes: Array<{ id: string; type: string; label: string; content?: string }> =
            data?.nodes ?? []
          setMemory({
            topics: nodes
              .filter((n) => n.type === 'Claim' || n.type === 'Concept')
              .map((n) => ({
                id: n.id,
                name: n.label,
                status: 'ongoing' as const,
                description: n.content ?? '',
              })),
            decisions: nodes
              .filter((n) => n.type === 'Decision')
              .map((n) => ({
                id: n.id,
                statement: n.label,
              })),
            openQuestions: nodes
              .filter((n) => n.type === 'Question')
              .map((n) => ({
                id: n.id,
                question: n.label,
              })),
          })
        }
      } catch {
        // Memory not available yet
      } finally {
        setLoading(false)
      }
    }

    fetchMemory()
    const interval = setInterval(fetchMemory, 5000)
    return () => clearInterval(interval)
  }, [sessionId])

  return { memory, loading }
}
