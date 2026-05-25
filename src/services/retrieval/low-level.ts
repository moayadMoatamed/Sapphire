import { embedQuery } from '@/services/llm/adapter'
import { vectorSearchEntities, getEntityNeighbors } from '@/services/graph/book-graph'

export interface LowLevelResult {
  entity: { id: string; name: string; type: string; description: string }
  score: number
  neighbors: Array<{
    entity: { id: string; name: string; type: string }
    relationshipType: string
    description: string
  }>
  chunks: Array<{ content: string; headings: Record<string, string>; chunkId: string }>
}

export async function retrieveLowLevel(
  bookId: string,
  query: string,
  k: number = 12,
): Promise<LowLevelResult[]> {
  const queryVector = await embedQuery(query)
  const hits = await vectorSearchEntities(bookId, queryVector, k)

  const results: LowLevelResult[] = []
  for (const hit of hits) {
    const neighbors = await getEntityNeighbors(bookId, hit.entity.id)
    results.push({
      entity: {
        id: hit.entity.id,
        name: hit.entity.name,
        type: hit.entity.type,
        description: hit.entity.description,
      },
      score: hit.score,
      neighbors: neighbors.slice(0, 5),
      chunks: [],
    })
  }

  return results
}
