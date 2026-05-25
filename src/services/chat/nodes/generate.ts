import type { ChatStateType } from '../state'

interface ContextMessage {
  role: string
  content: string
}

function buildGenerationPrompt(fusedContext: string, activeContext: unknown): string {
  const ctxStr = Array.isArray(activeContext)
    ? (activeContext as ContextMessage[])
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n')
    : ''

  return `You are Sapphire, a focused thinking partner discussing a book with the user.

<book_context>
${fusedContext || '(No relevant context found in the book)'}
</book_context>

<active_conversation>
${ctxStr || '(Start of conversation)'}
</active_conversation>

Rules:
- Ground every factual claim about the book in the <book_context>.
- If the user asks something you don't have grounded context for, say so plainly.
- Aim for depth over breadth. The user is reading a serious book.
- Use Markdown for emphasis where it helps.
`
}

export async function generateNode(state: {
  userMessage: string
  fusedContext: string
  activeContext: unknown[]
}): Promise<Partial<ChatStateType>> {
  const { generate } = await import('@/services/llm/adapter')
  const systemPrompt = buildGenerationPrompt(state.fusedContext, state.activeContext)

  const stream = await generate('deepseek-chat', systemPrompt, [
    {
      role: 'user',
      content: state.userMessage as string,
    },
  ])

  let fullResponse = ''
  for await (const chunk of stream) {
    fullResponse += chunk.content
  }

  return { assistantMessage: fullResponse }
}
