import type { ChatStateType } from '../state'

export async function recallNode(state: {
  sessionId: string
}): Promise<Partial<ChatStateType>> {
  const { getActiveContext, getRecentSummaries, getStructuredMemory } =
    await import('@/services/memory/tiers')

  return {
    activeContext: getActiveContext(state.sessionId),
    recentSummaries: getRecentSummaries(state.sessionId, 5),
    structuredMemory: getStructuredMemory(state.sessionId),
    recalled: [],
  }
}
