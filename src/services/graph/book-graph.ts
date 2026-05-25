import { db } from '@/db'
import { bookEntities, bookThemes, bookChunks, bookRelationships } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { ResolvedEntity, Theme, Chunk, Relationship } from '@/services/ingestion/state'

export async function queryBookGraph(bookId: string): Promise<{
  nodes: Array<{ id: string; label: string; type: string; properties: Record<string, unknown> }>
  edges: Array<{ source: string; target: string; type: string }>
}> {
  const entities = await db
    .select()
    .from(bookEntities)
    .where(eq(bookEntities.bookId, bookId))

  const relationships = await db
    .select()
    .from(bookRelationships)
    .where(eq(bookRelationships.bookId, bookId))

  const nodes = entities.map((e) => ({
    id: e.id,
    label: e.name,
    type: e.type,
    properties: {
      description: e.description,
      aliases: e.aliases,
    } as Record<string, unknown>,
  }))

  const edges = relationships.map((r) => ({
    source: r.sourceEntityId,
    target: r.targetEntityId,
    type: r.type,
  }))

  return { nodes, edges }
}

export async function vectorSearchEntities(
  bookId: string,
  queryVector: number[],
  k: number = 12,
): Promise<Array<{
  entity: ResolvedEntity
  score: number
}>> {
  const entities = await db
    .select()
    .from(bookEntities)
    .where(eq(bookEntities.bookId, bookId))

  // Compute cosine similarity in JS
  const scored = entities
    .filter((e) => e.embedding && e.embedding.length > 0)
    .map((e) => ({
      entity: {
        id: e.id,
        name: e.name,
        type: e.type,
        description: e.description,
        aliases: (e.aliases ?? []) as string[],
        chunkIds: (e.chunkIds ?? []) as string[],
      } as ResolvedEntity,
      score: cosineSimilarity(queryVector, e.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)

  return scored
}

export async function vectorSearchThemes(
  bookId: string,
  queryVector: number[],
  k: number = 5,
): Promise<Array<{ theme: Theme; score: number }>> {
  const themes = await db
    .select()
    .from(bookThemes)
    .where(eq(bookThemes.bookId, bookId))

  const scored = themes
    .filter((t) => t.embedding && t.embedding.length > 0)
    .map((t) => ({
      theme: {
        id: t.id,
        title: t.title,
        summary: t.summary,
        keyEntityIds: (t.keyEntityIds ?? []) as string[],
      } as Theme,
      score: cosineSimilarity(queryVector, t.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)

  return scored
}

export async function getEntityNeighbors(
  bookId: string,
  entityId: string,
): Promise<Array<{
  entity: { id: string; name: string; type: string }
  relationshipType: string
  description: string
}>> {
  const relationships = await db
    .select()
    .from(bookRelationships)
    .where(eq(bookRelationships.bookId, bookId))

  const neighbors = relationships
    .filter((r) => r.sourceEntityId === entityId || r.targetEntityId === entityId)
    .map((r) => {
      const neighborId = r.sourceEntityId === entityId ? r.targetEntityId : r.sourceEntityId
      return { neighborId, relationshipType: r.type, description: r.description }
    })

  if (neighbors.length === 0) return []

  const entityIds = [...new Set(neighbors.map((n) => n.neighborId))]
  const entityRows = await db
    .select({ id: bookEntities.id, name: bookEntities.name, type: bookEntities.type })
    .from(bookEntities)
    .where(eq(bookEntities.bookId, bookId))

  const entityMap = new Map(entityRows.map((e) => [e.id, e]))

  return neighbors.map((n) => ({
    entity: entityMap.get(n.neighborId) ?? { id: n.neighborId, name: 'Unknown', type: 'Unknown' },
    relationshipType: n.relationshipType,
    description: n.description,
  }))
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
