'use client'

import { useCallback, useState, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function UploadDropzone() {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.pdf')) {
        toast.error('Only PDF files are supported')
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/books/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Upload failed')
        }

        const { bookId } = (await res.json()) as { bookId: string }
        toast.success('Book uploaded — starting ingestion...')
        router.push(`/books/${bookId}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [router],
  )

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleUpload(file)
    },
    [handleUpload],
  )

  return (
    <div
      className={cn(
        'rounded-sm border-2 border-dashed p-12 text-center transition-colors duration-180',
        dragging
          ? 'border-sapphire-500 bg-sapphire-700/10'
          : 'border-sapphire-700/40 hover:border-sapphire-600/60',
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-sapphire-300" />
          <p className="text-sm text-ink-300">Uploading your book...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-sm bg-sapphire-900 border border-sapphire-700/40 flex items-center justify-center">
            <FileText className="h-6 w-6 text-sapphire-300/60" />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-sapphire-100">Drop your PDF here</h3>
            <p className="text-sm text-ink-300 mt-1">
              Upload a textbook, paper, or any book
            </p>
          </div>
          <label>
            <Button variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4" />
                Browse files
              </span>
            </Button>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
              }}
            />
          </label>
        </div>
      )}
    </div>
  )
}
