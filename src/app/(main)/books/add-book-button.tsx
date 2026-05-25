'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { UploadDropzone } from '@/components/books/upload-dropzone'
import { BookOpen } from 'lucide-react'

export function AddBookButton() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <BookOpen className="h-4 w-4" />
        Add a book
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a book</DialogTitle>
          <DialogDescription>
            Upload a PDF to build its knowledge graph.
          </DialogDescription>
        </DialogHeader>
        <UploadDropzone />
      </DialogContent>
    </Dialog>
  )
}
