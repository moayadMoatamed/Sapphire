import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SapphireShards } from '@/components/ui/sapphire-shards'
import { BookOpen, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col flex-1 relative">
      {/* Sapphire shards hero background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Subtle radial vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 35%, rgba(31, 58, 120, 0.25) 0%, transparent 70%)',
          }}
        />
        <SapphireShards className="absolute inset-0 w-full h-full" />
      </div>

      <header className="relative border-b border-sapphire-800/40">
        <div className="flex h-14 items-center justify-between px-6 max-w-6xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-2.5 font-medium text-sapphire-100">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-sapphire-300"
            >
              <polygon points="12,2 22,8 22,18 12,22 2,18 2,8" />
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="2" y1="8" x2="22" y2="8" />
            </svg>
            <span className="font-serif text-base">Sapphire</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/books"
              className="text-sm text-ink-300 hover:text-sapphire-100 transition-colors duration-180"
            >
              Library
            </Link>
            <Button size="sm" asChild variant="primary">
              <Link href="/books">
                <BookOpen className="h-4 w-4" />
                Get started
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div className="max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sapphire-700/40 bg-sapphire-900/50 px-3 py-1 text-xs font-medium text-ink-300 mb-10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-400" />
            </span>
            Knowledge companion for serious readers
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight text-sapphire-50 leading-tight">
            Read deeper.
            <br />
            Think clearer.
          </h1>

          <p className="mt-8 text-lg leading-relaxed text-ink-300 max-w-lg mx-auto font-sans">
            Drop in a PDF. Sapphire builds a knowledge graph of its concepts and lets you have long
            conversations grounded in the book. As you talk, your ideas become a live map.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" asChild variant="primary">
              <Link href="/books">
                <BookOpen className="h-4 w-4" />
                Upload a book
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#features">
                See how it works
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div
          id="features"
          className="mt-32 grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto w-full"
        >
          {[
            {
              title: 'Ingest',
              description:
                'Upload a PDF. Sapphire parses it, extracts entities and relationships, and builds a property graph you can explore.',
            },
            {
              title: 'Chat',
              description:
                'Ask questions, explore ideas, debate claims. Every answer is grounded in the book with citations.',
            },
            {
              title: 'Remember',
              description:
                'Sapphire never forgets. A tiered memory system tracks your conversation, building a map of your thinking.',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-sm border border-sapphire-700/40 bg-sapphire-900/60 p-6 transition-colors duration-180 hover:border-sapphire-600/60"
            >
              <h3 className="font-sans font-semibold text-sapphire-100">{feature.title}</h3>
              <p className="mt-2 text-sm text-ink-300 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative border-t border-sapphire-800/40 py-6 text-center text-sm text-ink-500">
        <span className="font-serif text-sapphire-300">Sapphire</span>
        <span className="mx-2 text-ink-600">·</span>
        Built as a portfolio piece. Not a product.
      </footer>
    </div>
  )
}
