import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined
  pool: Pool | undefined
}

function createConnection() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  console.log('[DB] Creating connection pool to:', connectionString.replace(/\/\/.*@/, '//<creds>@'))

  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 15000,
  })

  return { pool, db: drizzle(pool, { schema }) }
}

const { db: _db, pool: _pool } = globalForDb.db
  ? { db: globalForDb.db, pool: globalForDb.pool! }
  : createConnection()

export const db = _db
export const pool = _pool

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db
  globalForDb.pool = pool
}
