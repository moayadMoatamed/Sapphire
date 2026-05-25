const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY

export type ModelName = 'deepseek-chat'

const MODEL_IDS: Record<ModelName, string> = {
  'deepseek-chat': 'deepseek-chat',
}

export async function generate(
  model: ModelName,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  opts?: { maxTokens?: number },
): Promise<AsyncIterable<{ content: string }>> {
  const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_IDS[model],
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: opts?.maxTokens ?? 4096,
      stream: true,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`DeepSeek API error: ${response.status} ${err}`)
  }

  return {
    async *[Symbol.asyncIterator]() {
      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              yield { content: delta }
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }
    },
  }
}

export async function extract<T>(
  model: ModelName,
  systemPrompt: string,
  input: string,
  schema: { parse: (data: unknown) => T },
  opts?: { maxTokens?: number },
): Promise<T> {
  const response = await fetchWithRetry(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_IDS[model],
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}\n\nYou MUST respond with ONLY valid JSON. No other text, no markdown fences.`,
        },
        { role: 'user', content: input },
      ],
      max_tokens: opts?.maxTokens ?? 4096,
      temperature: 0.1,
    }),
  })

  const data = await response.json()
  console.error('[extract] Raw API response:', JSON.stringify(data).slice(0, 500))
  let jsonText = data.choices?.[0]?.message?.content?.trim() ?? ''

  // Strip markdown fences if present
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7, -3).trim()
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3, -3).trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    // Try to fix unterminated strings by truncating the last incomplete line
    const lastNewline = jsonText.lastIndexOf('\n')
    if (lastNewline > 0) {
      try {
        parsed = JSON.parse(jsonText.slice(0, lastNewline).trim() + '\n]}')
      } catch {
        parsed = {}
      }
    } else {
      parsed = {}
    }
  }

  // Try to salvage arrays by wrapping in common container keys
  if (Array.isArray(parsed)) {
    parsed = { ideas: parsed, entities: parsed, claims: parsed }
  }
  if (parsed === null || parsed === undefined) {
    parsed = {}
  }

  return schema.parse(parsed)
}

export async function embed(
  texts: string[],
  model: string = 'voyage-3-large',
): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY is not set')
  }

  if (texts.length === 0) return []

  const batchSize = 64
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)

    const response = await fetchWithRetry(
      'https://api.voyageai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: batch,
          model,
          input_type: 'document',
        }),
      },
    )

    const data = (await response.json()) as { data?: { embedding: number[] }[] }
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error(`Voyage API returned unexpected response: ${JSON.stringify(data)}`)
    }
    results.push(...data.data.map((d) => d.embedding))

    if (i + batchSize < texts.length) {
      await sleep(25000)
    }
  }

  return results
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options)
    if (response.ok) return response

    if (response.status === 429 && attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 5000 + Math.random() * 3000
      console.warn(`Rate limited (429), retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms...`)
      await sleep(delay)
      continue
    }

    const body = await response.text()
    throw new Error(`API request failed: ${response.status} ${response.statusText} — ${body}`)
  }
  throw new Error('Unreachable')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function embedQuery(query: string, model: string = 'voyage-3-large'): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not set')

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [query],
      model,
      input_type: 'query',
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Voyage embedding error: ${response.status} ${err}`)
  }

  const data = (await response.json()) as { data?: { embedding: number[] }[] }
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error(`Voyage query embedding returned unexpected response: ${JSON.stringify(data)}`)
  }
  return data.data[0].embedding
}
