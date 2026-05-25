import { extract } from '@/services/llm/adapter'
import { z } from 'zod'
import type { Message, SummaryChunk } from './tiers'

const SUMMARIZE_PROMPT = `Summarize this mini-round of a conversation about a book.

Preserve the key claims, decisions, and open questions. Keep specific names, theories, and references.
Output a concise summary (~100-200 words) that captures what was discussed.`

const SummarizeSchema = z.object({
  text: z.string(),
  topicTags: z.array(z.string()),
})

export async function summarizeMiniRound(
  userMsg: Message,
  assistantMsg: Message,
): Promise<Pick<SummaryChunk, 'text' | 'topicTags'>> {
  try {
    const result = await extract<z.infer<typeof SummarizeSchema>>(
      'deepseek-chat',
      SUMMARIZE_PROMPT,
      `User: ${userMsg.content}\n\nAssistant: ${assistantMsg.content}`,
      SummarizeSchema,
      { maxTokens: 512 },
    )
    return result
  } catch (err) {
    console.error('Summarization failed, using fallback:', err)
    return {
      text: `User asked about: ${userMsg.content.slice(0, 200)}. Assistant responded.`,
      topicTags: [],
    }
  }
}
