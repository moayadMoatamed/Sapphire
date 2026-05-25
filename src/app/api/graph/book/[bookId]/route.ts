import { NextResponse } from 'next/server'
import { queryBookGraph } from '@/services/graph/book-graph'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params
  const graph = await queryBookGraph(bookId)
  return NextResponse.json(graph)
}
