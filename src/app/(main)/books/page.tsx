import { db } from '@/db'
import { books } from '@/db/schema'
import { desc } from 'drizzle-orm'
import Link from 'next/link'
import { ArrowRight, BookOpen, Clock, Sparkles } from 'lucide-react'
import { AddBookButton } from './add-book-button'
import { BookshelfShards } from './bookshelf-shards'

export default async function BooksPage() {
  let userBooks: typeof books.$inferSelect[] = []
  try {
    userBooks = await db.select().from(books).orderBy(desc(books.createdAt))
  } catch {
    // Database not available yet
  }

  const hasBooks = userBooks.length > 0

  return (
    <div className="relative">
      {/* Subtle decorative background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(62, 102, 176, 0.12) 0%, transparent 70%)',
          }}
        />
        <BookshelfShards />
      </div>

      <main className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Page header */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-3xl font-medium text-sapphire-50 tracking-tight">
                Your library
              </h1>
              <p className="text-ink-300 mt-2 font-sans">
                {hasBooks
                  ? `${userBooks.length} book${userBooks.length !== 1 ? 's' : ''} in your collection`
                  : 'Upload a book to begin'}
              </p>
            </div>
            <AddBookButton />
          </div>
        </div>

        {!hasBooks ? (
          <div className="rounded-sm border-2 border-dashed border-sapphire-600/40 bg-sapphire-900/40 p-20 text-center relative overflow-hidden">
            {/* Subtle inner glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(62, 102, 176, 0.08) 0%, transparent 70%)',
              }}
            />
            <div className="relative">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-sm bg-sapphire-900/80 border border-sapphire-700/50 mb-6">
                <BookOpen className="h-10 w-10 text-sapphire-400/50" />
              </div>
              <h2 className="font-serif text-2xl font-medium text-sapphire-100">
                Your library is empty
              </h2>
              <p className="mt-3 text-ink-300 max-w-md mx-auto leading-relaxed">
                Drop in a PDF and Sapphire will parse it, extract its concepts, and build a
                knowledge graph you can explore through conversation.
              </p>
              <div className="mt-8 flex items-center justify-center gap-4">
                <AddBookButton />
                <Link
                  href="/"
                  className="text-sm text-ink-400 hover:text-sapphire-200 transition-colors duration-180 inline-flex items-center gap-1.5"
                >
                  Learn more
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userBooks.map((book, i) => (
              <Link
                key={book.id}
                href={`/books/${book.id}`}
                className="group relative rounded-sm border border-sapphire-700/40 bg-sapphire-900/40 p-5 hover:border-sapphire-500/60 hover:bg-sapphire-900/60 hover:-translate-y-0.5 transition-all duration-180"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Status glow */}
                {book.status === 'processing' && (
                  <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
                )}
                {book.status === 'ready' && (
                  <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-success-500/30 to-transparent" />
                )}

                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-sans font-semibold text-sapphire-100 truncate group-hover:text-sapphire-50 transition-colors duration-180">
                      {book.title}
                    </h3>
                    <p className="text-sm text-ink-300 mt-1">
                      {book.author ?? 'Unknown author'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-sapphire-700/0 group-hover:text-sapphire-300 transition-all duration-180 shrink-0 group-hover:translate-x-0.5" />
                </div>

                <div className="mt-5 flex items-center gap-4 text-xs font-mono text-ink-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      {book.status === 'processing' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400/60" />
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          book.status === 'ready'
                            ? 'bg-success-500'
                            : book.status === 'error'
                              ? 'bg-danger-500'
                              : 'bg-gold-400'
                        }`}
                      />
                    </span>
                    <span className="capitalize">{book.status}</span>
                  </span>
                  {book.entityCount != null && (
                    <span>{book.entityCount} entities</span>
                  )}
                  {book.createdAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {new Date(book.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Bottom hint — only when there are books */}
        {hasBooks && (
          <div className="mt-8 text-center">
            <p className="text-xs text-ink-500 inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Select a book to start chatting with its knowledge graph
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
