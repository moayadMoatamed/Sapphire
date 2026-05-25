import { readFileSync } from 'fs'
import type { IngestionStateType } from '../state'

const LLAMAPARSE_KEY = process.env.LLAMAPARSE_API_KEY

export async function parseNode(state: IngestionStateType): Promise<Partial<IngestionStateType>> {
  if (!LLAMAPARSE_KEY) {
    throw new Error('LLAMAPARSE_API_KEY is not set')
  }

  // Read file as base64
  const fileBuffer = readFileSync(state.filePath)
  const fileName = state.filePath.split(/[\\/]/).pop() ?? 'file.pdf'

  const formData = new FormData()
  formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), fileName)

  // LlamaParse REST API
  const response = await fetch('https://api.cloud.llamaindex.ai/api/v1/parsing/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LLAMAPARSE_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`LlamaParse upload failed: ${response.status} ${errText}`)
  }

  const { id: jobId } = (await response.json()) as { id: string }

  // Poll for results
  const markdown = await pollForResult(jobId)

  return {
    markdown,
    progress: { stage: 'parsing', message: 'PDF parsed successfully', percent: 8 },
  }
}

async function pollForResult(jobId: string): Promise<string> {
  const maxAttempts = 60 // 5 minutes max
  const delay = 5000 // 5 seconds between polls

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(delay)

    const response = await fetch(
      `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/markdown`,
      {
        headers: { Authorization: `Bearer ${LLAMAPARSE_KEY}` },
      },
    )

    if (response.status === 404) {
      continue // Still processing
    }

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`LlamaParse result failed: ${response.status} ${errText}`)
    }

    const data = (await response.json()) as { markdown?: string; text?: string }
    const markdown = data.markdown ?? data.text ?? ''

    if (markdown) {
      return markdown
    }
  }

  throw new Error('LlamaParse timed out waiting for results')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
