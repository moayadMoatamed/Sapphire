import { embed } from '@/services/llm/adapter'
import type { ResolvedEntity, Theme, Chunk } from '../state'

export async function embedAll(
  chunks: Chunk[],
  entities: ResolvedEntity[],
  themes: Theme[],
): Promise<{
  chunks: (Chunk & { embedding: number[] })[]
  entities: (ResolvedEntity & { embedding: number[] })[]
  themes: (Theme & { embedding: number[] })[]
}> {
  // Combine all texts into one embed call to respect rate limits
  const texts: { type: 'chunk' | 'entity' | 'theme'; index: number; text: string }[] = []

  chunks.forEach((c, i) => texts.push({ type: 'chunk', index: i, text: c.content.slice(0, 500) }))
  entities.forEach((e, i) => texts.push({ type: 'entity', index: i, text: `${e.name} (${e.type}): ${e.description}` }))
  themes.forEach((t, i) => texts.push({ type: 'theme', index: i, text: `${t.title}: ${t.summary}` }))

  const allEmbeddings = texts.length > 0
    ? await embed(texts.map((t) => t.text))
    : []

  const chunkEmbeddings: number[][] = []
  const entityEmbeddings: number[][] = []
  const themeEmbeddings: number[][] = []

  texts.forEach((t, i) => {
    if (t.type === 'chunk') chunkEmbeddings[t.index] = allEmbeddings[i]
    else if (t.type === 'entity') entityEmbeddings[t.index] = allEmbeddings[i]
    else themeEmbeddings[t.index] = allEmbeddings[i]
  })

  return {
    chunks: chunks.map((c, i) => ({ ...c, embedding: chunkEmbeddings[i] })),
    entities: entities.map((e, i) => ({ ...e, embedding: entityEmbeddings[i] })),
    themes: themes.map((t, i) => ({ ...t, embedding: themeEmbeddings[i] })),
  }
}
