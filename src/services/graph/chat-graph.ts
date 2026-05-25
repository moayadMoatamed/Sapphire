import { db } from '@/db'
import { chatIdeaNodes, chatIdeaEdges } from '@/db/schema'
import { eq } from 'drizzle-orm'

export interface IdeaNode {
  id: string
  type: 'Claim' | 'Question' | 'Decision' | 'Concept'
  title: string
  content: string
  miniRoundIndex: number
  linkedBookEntityIds: string[]
  createdAt: string
}

export interface IdeaEdge {
  sourceId: string
  targetId: string
  type: 'supports' | 'contradicts' | 'refines' | 'derived-from' | 'answers'
}

export async function writeChatGraphNodes(
  sessionId: string,
  nodes: IdeaNode[],
  edges: IdeaEdge[],
): Promise<void> {
  if (nodes.length === 0) return

  for (const node of nodes) {
    await db
      .insert(chatIdeaNodes)
      .values({
        id: node.id,
        sessionId,
        type: node.type,
        title: node.title,
        content: node.content,
        miniRoundIndex: node.miniRoundIndex,
        linkedBookEntityIds: node.linkedBookEntityIds,
        createdAt: new Date(node.createdAt),
      })
      .onConflictDoNothing()
  }

  for (const edge of edges) {
    await db
      .insert(chatIdeaEdges)
      .values({
        sessionId,
        sourceNodeId: edge.sourceId,
        targetNodeId: edge.targetId,
        type: edge.type,
      })
      .onConflictDoNothing()
  }
}

export async function queryChatGraph(sessionId: string): Promise<{
  nodes: Array<{ id: string; label: string; type: string; content: string }>
  edges: Array<{ source: string; target: string; type: string }>
}> {
  const nodes = await db
    .select()
    .from(chatIdeaNodes)
    .where(eq(chatIdeaNodes.sessionId, sessionId))

  const edges = await db
    .select()
    .from(chatIdeaEdges)
    .where(eq(chatIdeaEdges.sessionId, sessionId))

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.title,
      type: n.type,
      content: n.content,
    })),
    edges: edges.map((e) => ({
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: e.type,
    })),
  }
}

export async function resolveEntityByName(
  bookId: string,
  name: string,
): Promise<{ id: string; name: string; type: string } | null> {
  // In production: match entity in book_<bookId> graph by name
  return null
}
