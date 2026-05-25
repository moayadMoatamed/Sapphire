import { Annotation } from '@langchain/langgraph'
import type { Message, SummaryChunk, StructuredMemory } from '@/services/memory/tiers'
import type { ClassifiedIntent } from '@/services/retrieval/classify-intent'
import type { LowLevelResult } from '@/services/retrieval/low-level'
import type { HighLevelResult } from '@/services/retrieval/high-level'

export const ChatState = Annotation.Root({
  sessionId: Annotation<string>(),
  bookId: Annotation<string>(),
  userMessage: Annotation<string>(),

  // Memory tiers
  activeContext: Annotation<Message[]>(),
  recentSummaries: Annotation<SummaryChunk[]>(),
  recalled: Annotation<SummaryChunk[]>(),
  structuredMemory: Annotation<StructuredMemory>(),

  // Intent
  intent: Annotation<ClassifiedIntent>(),

  // Retrieval
  lowLevelResults: Annotation<LowLevelResult[]>(),
  highLevelResults: Annotation<HighLevelResult[]>(),
  fusedContext: Annotation<string>(),

  // Output
  assistantMessage: Annotation<string>(),

  // Idea graph
  newIdeaNodes: Annotation<unknown[]>(),
})

export type ChatStateType = typeof ChatState.State
