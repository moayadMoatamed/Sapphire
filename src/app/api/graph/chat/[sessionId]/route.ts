import { NextResponse } from 'next/server'
import { queryChatGraph } from '@/services/graph/chat-graph'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params
  const graph = await queryChatGraph(sessionId)
  return NextResponse.json(graph)
}
