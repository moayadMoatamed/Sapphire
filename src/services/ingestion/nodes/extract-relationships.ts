import pLimit from 'p-limit'
import { extract } from '@/services/llm/adapter'
import { z } from 'zod'
import type { ResolvedEntity, Relationship } from '../state'
import { randomUUID as uuid } from 'node:crypto'

const VALID_REL_TYPES = [
  'INFLUENCES', 'CRITIQUES', 'EXTENDS', 'CONTRADICTS',
  'IS_A', 'PART_OF', 'AUTHORED', 'MENTIONS',
  'CAUSES', 'EXEMPLIFIES', 'DEFINES', 'PROVES',
] as const

function normalizeRelType(type: string): Relationship['type'] {
  const upper = type.toUpperCase().replace(/ /g, '_')
  if (VALID_REL_TYPES.includes(upper as typeof VALID_REL_TYPES[number])) {
    return upper as Relationship['type']
  }
  return 'MENTIONS' // Default fallback
}

function normalizeConfidence(c: string): 'high' | 'medium' | 'low' {
  const lower = c.toLowerCase()
  if (lower === 'high' || lower === 'medium' || lower === 'low') return lower
  return 'medium'
}

const RELATIONSHIP_PROMPT = `You are identifying meaningful relationships between entities extracted from a book.

For each pair of entities, determine if there is a meaningful relationship, and if so, classify it.
Only report relationships that are clearly supported. Prefer fewer high-confidence relationships over many speculative ones.

A meaningful relationship is one where:
- One entity influences, critiques, extends, or contradicts another
- One entity is a type/part/exemplification of another
- One entity authored/created/wrote another
- One entity causes or defines another

Respond with a JSON object containing a "relationships" array. Each relationship object must have:
- sourceId: string (the entity ID from the list)
- targetId: string (the entity ID from the list)
- type: string (one of: INFLUENCES, CRITIQUES, EXTENDS, CONTRADICTS, IS_A, PART_OF, AUTHORED, MENTIONS, CAUSES, EXEMPLIFIES, DEFINES, PROVES)
- description: string (short description of the relationship)
- evidence: string (the evidence phrase from the text)
- confidence: string (high, medium, or low)

If there are no clear relationships, return {"relationships": []}.`

const RelationshipRaw = z.object({
  sourceId: z.string().nullable().optional().default(''),
  targetId: z.string().nullable().optional().default(''),
  type: z.string().nullable().optional().default(''),
  description: z.string().nullable().optional().default(''),
  evidence: z.string().nullable().optional().default(''),
  confidence: z.string().nullable().optional().default('medium'),
})

const RelationshipsExtractionSchema = z.object({
  relationships: z.array(RelationshipRaw),
})

export async function extractRelationships(
  entities: ResolvedEntity[],
): Promise<Relationship[]> {
  if (entities.length <= 1) return []

  const limit = pLimit(4)
  const allRelationships: Relationship[] = []

  const pairs: [ResolvedEntity, ResolvedEntity][] = []
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      pairs.push([entities[i], entities[j]])
    }
  }

  // Cap pairs to avoid O(n²) explosion — sample most connected entities
  const batchSize = 20
  const MAX_PAIRS = 200
  if (pairs.length > MAX_PAIRS) {
    // Prioritize pairs from first entities (assumed most important by extraction order)
    pairs.length = MAX_PAIRS
  }
  const batches: [ResolvedEntity, ResolvedEntity][][] = []
  for (let i = 0; i < pairs.length; i += batchSize) {
    batches.push(pairs.slice(i, i + batchSize))
  }

  const results = await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        const entityList = batch
          .flatMap<[ResolvedEntity, number]>(([a, b]) => [[a, 0], [b, 0]])
          .filter(([, idx], i, arr) => {
            const e = arr[i][0]
            const first = arr.findIndex(([x]) => x.id === e.id)
            return first === i
          })
          .map(([e]) => e)

        const entityMap = entityList
          .map((e) => `[${e.id.slice(0, 8)}] ${e.name} (${e.type}): ${e.description}`)
          .join('\n')

        const pairList = batch
          .map(([a, b]) => `- ${a.id.slice(0, 8)} ↔ ${b.id.slice(0, 8)}: ${a.name} ↔ ${b.name}`)
          .join('\n')

        try {
          const raw = await extract<z.infer<typeof RelationshipsExtractionSchema>>(
            'deepseek-chat',
            RELATIONSHIP_PROMPT,
            `Entities:\n${entityMap}\n\nPairs to examine:\n${pairList}`,
            RelationshipsExtractionSchema,
            { maxTokens: 4096 },
          )

          // Build prefix map: 8-char truncated ID → full UUID
          const prefixMap = new Map<string, string>()
          for (const e of entityList) {
            prefixMap.set(e.id.slice(0, 8), e.id)
          }

          return raw.relationships
            .filter((r) => typeof r.sourceId === 'string' && r.sourceId.trim()
              && typeof r.targetId === 'string' && r.targetId.trim()
              && typeof r.type === 'string' && r.type.trim())
            .filter((r) => typeof r.confidence === 'string' && r.confidence.toLowerCase() !== 'low')
            .map((r) => {
              const srcId = (r.sourceId ?? '').trim()
              const tgtId = (r.targetId ?? '').trim()
              // Resolve truncated IDs to full UUIDs
              const fullSrc = prefixMap.get(srcId) ?? srcId
              const fullTgt = prefixMap.get(tgtId) ?? tgtId
              return {
                id: uuid(),
                sourceId: fullSrc,
                targetId: fullTgt,
                type: normalizeRelType(r.type ?? ''),
                description: r.description ?? '',
                evidence: r.evidence ?? '',
                confidence: normalizeConfidence(r.confidence ?? 'medium'),
              }
            })
        } catch (err) {
          console.error('Relationship extraction failed:', err)
          return []
        }
      }),
    ),
  )

  for (const result of results) {
    if (result) {
      allRelationships.push(...result)
    }
  }

  return allRelationships
}
