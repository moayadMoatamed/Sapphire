import { embedQuery } from '@/services/llm/adapter'
import { vectorSearchThemes } from '@/services/graph/book-graph'
import { db } from '@/db'
import { bookEntities } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

export interface HighLevelResult {
  theme: { id: string; title: string; summary: string }
  score: number
  representativeEntities: Array<{ id: string; name: string; type: string }>
}

export async function retrieveHighLevel(
  bookId: string,
  query: string,
  k: number = 5,
): Promise<HighLevelResult[]> {
  const queryVector = await embedQuery(query)
  const hits = await vectorSearchThemes(bookId, queryVector, k)

  const results: HighLevelResult[] = []
  for (const hit of hits) {
    const keyIds = (hit.theme.keyEntityIds ?? []).slice(0, 5)
    let entities: Array<{ id: string; name: string; type: string }> = []

    if (keyIds.length > 0) {
      const rows = await db
        .select({ id: bookEntities.id, name: bookEntities.name, type: bookEntities.type })
        .from(bookEntities)
        .where(inArray(bookEntities.id, keyIds))
      entities = rows.map((r) => ({ id: r.id, name: r.name, type: r.type }))
    }

    results.push({
      theme: {
        id: hit.theme.id,
        title: hit.theme.title,
        summary: hit.theme.summary,
      },
      score: hit.score,
      representativeEntities: entities,
    })
  }

  return results
}
