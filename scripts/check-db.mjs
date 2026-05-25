import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL)

const bookId = process.argv[2]
if (bookId) {
  const [book] = await sql`SELECT status, status_message, entity_count, relationship_count, theme_count FROM books WHERE id = ${bookId}`
  console.log(JSON.stringify(book, null, 2))
} else {
  const books = await sql`SELECT id, title, status, entity_count, relationship_count, theme_count FROM books ORDER BY created_at DESC LIMIT 10`
  for (const b of books) {
    console.log(`${b.id} | ${b.title} | ${b.status} | entities=${b.entity_count} | rels=${b.relationship_count} | themes=${b.theme_count}`)
  }
}

await sql.end()
