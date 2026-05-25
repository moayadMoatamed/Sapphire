'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function NewChatButton({
  bookId,
  userId,
  bookTitle,
}: {
  bookId: string
  userId: string
  bookTitle: string
}) {
  const router = useRouter()

  const handleClick = async () => {
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, content: '' }),
    })

    if (res.ok) {
      const reader = res.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value)
        }

        try {
          // The session ID is returned in the done event
          const lines = buffer.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6))
              if (data.sessionId) {
                router.push(`/chat/${data.sessionId}`)
                return
              }
            }
          }
        } catch {
          // Fallback
        }
      }
    }

    // Fallback: just navigate to books
    router.push(`/books/${bookId}`)
  }

  return (
    <Button size="sm" onClick={handleClick}>
      <Plus className="h-4 w-4" />
      New chat
    </Button>
  )
}
