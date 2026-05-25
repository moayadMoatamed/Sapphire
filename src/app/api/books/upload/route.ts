import { NextResponse } from 'next/server'
import { db } from '@/db'
import { books } from '@/db/schema'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID as uuid } from 'node:crypto'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!file.name.endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
  }

  const bookId = uuid()
  const uploadDir = path.join(process.cwd(), 'uploads', bookId)
  await mkdir(uploadDir, { recursive: true })

  const filePath = path.join(uploadDir, file.name)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  await db.insert(books).values({
    id: bookId,
    userId: 'local-user',
    title: file.name.replace(/\.pdf$/i, ''),
    author: null,
    fileName: file.name,
    filePath,
    fileSize: buffer.length,
    status: 'uploading',
  })

  // Start ingestion asynchronously (don't block the response)
  runIngestion(bookId, filePath)

  return NextResponse.json({ bookId })
}

async function runIngestion(bookId: string, filePath: string) {
  try {
    await db
      .update(books)
      .set({ status: 'parsing', ingestionStartedAt: new Date(), updatedAt: new Date() })
      .where(eq(books.id, bookId))

    const { ingestionGraph } = await import('@/services/ingestion/graph')
    await ingestionGraph.invoke(
      { bookId, filePath },
      { configurable: { thread_id: `ingest_${bookId}` } },
    )
  } catch (err) {
    console.error(`Ingestion failed for ${bookId}:`, err)
    await db
      .update(books)
      .set({
        status: 'error',
        statusMessage: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(books.id, bookId))
  }
}
