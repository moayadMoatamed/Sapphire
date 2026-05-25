import type { LowLevelResult } from './low-level'
import type { HighLevelResult } from './high-level'

interface FuseOptions {
  lowWeight: number
  highWeight: number
  tokenBudget: number
  topN: number
}

export function fuseContext(
  lowResults: LowLevelResult[],
  highResults: HighLevelResult[],
  opts: FuseOptions,
): string {
  // Calculate fused scores
  interface ScoredEntity {
    id: string
    name: string
    type: string
    description: string
    fusedScore: number
    themes: string[]
  }

  const entityMap = new Map<string, ScoredEntity>()

  for (const r of lowResults) {
    const existing = entityMap.get(r.entity.id)
    const score = r.score * opts.lowWeight + (existing?.fusedScore ?? 0)
    entityMap.set(r.entity.id, {
      id: r.entity.id,
      name: r.entity.name,
      type: r.entity.type,
      description: r.entity.description,
      fusedScore: score,
      themes: existing?.themes ?? [],
    })
  }

  for (const r of highResults) {
    for (const e of r.representativeEntities) {
      const existing = entityMap.get(e.id)
      const score = r.score * opts.highWeight + (existing?.fusedScore ?? 0)
      entityMap.set(e.id, {
        id: e.id,
        name: e.name,
        type: e.type,
        description: existing?.description ?? '',
        fusedScore: score,
        themes: [...(existing?.themes ?? []), r.theme.title],
      })
    }
  }

  // Sort by fused score and take top N
  const sorted = [...entityMap.values()]
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, opts.topN)

  // Build the context block
  const themeLines: string[] = []
  for (const r of highResults) {
    const summary = r.theme.summary.slice(0, 400)
    themeLines.push(`- **Theme: "${r.theme.title}"** — ${summary}`)
  }

  const entityLines = sorted.map((e) => {
    return `- **${e.name}** (${e.type}) — ${e.description.slice(0, 200)}`
  })

  const sections = [
    '## Relevant from the book\n',
    themeLines.length > 0 ? `### Themes\n${themeLines.join('\n')}` : '',
    entityLines.length > 0 ? `### Key entities\n${entityLines.join('\n')}` : '',
  ].filter(Boolean)

  const context = sections.join('\n\n')

  // Rough token budget enforcement
  const estimatedTokens = context.split(/\s+/).length
  if (estimatedTokens > opts.tokenBudget) {
    return context.slice(0, Math.floor(opts.tokenBudget * 4)) + '\n...(truncated)'
  }

  return context
}
