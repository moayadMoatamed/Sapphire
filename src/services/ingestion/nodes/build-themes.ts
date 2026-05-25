import { extract, embed } from '@/services/llm/adapter'
import { z } from 'zod'
import { randomUUID as uuid } from 'node:crypto'
import type { ResolvedEntity, Relationship, Theme } from '../state'

const THEME_SUMMARY_PROMPT = `You are identifying high-level themes from a cluster of related entities in a book.

Given a set of entities and their relationships, identify the overarching theme that connects them.
Synthesize a 2-3 paragraph summary and list the key entities that define this theme.
Each entity has an ID in brackets like [a1b2c3d4]. Use these IDs for keyEntityIds.

Respond with a JSON object containing:
- title: string (a short name for the theme)
- summary: string (2-3 paragraph synthesis)
- keyEntityIds: string[] (array of entity IDs in brackets that define this theme)`

const ThemeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyEntityIds: z.array(z.string()),
})

export async function buildThemes(
  entities: ResolvedEntity[],
  relationships: Relationship[],
): Promise<Theme[]> {
  if (entities.length < 3) return []

  // Cluster entities by relationship connectivity
  const clusters = clusterByConnectivity(entities, relationships)

  const themes: Theme[] = []

  for (const cluster of clusters) {
    if (cluster.length < 3) continue

    // Build prefix map for resolving truncated IDs
    const prefixMap = new Map<string, string>()
    for (const e of cluster) {
      prefixMap.set(e.id.slice(0, 8), e.id)
    }

    const entityDescriptions = cluster
      .map((e) => `[${e.id.slice(0, 8)}] ${e.name} (${e.type}): ${e.description}`)
      .join('\n')

    const clusterRels = relationships.filter(
      (r) =>
        cluster.some((e) => e.id === r.sourceId) &&
        cluster.some((e) => e.id === r.targetId),
    )

    const relDescriptions = clusterRels
      .slice(0, 10)
      .map((r) => {
        const src = entities.find((e) => e.id === r.sourceId)
        const tgt = entities.find((e) => e.id === r.targetId)
        return `- ${src?.name ?? '?'} ${r.type} ${tgt?.name ?? '?'}`
      })
      .join('\n')

    try {
      const result = await extract<z.infer<typeof ThemeSchema>>(
        'deepseek-chat',
        THEME_SUMMARY_PROMPT,
        `Entities:\n${entityDescriptions}\n\nRelationships:\n${relDescriptions}`,
        ThemeSchema,
      )

      themes.push({
        id: uuid(),
        title: result.title,
        summary: result.summary,
        keyEntityIds: result.keyEntityIds
          .map((id) => prefixMap.get(id) ?? id)
          .filter((id) => cluster.some((e) => e.id === id)),
      })
    } catch (err) {
      console.error('Theme extraction failed for cluster:', err)
    }
  }

  return themes
}

function clusterByConnectivity(
  entities: ResolvedEntity[],
  relationships: Relationship[],
): ResolvedEntity[][] {
  const adj = new Map<string, Set<string>>()
  for (const e of entities) {
    adj.set(e.id, new Set())
  }

  for (const r of relationships) {
    adj.get(r.sourceId)?.add(r.targetId)
    adj.get(r.targetId)?.add(r.sourceId)
  }

  const visited = new Set<string>()
  const clusters: ResolvedEntity[][] = []

  for (const e of entities) {
    if (visited.has(e.id)) continue

    const cluster: ResolvedEntity[] = []
    const queue = [e.id]

    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)

      const entity = entities.find((x) => x.id === id)
      if (entity) cluster.push(entity)

      const neighbors = adj.get(id)
      if (neighbors) {
        for (const n of neighbors) {
          if (!visited.has(n)) queue.push(n)
        }
      }
    }

    if (cluster.length > 0) clusters.push(cluster)
  }

  return clusters
}
