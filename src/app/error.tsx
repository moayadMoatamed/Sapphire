'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCw } from 'lucide-react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-6">
        <div className="h-16 w-16 mx-auto rounded-sm bg-sapphire-900 border border-sapphire-700/40 flex items-center justify-center">
          <span className="font-mono text-2xl text-gold-400">!</span>
        </div>
        <h1 className="mt-6 font-serif text-xl font-medium text-sapphire-50">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          An unexpected error occurred. Please try again.
        </p>
        <Button className="mt-6" onClick={reset}>
          <RotateCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  )
}
