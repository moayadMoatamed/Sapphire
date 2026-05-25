import { readFileSync } from 'fs'
import path from 'path'

const BASE = 'http://localhost:3000'

// Step 1: Upload
console.log('=== Step 1: Uploading PDF ===')
const filePath = 'testing_materials/M-654.pdf'
const fileContent = readFileSync(filePath)
const fileName = path.basename(filePath)
const formData = new FormData()
formData.append('file', new Blob([fileContent], { type: 'application/pdf' }), fileName)

const uploadRes = await fetch(`${BASE}/api/books/upload`, { method: 'POST', body: formData })
const { bookId, error: uploadError } = await uploadRes.json()

if (uploadError) {
  console.error('Upload failed:', uploadError)
  process.exit(1)
}

console.log('Uploaded! Book ID:', bookId)

// Step 2: Poll for completion
console.log('\n=== Step 2: Monitoring ingestion ===')
let lastStatus = ''
const maxWait = 300 // 5 minutes
const startTime = Date.now()

while (true) {
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  if (elapsed > maxWait) {
    console.log('Timed out after', maxWait, 's')
    break
  }

  const res = await fetch(`${BASE}/api/books/${bookId}`)
  const book = await res.json()

  if (book.status !== lastStatus) {
    lastStatus = book.status
    console.log(`[${elapsed}s] Status: ${book.status} — ${book.statusMessage ?? ''}`)
  }

  if (book.status === 'ready') {
    console.log('\n=== Ingestion complete! ===')
    console.log('Entities:', book.entityCount)
    console.log('Relationships:', book.relationshipCount)
    console.log('Themes:', book.themeCount)
    break
  }

  if (book.status === 'error') {
    console.log('\n=== Ingestion FAILED ===')
    console.log('Error:', book.statusMessage)
    break
  }

  await new Promise((r) => setTimeout(r, 3000))
}

// Step 3: Test graph query
console.log('\n=== Step 3: Testing graph query ===')
try {
  const graphRes = await fetch(`${BASE}/api/graph/book/${bookId}`)
  const graph = await graphRes.json()
  console.log('Nodes:', graph.nodes?.length ?? 0)
  console.log('Edges:', graph.edges?.length ?? 0)
} catch (e) {
  console.log('Graph query failed:', e.message)
}

console.log('\nBook URL:', `${BASE}/books/${bookId}`)
