import { Annotation } from '@langchain/langgraph'

export interface Chunk {
  id: string
  content: string
  headings: Record<string, string>
  orderIndex: number
  embedding?: number[]
}

export interface RawEntity {
  name: string
  type: 'Person' | 'Concept' | 'Theory' | 'Work' | 'Place' | 'Event' | 'Organization'
  description: string
  aliases: string[]
  chunkId: string
}

export interface RawClaim {
  subject: string
  predicate: string
  object: string
  evidence: string
  chunkId: string
}

export interface ResolvedEntity {
  id: string
  name: string
  type: string
  description: string
  aliases: string[]
  chunkIds: string[]
  embedding?: number[]
}

export interface Relationship {
  id: string
  sourceId: string
  targetId: string
  type: string
  description: string
  evidence: string
  confidence: 'high' | 'medium' | 'low'
}

export interface Theme {
  id: string
  title: string
  summary: string
  keyEntityIds: string[]
  embedding?: number[]
}

export interface Progress {
  stage: string
  message: string
  percent: number
  stats?: {
    chunks?: number
    entities?: number
    relationships?: number
    themes?: number
    cost?: string
  }
}

export const IngestionState = Annotation.Root({
  bookId: Annotation<string>(),
  filePath: Annotation<string>(),
  markdown: Annotation<string>(),
  chunks: Annotation<Chunk[]>(),
  rawEntities: Annotation<RawEntity[]>(),
  rawClaims: Annotation<RawClaim[]>(),
  entities: Annotation<ResolvedEntity[]>(),
  relationships: Annotation<Relationship[]>(),
  themes: Annotation<Theme[]>(),
  progress: Annotation<Progress>(),
  errors: Annotation<{ node: string; error: string; at: string }[]>({
    reducer: (curr, next) => [...(curr ?? []), ...next],
    default: () => [],
  }),
})

export type IngestionStateType = typeof IngestionState.State
