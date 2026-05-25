'use client'

import { useRef, useEffect } from 'react'
import { MessageBubble } from './message-bubble'
import { MessageSquare } from 'lucide-react'
import type { ChatMessage } from '@/types'

interface ChatMessagesProps {
  messages: ChatMessage[]
  streaming?: string | null
}

export function ChatMessages({ messages, streaming }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  if (!messages?.length && !streaming) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          {/* Subtle decorative ring */}
          <div className="relative mx-auto h-16 w-16">
            <div className="absolute inset-0 rounded-full border border-sapphire-700/20" />
            <div className="absolute inset-2 rounded-full border border-sapphire-600/15" />
            <div className="absolute inset-0 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-sapphire-400/40" />
            </div>
          </div>

          <h2 className="mt-6 font-serif text-lg font-medium text-sapphire-100">
            Begin the conversation
          </h2>
          <p className="mt-2 text-sm text-ink-300 leading-relaxed">
            Ask about any concept, theme, or idea from the book.
            Your questions build a live map of your thinking.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {[
              'What are the main themes?',
              'Summarize the key arguments',
              'Compare the main characters',
            ].map((hint) => (
              <span
                key={hint}
                className="inline-block rounded-sm border border-sapphire-700/30 bg-sapphire-900/40 px-3 py-1.5 font-sans text-xs text-ink-400"
              >
                {hint}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
      ))}
      {streaming && <MessageBubble role="assistant" content={streaming} />}
      <div ref={bottomRef} />
    </div>
  )
}
