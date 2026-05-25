import { embed } from '@/services/llm/adapter'
import { randomUUID as uuid } from 'node:crypto'
import type { RawEntity, ResolvedEntity } from '../state'

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(dr|prof|professor|mr|mrs|ms|sir|dame)\.?\s+/i, '')
    .trim()
}

function mergeDescriptions(entities: RawEntity[]): string {
  const descriptions = [...new Set(entities.map((e) => e.description))]
  return descriptions.slice(0, 3).join(' ')
}

export async function resolveEntities(
  rawEntities: RawEntity[],
): Promise<ResolvedEntity[]> {
  // Step 1: group by normalized name
  const groups = new Map<string, RawEntity[]>()
  for (const entity of rawEntities) {
    const key = normalizeName(entity.name)
    const existing = groups.get(key)
    if (existing) {
      existing.push(entity)
    } else {
      groups.set(key, [entity])
    }
  }

  // Step 2: collect all groups that need embedding
  const multiGroups: RawEntity[][] = []
  for (const [, group] of groups) {
    if (group.length > 1) multiGroups.push(group)
  }

  // Batch all descriptions into one embed call
  const allDescriptions: string[] = []
  const groupIndexes: { groupIdx: number; start: number; end: number }[] = []
  for (const group of multiGroups) {
    const start = allDescriptions.length
    allDescriptions.push(...group.map((e) => e.description))
    const end = allDescriptions.length
    groupIndexes.push({ groupIdx: groupIndexes.length, start, end })
  }

  let allEmbeddings: number[][] = []
  if (allDescriptions.length > 0) {
    try {
      allEmbeddings = await embed(allDescriptions)
    } catch {
      allEmbeddings = []
    }
  }

  // Step 3: deduplicate within each group
  const resolved: ResolvedEntity[] = []

  for (const [, group] of groups) {
    if (group.length === 1) {
      const e = group[0]
      resolved.push({
        id: uuid(),
        name: e.name,
        type: e.type,
        description: e.description,
        aliases: e.aliases,
        chunkIds: [e.chunkId],
      })
      continue
    }

    // Find this group's embeddings in the batched results
    const multiIdx = multiGroups.indexOf(group)
    const gi = groupIndexes[multiIdx]
    if (!gi || allEmbeddings.length < gi.end) {
      // Fallback: treat all as one entity
      resolved.push({
        id: uuid(),
        name: group[0].name,
        type: group[0].type,
        description: mergeDescriptions(group),
        aliases: [...new Set(group.flatMap((e) => e.aliases))],
        chunkIds: group.map((e) => e.chunkId),
      })
      continue
    }

    const embeddings = allEmbeddings.slice(gi.start, gi.end)
    const merged = new Array(group.length).fill(false)

    for (let i = 0; i < group.length; i++) {
      if (merged[i]) continue
      const cluster: RawEntity[] = [group[i]]
      merged[i] = true

      for (let j = i + 1; j < group.length; j++) {
        if (merged[j]) continue
        const sim = cosineSimilarity(embeddings[i], embeddings[j])
        if (sim > 0.92) {
          cluster.push(group[j])
          merged[j] = true
        }
      }

      resolved.push({
        id: uuid(),
        name: cluster[0].name,
        type: cluster[0].type,
        description: mergeDescriptions(cluster),
        aliases: [...new Set(cluster.flatMap((e) => e.aliases))],
        chunkIds: cluster.map((e) => e.chunkId),
      })
    }
  }

  return resolved
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
