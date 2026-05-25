'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { ChatMessages } from '@/components/chat/chat-messages'
import { ChatInput } from '@/components/chat/chat-input'
import { GraphView } from '@/components/graph/graph-view'
import { MemoryPanel } from '@/components/memory/memory-panel'
import { Button } from '@/components/ui/button'
import { useChatStream } from '@/hooks/use-chat-stream'
import { PanelRightOpen, PanelRightClose } from 'lucide-react'

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [graphRefreshKey, setGraphRefreshKey] = useState(0)
  const [bookTitle, setBookTitle] = useState<string | null>(null)
  const initializedRef = useRef(false)

  const { messages, streaming, sending, sendMessage, setMessages } = useChatStream({ sessionId })

  // Load session info and existing messages on mount
  useEffect(() => {
    if (!sessionId || initializedRef.current) return
    initializedRef.current = true

    const loadSession = async () => {
      try {
        const [sessionRes, messagesRes] = await Promise.all([
          fetch(`/api/chat/session/${sessionId}`),
          fetch(`/api/chat/session/${sessionId}/messages`),
        ])

        if (sessionRes.ok) {
          const data = await sessionRes.json()
          if (data.title) setBookTitle(data.title)
        }

        if (messagesRes.ok) {
          const data = await messagesRes.json()
          if (Array.isArray(data) && data.length > 0) {
            setMessages(data)
            setGraphRefreshKey((k) => k + 1)
          }
        }
      } catch {
        // Not critical — messages can load later
      }
    }
    loadSession()
  }, [sessionId, setMessages])

  const handleSend = async (content: string) => {
    await sendMessage(content)
    setGraphRefreshKey((k) => k + 1)
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 border-b border-sapphire-800/40 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-serif text-sm text-sapphire-100 truncate">
              {bookTitle ?? 'Chat'}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidePanelOpen((o) => !o)}
            title={sidePanelOpen ? 'Hide side panel' : 'Show side panel'}
          >
            {sidePanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </header>

        {/* Messages */}
        <ChatMessages messages={messages} streaming={streaming} />

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={sending} />
      </div>

      {/* Side panel: Graph + Memory */}
      {sidePanelOpen && sessionId && (
        <aside className="w-80 border-l border-sapphire-800/40 flex flex-col shrink-0 bg-sapphire-960">
          {/* Graph */}
          <div className="h-72 border-b border-sapphire-800/40 relative">
            <GraphView
              endpoint={`/api/graph/chat/${sessionId}`}
              refreshKey={graphRefreshKey}
              className="absolute inset-0"
              emptyMessage="Graph will appear as you discuss the book"
            />
          </div>

          {/* Memory */}
          <div className="flex-1 overflow-y-auto">
            <MemoryPanel sessionId={sessionId} />
          </div>
        </aside>
      )}
    </div>
  )
}
