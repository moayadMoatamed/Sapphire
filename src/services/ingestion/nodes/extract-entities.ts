import pLimit from 'p-limit'
import { extract } from '@/services/llm/adapter'
import { z } from 'zod'
import type { RawEntity, RawClaim, Chunk } from '../state'

const ENTITY_EXTRACTION_PROMPT = `You are extracting named entities and claims from a book chunk for a knowledge graph.

Extract entities that are SPECIFIC and NOTABLE: people, concepts, theories, works, places, events, organizations.
Do NOT extract generic words like "knowledge", "system", "idea" unless they are specific named concepts in the text.
Use canonical/formal names ("Immanuel Kant" not "Kant", full book titles).

For claims: extract factual assertions the text makes about entities. Include the exact evidence phrase from the chunk.

Respond with a JSON object containing:
- entities: array of { name: string, type: string (one of Person/Concept/Theory/Work/Place/Event/Organization), description: string, aliases: string[] }
- claims: array of { subject: string, predicate: string, object: string, evidence: string }`

const EntitySchema = z.object({
  name: z.string(),
  type: z.enum(['Person', 'Concept', 'Theory', 'Work', 'Place', 'Event', 'Organization']),
  description: z.string(),
  aliases: z.array(z.string()).default([]),
})

const ClaimSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
  evidence: z.string(),
})

const EntitySchemaRaw = z.object({
  name: z.string().nullable().optional().default(''),
  type: z.string().nullable().optional().default('Concept'),
  description: z.string().nullable().optional().default(''),
  aliases: z.array(z.string()).nullable().optional().default([]),
})

const ClaimSchemaRaw = z.object({
  subject: z.string().nullable().optional().default(''),
  predicate: z.string().nullable().optional().default(''),
  object: z.string().nullable().optional().default(''),
  evidence: z.string().nullable().optional().default(''),
})

const ExtractionSchema = z.object({
  entities: z.array(EntitySchemaRaw),
  claims: z.array(ClaimSchemaRaw),
})

type ExtractionResult = z.infer<typeof ExtractionSchema>

function normalizeEntityType(type: string): RawEntity['type'] {
  const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
  const validTypes = ['Person', 'Concept', 'Theory', 'Work', 'Place', 'Event', 'Organization']
  if (validTypes.includes(normalized)) return normalized as RawEntity['type']
  return 'Concept' // Default fallback
}

export async function extractEntities(chunks: Chunk[], bookId: string): Promise<{
  rawEntities: RawEntity[]
  rawClaims: RawClaim[]
}> {
  const limit = pLimit(8)
  const allEntities: RawEntity[] = []
  const allClaims: RawClaim[] = []

  const results = await Promise.all(
    chunks.map((chunk) =>
      limit(async () => {
        try {
          const extracted = await extract<ExtractionResult>(
            'deepseek-chat',
            ENTITY_EXTRACTION_PROMPT,
            chunk.content,
            ExtractionSchema,
            { maxTokens: 2048 },
          )

          return {
            entities: extracted.entities
              .filter((e) => typeof e.name === 'string' && e.name.trim().length > 0)
              .map((e) => ({
                name: (e.name ?? '').trim(),
                type: normalizeEntityType(e.type ?? ''),
                description: (e.description ?? '').trim(),
                aliases: (e.aliases ?? []).filter((a) => typeof a === 'string' && a.trim()),
                chunkId: chunk.id,
              })),
            claims: extracted.claims
              .filter((c) => typeof c.subject === 'string' && c.subject.trim().length > 0)
              .map((c) => ({
                subject: (c.subject ?? '').trim(),
                predicate: (c.predicate ?? '').trim(),
                object: (c.object ?? '').trim(),
                evidence: (c.evidence ?? '').trim(),
                chunkId: chunk.id,
              })),
          }
        } catch (err) {
          console.error(`Entity extraction failed for ${chunk.id}:`, err)
          return { entities: [], claims: [] }
        }
      }),
    ),
  )

  for (const result of results) {
    if (result) {
      allEntities.push(...result.entities)
      allClaims.push(...result.claims)
    }
  }

  return { rawEntities: allEntities, rawClaims: allClaims }
}
