import { db } from '@/db'
import { sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { chatGraph } from '@/services/chat/graph'
import { randomUUID as uuid } from 'node:crypto'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { sessionId, bookId, content } = (await request.json()) as {
    sessionId?: string
    bookId?: string
    content: string
  }

  // Resolve bookId from session if not provided
  let resolvedBookId = bookId
  if (!resolvedBookId && sessionId) {
    try {
      const [session] = await db.select({ bookId: sessions.bookId }).from(sessions).where(eq(sessions.id, sessionId))
      resolvedBookId = session?.bookId
    } catch {
      // Session lookup failed
    }
  }

  if (!resolvedBookId) {
    return new Response(JSON.stringify({ error: 'bookId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create or resolve session
  let sid = sessionId
  if (!sid) {
    sid = uuid()
    // Persist the session to DB
    try {
      await db.insert(sessions).values({
        id: sid,
        userId: 'local-user',
        bookId: resolvedBookId,
        title: 'New chat',
      })
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }

  if (!content) {
    // Just creating a new session — not sending a message yet
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ sessionId: sid })}\n\n`),
        )
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }

      try {
        send('status', { node: 'recall', message: 'Recalling context...' })

        const result = await chatGraph.invoke(
          { sessionId: sid, bookId: resolvedBookId, userMessage: content },
          { configurable: { thread_id: sid } },
        )

        const assistantMessage = result.assistantMessage as string | undefined
        send('token', { content: assistantMessage ?? '', done: true })
        send('done', { sessionId: sid })
      } catch (err) {
        send('error', { error: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
