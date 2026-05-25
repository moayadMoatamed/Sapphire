import { StateGraph } from '@langchain/langgraph'
import { IngestionState } from './state'
import { parseNode } from './nodes/parse'
import { chunkNode } from './nodes/chunk'
import { extractEntities } from './nodes/extract-entities'
import { resolveEntities } from './nodes/resolve-duplicates'
import { extractRelationships } from './nodes/extract-relationships'
import { buildThemes } from './nodes/build-themes'
import { embedAll } from './nodes/embed'
import { writeGraph, finalizeNode } from './nodes/write-graph'
import { db } from '@/db'
import { books } from '@/db/schema'
import { eq } from 'drizzle-orm'

async function updateBookStatus(bookId: string, stage: string, message: string) {
  try {
    await db
      .update(books)
      .set({ status: stage, statusMessage: message, updatedAt: new Date() })
      .where(eq(books.id, bookId))
  } catch (err) {
    console.error(`Failed to update book status to ${stage}:`, err)
  }
}

function buildIngestionGraph() {
  const graph = new StateGraph(IngestionState)
    .addNode('parse', async (state) => {
      await updateBookStatus(state.bookId, 'parsing', 'Parsing PDF with LlamaParse...')
      return await parseNode(state)
    })
    .addNode('chunk', async (state) => {
      await updateBookStatus(state.bookId, 'chunking', 'Splitting markdown into chunks...')
      return await chunkNode(state)
    })
    .addNode('extract_entities', async (state) => {
      await updateBookStatus(state.bookId, 'extracting_entities', 'Extracting entities...')
      const { rawEntities, rawClaims } = await extractEntities(
        state.chunks ?? [],
        state.bookId,
      )
      return {
        rawEntities,
        rawClaims,
        progress: {
          stage: 'extracting_entities',
          message: `Extracted ${rawEntities.length} entities, ${rawClaims.length} claims`,
          percent: 25,
          stats: { entities: rawEntities.length },
        },
      }
    })
    .addNode('resolve_duplicates', async (state) => {
      await updateBookStatus(state.bookId, 'resolving', 'Resolving duplicate entities...')
      const entities = await resolveEntities(state.rawEntities ?? [])
      return {
        entities,
        progress: {
          stage: 'resolving',
          message: `Resolved to ${entities.length} unique entities`,
          percent: 40,
          stats: { entities: entities.length },
        },
      }
    })
    .addNode('extract_relationships', async (state) => {
      await updateBookStatus(state.bookId, 'relationships', 'Extracting relationships...')
      const relationships = await extractRelationships(state.entities ?? [])
      return {
        relationships,
        progress: {
          stage: 'relationships',
          message: `Extracted ${relationships.length} relationships`,
          percent: 55,
          stats: { relationships: relationships.length },
        },
      }
    })
    .addNode('build_themes', async (state) => {
      await updateBookStatus(state.bookId, 'themes', 'Building themes...')
      const themes = await buildThemes(
        state.entities ?? [],
        state.relationships ?? [],
      )
      return {
        themes,
        progress: {
          stage: 'themes',
          message: `Built ${themes.length} themes`,
          percent: 70,
          stats: { themes: themes.length },
        },
      }
    })
    .addNode('embed', async (state) => {
      await updateBookStatus(state.bookId, 'embedding', 'Generating embeddings...')
      const result = await embedAll(
        state.chunks ?? [],
        state.entities ?? [],
        state.themes ?? [],
      )
      return {
        chunks: result.chunks,
        entities: result.entities,
        themes: result.themes,
        progress: {
          stage: 'embedding',
          message: 'Embeddings generated',
          percent: 85,
        },
      }
    })
    .addNode('write_graph', async (state) => {
      await updateBookStatus(state.bookId, 'writing', 'Writing graph to database...')
      await writeGraph(state)
      return {
        progress: {
          stage: 'writing',
          message: 'Graph written to database',
          percent: 95,
        },
      }
    })
    .addNode('finalize', async (state) => {
      return await finalizeNode(state)
    })

  graph.addEdge('__start__', 'parse')
  graph.addEdge('parse', 'chunk')
  graph.addEdge('chunk', 'extract_entities')
  graph.addEdge('extract_entities', 'resolve_duplicates')
  graph.addEdge('resolve_duplicates', 'extract_relationships')
  graph.addEdge('extract_relationships', 'build_themes')
  graph.addEdge('build_themes', 'embed')
  graph.addEdge('embed', 'write_graph')
  graph.addEdge('write_graph', 'finalize')
  graph.addEdge('finalize', '__end__')

  return graph
}

export const ingestionGraph = buildIngestionGraph().compile()
