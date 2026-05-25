import type { ChatStateType } from '../state'
import { z } from 'zod'

function normalizeIdeaType(type: string): string {
  const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
  const valid = ['Claim', 'Question', 'Decision', 'Concept']
  return valid.includes(normalized) ? normalized : 'Concept'
}

export async function extractIdeasNode(state: {
  sessionId: string
  bookId: string
  userMessage: string
  assistantMessage: string
}): Promise<Partial<ChatStateType>> {
  try {
    const { extract } = await import('@/services/llm/adapter')

    const IdeaSchema = z.object({
      ideas: z.array(z.object({
        type: z.string().default('Concept'),
        title: z.string().default(''),
        content: z.string().default(''),
        linkedBookEntity: z.string().optional().default(''),
      })).default([]),
    })

    const ideas = await extract<z.infer<typeof IdeaSchema>>(
      'deepseek-chat',
      `Extract key ideas from the assistant's response as graph nodes. Return ONLY this JSON structure:

{
  "ideas": [
    {
      "type": "Claim",
      "title": "Short label for the idea",
      "content": "Detailed description of the idea from the text",
      "linkedBookEntity": ""
    }
  ]
}

Node types:
- Claim: a factual assertion or argument
- Question: an open question or uncertainty
- Decision: a conclusion or judgment
- Concept: an abstract theme, principle, or framework

Create 1-3 ideas per response. Be specific — use concrete details, not generic labels. The "content" field should be a full sentence from or about the text.`,
      `User: ${state.userMessage}\n\nAssistant: ${state.assistantMessage}`,
      IdeaSchema,
      { maxTokens: 1024 },
    )

    return {
      newIdeaNodes: (ideas.ideas ?? []).map((idea: Record<string, string>) => ({
        type: normalizeIdeaType(idea.type),
        title: idea.title || idea.name || '',
        content: idea.content || idea.text || '',
        linkedBookEntity: idea.linkedBookEntity || undefined,
      })),
    }
  } catch (err) {
    console.error('[extractIdeas] Failed:', err)
    return { newIdeaNodes: [] }
  }
}
