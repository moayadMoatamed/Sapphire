import { db } from '@/db'
import { books } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      let lastStatus = 'uploading'

      // Poll database for status changes
      const pollInterval = setInterval(async () => {
        try {
          const [book] = await db
            .select({ status: books.status, statusMessage: books.statusMessage })
            .from(books)
            .where(eq(books.id, bookId))

          if (!book) {
            clearInterval(pollInterval)
            send('error', { error: 'Book not found' })
            controller.close()
            return
          }

          if (book.status !== lastStatus) {
            lastStatus = book.status

            if (book.status === 'ready') {
              send('progress', { stage: 'ready', message: 'Ingestion complete', percent: 100 })
              send('done', { bookId })
              clearInterval(pollInterval)
              controller.close()
            } else if (book.status === 'error') {
              send('error', { error: book.statusMessage ?? 'Ingestion failed' })
              clearInterval(pollInterval)
              controller.close()
            } else {
              send('progress', {
                stage: book.status,
                message: book.statusMessage ?? `Status: ${book.status}`,
                percent: estimatePercent(book.status),
              })
            }
          }
        } catch {
          // DB might not be available yet
        }
      }, 2000)

      const cleanup = () => {
        clearInterval(pollInterval)
        try { controller.close() } catch { /* already closed */ }
      }

      _request.signal.addEventListener('abort', cleanup)

      // 10-minute timeout
      setTimeout(cleanup, 600000)
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

function estimatePercent(status: string): number {
  switch (status) {
    case 'uploading': return 0
    case 'parsing': return 8
    case 'chunking': return 10
    case 'extracting_entities': return 25
    case 'resolving': return 40
    case 'relationships': return 55
    case 'themes': return 70
    case 'embedding': return 85
    case 'writing': return 95
    case 'ready': return 100
    default: return 0
  }
}
