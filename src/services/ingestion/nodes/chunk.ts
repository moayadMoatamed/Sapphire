import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { randomUUID as uuid } from 'node:crypto'
import type { IngestionStateType, Chunk } from '../state'

export async function chunkNode(state: IngestionStateType): Promise<Partial<IngestionStateType>> {
  const markdown = state.markdown ?? ''

  if (!markdown.trim()) {
    throw new Error('No markdown content to chunk — parsing may have failed')
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 200,
    separators: ['\n\n## ', '\n\n### ', '\n\n', '\n', ' ', ''],
  })

  const docs = await splitter.createDocuments([markdown])

  const chunks: Chunk[] = docs.map((doc, i) => ({
    id: uuid(),
    content: doc.pageContent,
    headings: (doc.metadata as Record<string, string>) ?? {},
    orderIndex: i,
  }))

  return {
    chunks,
    progress: {
      stage: 'chunking',
      message: `Split into ${chunks.length} chunks`,
      percent: 10,
      stats: { chunks: chunks.length },
    },
  }
}
