import type { ChatStateType } from '../state'

export async function classifyIntentNode(state: {
  userMessage: string
}): Promise<Partial<ChatStateType>> {
  const { classifyIntent } = await import('@/services/retrieval/classify-intent')
  const intent = await classifyIntent(state.userMessage)
  return { intent }
}
