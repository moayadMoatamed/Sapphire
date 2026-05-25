'use client'

import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{ chunkId: string; label: string }>
}

export function MessageBubble({ role, content, citations }: MessageBubbleProps) {
  const isAssistant = role === 'assistant'

  return (
    <div
      className={cn(
        'py-4 animate-[messageIn_200ms_ease-out]',
        isAssistant ? '' : 'bg-sapphire-900/30 border-b border-sapphire-800/20',
      )}
    >
      <div className="max-w-3xl mx-auto px-6">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              'text-[11px] font-sans font-medium tracking-wider uppercase',
              isAssistant ? 'text-sapphire-400' : 'text-ink-400',
            )}
          >
            {isAssistant ? 'Sapphire' : 'You'}
          </span>
          {isAssistant && (
            <span className="h-px flex-1 bg-sapphire-800/40" />
          )}
        </div>

        {/* Content — reading surface */}
        <div
          className={cn(
            'font-serif text-[17px] leading-relaxed whitespace-pre-wrap',
            isAssistant
              ? 'text-sapphire-50 border-l-2 border-sapphire-500/50 pl-4'
              : 'text-sapphire-50 pl-4 border-l-2 border-transparent',
          )}
        >
          {content}
          {/* Streaming cursor */}
          {isAssistant && (
            <span className="inline-block w-[2px] h-[1.1em] bg-sapphire-300 ml-0.5 animate-pulse align-text-bottom rounded-sm" />
          )}
        </div>

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 pl-4">
            {citations.map((c) => (
              <span
                key={c.chunkId}
                className="inline-flex items-center rounded-sm border border-sapphire-700/40 bg-sapphire-900/60 px-2 py-0.5 font-mono text-[11px] text-ink-300 cursor-pointer hover:border-sapphire-600/60 hover:text-sapphire-100 transition-colors duration-180"
              >
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
