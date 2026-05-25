import { db } from '@/db'
import { books, sessions } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, MessageSquare, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IngestionProgress } from '@/components/books/ingestion-progress'
import { NewChatButton } from './new-chat-button'

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const { bookId } = await params

  const [book] = await db.select().from(books).where(eq(books.id, bookId))

  if (!book) notFound()

  let bookSessions: typeof sessions.$inferSelect[] = []
  try {
    bookSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.bookId, bookId))
      .orderBy(desc(sessions.updatedAt))
  } catch {
    // DB not available
  }

  return (
    <div>
      <header className="border-b border-sapphire-800/40">
        <div className="flex h-14 items-center justify-between px-6 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/books">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="font-sans font-medium text-sapphire-100 truncate">
              {book.title}
            </h1>
          </div>
          {book.status === 'ready' && (
            <NewChatButton
              bookId={bookId}
              userId="local-user"
              bookTitle={book.title ?? 'Book'}
            />
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid gap-8">
          <div className="flex items-start gap-6">
            <div className="h-24 w-20 rounded-sm bg-sapphire-900 border border-sapphire-700/40 flex items-center justify-center shrink-0">
              <BookOpen className="h-10 w-10 text-sapphire-300" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-medium text-sapphire-50">
                {book.title}
              </h2>
              <p className="text-ink-300 text-sm">{book.author ?? 'Unknown author'}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-mono text-ink-400">
                {book.fileSize != null && (
                  <span>{Math.round(book.fileSize / 1024)} KB</span>
                )}
                {book.entityCount != null && (
                  <span>{book.entityCount} entities</span>
                )}
                {book.relationshipCount != null && (
                  <span>{book.relationshipCount} relationships</span>
                )}
              </div>
            </div>
          </div>

          <IngestionProgress bookId={bookId} status={book.status ?? 'uploading'} />

          {bookSessions.length > 0 && (
            <div>
              <h3 className="font-sans font-semibold text-sapphire-100 mb-4">Chats</h3>
              <div className="grid gap-3">
                {bookSessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/chat/${s.id}`}
                    className="flex items-center justify-between rounded-sm border border-sapphire-700/40 bg-sapphire-900/60 p-4 hover:border-sapphire-600/60 transition-colors duration-180"
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4 text-sapphire-300" />
                      <div>
                        <p className="text-sm font-medium text-sapphire-100">{s.title}</p>
                        <p className="text-xs text-ink-400">
                          Created{' '}
                          {s.createdAt
                            ? new Date(s.createdAt).toLocaleDateString()
                            : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-ink-400">Open chat</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
