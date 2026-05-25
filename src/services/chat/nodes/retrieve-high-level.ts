import type { ChatStateType } from '../state'

export async function retrieveHighLevelNode(state: {
  bookId: string
  userMessage: string
}): Promise<Partial<ChatStateType>> {
  try {
    const { retrieveHighLevel } = await import('@/services/retrieval/high-level')
    const results = await retrieveHighLevel(state.bookId, state.userMessage)
    return { highLevelResults: results }
  } catch (err) {
    console.error('High-level retrieval failed, continuing with empty results:', err)
    return { highLevelResults: [] }
  }
}
