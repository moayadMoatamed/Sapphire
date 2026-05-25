import type { ChatStateType } from '../state'

export async function updateMemoryNode(state: {
  sessionId: string
  userMessage: string
  assistantMessage: string
}): Promise<Partial<ChatStateType>> {
  try {
    const { appendMessages } = await import('@/services/memory/tiers')
    const { db } = await import('@/db')
    const { chatMessages } = await import('@/db/schema')

    const userId = crypto.randomUUID()
    const assistantId = crypto.randomUUID()
    const now = new Date()

    const userMsg = {
      id: userId,
      role: 'user' as const,
      content: state.userMessage,
      miniRoundIndex: 0,
      tokens: state.userMessage.split(/\s+/).length,
      createdAt: now,
    }
    const assistantMsg = {
      id: assistantId,
      role: 'assistant' as const,
      content: state.assistantMessage,
      miniRoundIndex: 0,
      tokens: state.assistantMessage.split(/\s+/).length,
      createdAt: now,
    }

    appendMessages(state.sessionId, [userMsg, assistantMsg])

    await db.insert(chatMessages).values([
      { id: userId, sessionId: state.sessionId, role: 'user', content: state.userMessage, tokens: userMsg.tokens, createdAt: now },
      { id: assistantId, sessionId: state.sessionId, role: 'assistant', content: state.assistantMessage, tokens: assistantMsg.tokens, createdAt: now },
    ]).catch((err) => {
      console.error('Failed to persist messages to DB:', err)
    })
  } catch (err) {
    console.error('Failed to update memory:', err)
  }
  return {}
}
