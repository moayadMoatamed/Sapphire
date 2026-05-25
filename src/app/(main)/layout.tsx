import Link from 'next/link'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="relative border-b border-sapphire-800/40 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-6 max-w-6xl mx-auto w-full">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-medium text-sapphire-100 hover:text-sapphire-50 transition-colors"
          >
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
          <nav className="flex items-center gap-4">
            <Link
              href="/books"
              className="text-sm text-ink-300 hover:text-sapphire-100 transition-colors duration-180"
            >
              Library
            </Link>
            <Link
              href="/settings"
              className="text-sm text-ink-300 hover:text-sapphire-100 transition-colors duration-180"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  )
}
