'use client'

import { useState, useCallback } from 'react'
import type { ChatMessage } from '@/types'

interface UseChatStreamOptions {
  sessionId: string
}

interface UseChatStreamReturn {
  messages: ChatMessage[]
  streaming: string | null
  sending: boolean
  sendMessage: (content: string) => Promise<void>
  setMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
}

export function useChatStream({ sessionId }: UseChatStreamOptions): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || sending) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
      }
      setMessages((prev) => [...prev, userMsg])
      setSending(true)
      setStreaming('')

      try {
        const res = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, content }),
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          throw new Error(errText || `Server returned ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const decoder = new TextDecoder()
        let buffer = ''
        let assistantContent = ''
        let currentEvent = ''
        let messageFinalized = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
              continue
            }
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (currentEvent === 'error' || data.error) {
                  throw new Error(`SSE_ERROR:${data.error ?? 'Unknown server error'}`)
                }

                if (currentEvent === 'token' || data.content) {
                  assistantContent += data.content ?? ''
                  setStreaming(assistantContent)
                }

                if ((currentEvent === 'done' || data.done) && !messageFinalized) {
                  messageFinalized = true
                  if (assistantContent.trim()) {
                    setMessages((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), role: 'assistant', content: assistantContent },
                    ])
                  }
                  setStreaming(null)
                }
              } catch (err) {
                if (err instanceof Error && err.message.startsWith('SSE_ERROR:')) {
                  throw new Error(err.message.slice(9))
                }
                // JSON parse errors — skip silently
              }
            }
          }
        }

        // Stream ended without done event — finalize any pending content
        if (assistantContent.trim() && !messageFinalized) {
          setStreaming(null)
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', content: assistantContent },
          ])
        }
      } catch (err) {
        setStreaming(null)
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [sessionId, sending],
  )

  return { messages, streaming, sending, sendMessage, setMessages }
}
