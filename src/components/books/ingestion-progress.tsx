'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

interface ProgressState {
  stage: string
  message: string
  percent: number
  stats?: Record<string, number | string | undefined>
}

const STAGES = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'parsing', label: 'Parsing PDF' },
  { key: 'chunking', label: 'Chunking' },
  { key: 'extracting_entities', label: 'Extracting entities' },
  { key: 'resolving', label: 'Resolving duplicates' },
  { key: 'relationships', label: 'Extracting relationships' },
  { key: 'themes', label: 'Building themes' },
  { key: 'embedding', label: 'Generating embeddings' },
  { key: 'writing', label: 'Writing to graph' },
  { key: 'ready', label: 'Ready' },
]

export function IngestionProgress({ bookId, status }: { bookId: string; status: string }) {
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [liveReady, setLiveReady] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'ready' || status === 'error') return

    const eventSource = new EventSource(`/api/books/${bookId}/progress`)

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data) as ProgressState
      setProgress(data)
      if (data.stage === 'ready') {
        setLiveReady(true)
        eventSource.close()
      }
    })

    eventSource.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { error?: string }
        if (data.error) setLiveError(data.error)
      } catch {
        setLiveError('Connection lost')
      }
      eventSource.close()
    })

    return () => eventSource.close()
  }, [bookId, status])

  const isReady = status === 'ready' || liveReady
  const isError = status === 'error' || liveError !== null

  if (isError) {
    return (
      <div className="rounded-sm border border-danger-500/30 bg-danger-500/5 p-6 text-center">
        <AlertCircle className="h-8 w-8 mx-auto text-danger-500" />
        <p className="mt-2 font-sans font-semibold text-danger-500">Ingestion failed</p>
        <p className="text-sm text-ink-300 mt-1">
          {liveError ?? 'Something went wrong while processing your book. Try re-uploading.'}
        </p>
      </div>
    )
  }

  if (isReady) {
    return (
      <div className="rounded-sm border border-success-500/30 bg-success-500/5 p-6 text-center">
        <CheckCircle2 className="h-8 w-8 mx-auto text-success-500" />
        <p className="mt-2 font-sans font-semibold text-sapphire-100">Book is ready</p>
        {progress?.stats && (
          <p className="text-sm text-ink-300 mt-1">
            {progress.stats.entities} entities, {progress.stats.relationships} relationships
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-sapphire-700/40 bg-sapphire-900/60 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="h-5 w-5 animate-spin text-sapphire-300" />
        <span className="font-sans font-medium text-sapphire-100">
          {progress?.message ?? 'Initializing...'}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-sapphire-800 overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-sapphire-500 transition-all duration-500"
          style={{ width: `${progress?.percent ?? 0}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {STAGES.map((stage) => {
          const stageIndex = STAGES.findIndex((s) => s.key === progress?.stage)
          const currentIndex = STAGES.findIndex((s) => s.key === stage.key)
          const done = currentIndex < stageIndex
          const active = currentIndex === stageIndex

          return (
            <div
              key={stage.key}
              className={cn(
                'flex items-center gap-2.5 text-sm font-sans',
                done && 'text-ink-400',
                active && 'text-sapphire-100 font-medium',
                !done && !active && 'text-ink-500',
              )}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
              ) : active ? (
                <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-gold-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-400" />
                </span>
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-sapphire-700/40" />
              )}
              {stage.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
