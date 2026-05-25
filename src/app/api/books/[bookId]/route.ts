import { NextResponse } from 'next/server'
import { db } from '@/db'
import { books } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params

  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, bookId))

  if (!book) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(book)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params
  await db.delete(books).where(eq(books.id, bookId))
  return NextResponse.json({ success: true })
}
