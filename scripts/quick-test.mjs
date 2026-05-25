import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://127.0.0.1:3000'

async function main() {
  // Ping server
  try {
    const healthRes = await fetch(`${BASE}/api/health`)
    const health = await healthRes.json()
    console.log('Server:', health.status)
  } catch (e) {
    console.error('Server not reachable:', e.message)
    process.exit(1)
  }

  // Upload
  const filePath = path.join(__dirname, '..', 'testing_materials', 'M-654.pdf')
  console.log('Uploading:', filePath)
  const fileContent = readFileSync(filePath)
  const formData = new FormData()
  formData.append('file', new Blob([fileContent], { type: 'application/pdf' }), 'M-654.pdf')

  const uploadRes = await fetch(`${BASE}/api/books/upload`, { method: 'POST', body: formData })
  const uploadData = await uploadRes.json()

  if (uploadData.error) {
    console.error('Upload failed:', uploadData.error)
    process.exit(1)
  }

  const bookId = uploadData.bookId
  console.log('Book ID:', bookId)

  // Poll
  const start = Date.now()
  let lastStatus = ''
  while (true) {
    const elapsed = Math.round((Date.now() - start) / 1000)
    const res = await fetch(`${BASE}/api/books/${bookId}`)
    const book = await res.json()

    if (book.status !== lastStatus) {
      lastStatus = book.status
      console.log(`[${elapsed}s] ${book.status}: ${book.statusMessage ?? ''}`)
    }

    if (book.status === 'ready') {
      console.log(`\nDone! ${book.entityCount} entities, ${book.relationshipCount} rels, ${book.themeCount} themes`)
      // Test graph query
      const gRes = await fetch(`${BASE}/api/graph/book/${bookId}`)
      const g = await gRes.json()
      console.log(`Graph: ${g.nodes?.length ?? 0} nodes, ${g.edges?.length ?? 0} edges`)
      break
    }

    if (book.status === 'error') {
      console.error(`\nFAILED: ${book.statusMessage}`)
      break
    }

    if (elapsed > 600) {
      console.log('Timed out')
      break
    }

    await new Promise(r => setTimeout(r, 3000))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
