import type { ChatStateType } from '../state'

export async function fuseContextNode(state: {
  lowLevelResults: unknown[]
  highLevelResults: unknown[]
  intent?: { lowLevelWeight?: number; highLevelWeight?: number }
}): Promise<Partial<ChatStateType>> {
  const intent = state.intent ?? {}
  const { fuseContext } = await import('@/services/retrieval/fuse-context')
  const fused = fuseContext(
    (state.lowLevelResults ?? []) as Parameters<typeof fuseContext>[0],
    (state.highLevelResults ?? []) as Parameters<typeof fuseContext>[1],
    {
      lowWeight: intent.lowLevelWeight ?? 0.5,
      highWeight: intent.highLevelWeight ?? 0.5,
      tokenBudget: 3000,
      topN: 20,
    },
  )
  return { fusedContext: fused }
}
