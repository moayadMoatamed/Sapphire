import { extract } from '@/services/llm/adapter'
import { z } from 'zod'

const IntentSchema = z.object({
  intent: z.enum([
    'factual',
    'conceptual',
    'comparative',
    'thematic',
    'clarification',
    'meta',
  ]).default('conceptual'),
  topics: z.array(z.string()).default([]),
  lowLevelWeight: z.number().min(0).max(1).default(0.5),
  highLevelWeight: z.number().min(0).max(1).default(0.5),
  filterByChapter: z.string().nullable().default(null),
})

export type ClassifiedIntent = z.infer<typeof IntentSchema>

const INTENT_CLASSIFY_PROMPT = `You are classifying a user's question about a book.

Respond with ONLY this JSON structure:
{
  "intent": "conceptual",
  "topics": ["topic1", "topic2"],
  "lowLevelWeight": 0.5,
  "highLevelWeight": 0.5,
  "filterByChapter": null
}

Intent values: "factual", "conceptual", "comparative", "thematic", "clarification", "meta"
Weight guidelines:
- factual: lowLevelWeight=0.8, highLevelWeight=0.2
- conceptual: lowLevelWeight=0.7, highLevelWeight=0.3
- comparative: lowLevelWeight=0.5, highLevelWeight=0.5
- thematic: lowLevelWeight=0.2, highLevelWeight=0.8
- clarification: lowLevelWeight=0.3, highLevelWeight=0.3
- meta: lowLevelWeight=0, highLevelWeight=0`

export async function classifyIntent(userMessage: string): Promise<ClassifiedIntent> {
  try {
    return await extract<ClassifiedIntent>(
      'deepseek-chat',
      INTENT_CLASSIFY_PROMPT,
      `User message: "${userMessage}"`,
      IntentSchema,
      { maxTokens: 256 },
    )
  } catch (err) {
    console.error('Intent classification failed, using defaults:', err)
    return {
      intent: 'conceptual',
      topics: [],
      lowLevelWeight: 0.5,
      highLevelWeight: 0.5,
      filterByChapter: null,
    }
  }
}
