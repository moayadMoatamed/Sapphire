import type { ChatStateType } from '../state'
import { randomUUID as uuid } from 'node:crypto'

export async function updateGraphNode(state: {
  sessionId: string
  newIdeaNodes: unknown[]
}): Promise<Partial<ChatStateType>> {
  const ideas = (state.newIdeaNodes ?? []) as Array<{
    type: string
    title: string
    content: string
    linkedBookEntity?: string
  }>

  if (ideas.length === 0) return {}

  try {
    const { writeChatGraphNodes } = await import('@/services/graph/chat-graph')

    const nodes = ideas.map((idea) => ({
      id: uuid(),
      type: idea.type as 'Claim' | 'Question' | 'Decision' | 'Concept',
      title: idea.title,
      content: idea.content,
      miniRoundIndex: 0,
      linkedBookEntityIds: idea.linkedBookEntity ? [idea.linkedBookEntity] : [],
      createdAt: new Date().toISOString(),
    }))

    const edges: Array<{
      sourceId: string
      targetId: string
      type: 'supports' | 'contradicts' | 'refines' | 'derived-from' | 'answers'
    }> = []
    for (let i = 1; i < nodes.length; i++) {
      edges.push({
        sourceId: nodes[i - 1].id,
        targetId: nodes[i].id,
        type: 'refines',
      })
    }

    console.error('[updateGraph] Writing nodes:', nodes.length, 'edges:', edges.length)
    await writeChatGraphNodes(state.sessionId, nodes, edges)
    console.error('[updateGraph] Write complete')
  } catch (err) {
    console.error('Failed to update chat graph:', err)
  }

  return {}
}
