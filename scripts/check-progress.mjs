const bookId = process.argv[2] || '5788bcb5-828c-44f9-bcf5-3418350e6a51'

async function check() {
  const res = await fetch(`http://localhost:3000/api/books/${bookId}`)
  const book = await res.json()
  console.log('Status:', book.status)
  console.log('Message:', book.statusMessage)
  console.log('Entities:', book.entityCount)
  console.log('Relationships:', book.relationshipCount)
  console.log('Themes:', book.themeCount)
}

check().catch(console.error)
