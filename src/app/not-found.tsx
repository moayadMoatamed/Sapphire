import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-6">
        <div className="h-16 w-16 mx-auto rounded-sm bg-sapphire-900 border border-sapphire-700/40 flex items-center justify-center">
          <span className="font-mono text-2xl text-sapphire-300">404</span>
        </div>
        <h1 className="mt-6 font-serif text-xl font-medium text-sapphire-50">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  )
}
