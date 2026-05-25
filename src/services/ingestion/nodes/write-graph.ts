import { db } from '@/db'
import { books, bookChunks, bookEntities, bookRelationships, bookThemes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { IngestionStateType } from '../state'

export async function writeGraph(state: IngestionStateType): Promise<Partial<IngestionStateType>> {
  const chunks = state.chunks ?? []
  const entities = state.entities ?? []
  const relationships = state.relationships ?? []
  const themes = state.themes ?? []

  // Clear existing data for this book (idempotent)
  await db.delete(bookChunks).where(eq(bookChunks.bookId, state.bookId))
  await db.delete(bookEntities).where(eq(bookEntities.bookId, state.bookId))
  await db.delete(bookRelationships).where(eq(bookRelationships.bookId, state.bookId))
  await db.delete(bookThemes).where(eq(bookThemes.bookId, state.bookId))

  // Write chunks
  if (chunks.length > 0) {
    await db.insert(bookChunks).values(
      chunks.map((c) => ({
        bookId: state.bookId,
        content: c.content,
        headings: c.headings ?? {},
        orderIndex: c.orderIndex,
        embedding: c.embedding ?? undefined,
      })),
    )
  }

  // Write entities
  if (entities.length > 0) {
    await db.insert(bookEntities).values(
      entities.map((e) => ({
        id: e.id,
        bookId: state.bookId,
        name: e.name,
        type: e.type,
        description: e.description,
        aliases: e.aliases ?? [],
        chunkIds: e.chunkIds ?? [],
        embedding: e.embedding ?? undefined,
      })),
    )
  }

  // Write relationships
  if (relationships.length > 0) {
    await db.insert(bookRelationships).values(
      relationships.map((r) => ({
        bookId: state.bookId,
        sourceEntityId: r.sourceId,
        targetEntityId: r.targetId,
        type: r.type,
        description: r.description,
        evidence: r.evidence ?? '',
        confidence: r.confidence ?? 'medium',
      })),
    )
  }

  // Write themes
  if (themes.length > 0) {
    await db.insert(bookThemes).values(
      themes.map((t) => ({
        bookId: state.bookId,
        title: t.title,
        summary: t.summary,
        keyEntityIds: t.keyEntityIds ?? [],
        embedding: t.embedding ?? undefined,
      })),
    )
  }

  return {}
}

export async function finalizeNode(state: IngestionStateType): Promise<Partial<IngestionStateType>> {
  const entityCount = (state.entities ?? []).length
  const relationshipCount = (state.relationships ?? []).length
  const themeCount = (state.themes ?? []).length

  await db
    .update(books)
    .set({
      status: 'ready',
      entityCount,
      relationshipCount,
      themeCount,
      ingestionCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(books.id, state.bookId))

  return {
    progress: {
      stage: 'ready',
      message: `Ingestion complete — ${entityCount} entities, ${relationshipCount} relationships, ${themeCount} themes`,
      percent: 100,
      stats: {
        entities: entityCount,
        relationships: relationshipCount,
        themes: themeCount,
      },
    },
  }
}
