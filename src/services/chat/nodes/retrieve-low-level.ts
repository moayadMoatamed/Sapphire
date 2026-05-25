import type { ChatStateType } from '../state'

export async function retrieveLowLevelNode(state: {
  bookId: string
  userMessage: string
}): Promise<Partial<ChatStateType>> {
  try {
    const { retrieveLowLevel } = await import('@/services/retrieval/low-level')
    const results = await retrieveLowLevel(state.bookId, state.userMessage)
    return { lowLevelResults: results }
  } catch (err) {
    console.error('Low-level retrieval failed, continuing with empty results:', err)
    return { lowLevelResults: [] }
  }
}
