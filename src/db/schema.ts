import { pgTable, text, timestamp, uuid, integer, varchar, jsonb, doublePrecision } from 'drizzle-orm/pg-core'

export const books = pgTable('books', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().default('local-user'),
  title: text('title').notNull(),
  author: text('author'),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  pageCount: integer('page_count'),
  status: varchar('status', { length: 32 }).notNull().default('uploading'),
  statusMessage: text('status_message'),
  entityCount: integer('entity_count'),
  relationshipCount: integer('relationship_count'),
  themeCount: integer('theme_count'),
  ingestionCost: text('ingestion_cost'),
  ingestionStartedAt: timestamp('ingestion_started_at', { withTimezone: true }),
  ingestionCompletedAt: timestamp('ingestion_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const bookChunks = pgTable('book_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookId: uuid('book_id').notNull(),
  content: text('content').notNull(),
  headings: jsonb('headings').default({}).notNull(),
  orderIndex: integer('order_index').notNull(),
  embedding: doublePrecision('embedding').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const bookEntities = pgTable('book_entities', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookId: uuid('book_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  aliases: jsonb('aliases').default([]).notNull(),
  chunkIds: jsonb('chunk_ids').default([]).notNull(),
  embedding: doublePrecision('embedding').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const bookRelationships = pgTable('book_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookId: uuid('book_id').notNull(),
  sourceEntityId: uuid('source_entity_id').notNull(),
  targetEntityId: uuid('target_entity_id').notNull(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  evidence: text('evidence'),
  confidence: varchar('confidence', { length: 16 }).notNull().default('medium'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const bookThemes = pgTable('book_themes', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookId: uuid('book_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  keyEntityIds: jsonb('key_entity_ids').default([]).notNull(),
  embedding: doublePrecision('embedding').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().default('local-user'),
  bookId: uuid('book_id').notNull(),
  title: text('title'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const chatIdeaNodes = pgTable('chat_idea_nodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  miniRoundIndex: integer('mini_round_index').notNull().default(0),
  confidence: varchar('confidence', { length: 16 }).notNull().default('medium'),
  linkedBookEntityIds: jsonb('linked_book_entity_ids').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const chatIdeaEdges = pgTable('chat_idea_edges', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull(),
  sourceNodeId: uuid('source_node_id').notNull(),
  targetNodeId: uuid('target_node_id').notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  miniRoundIndex: integer('mini_round_index').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull(),
  role: varchar('role', { length: 16 }).notNull(),
  content: text('content').notNull(),
  tokens: integer('tokens').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const usageLog = pgTable('usage_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').default('local-user'),
  bookId: uuid('book_id'),
  sessionId: uuid('session_id'),
  model: text('model').notNull(),
  tokensIn: integer('tokens_in').notNull(),
  tokensOut: integer('tokens_out').notNull(),
  cost: text('cost').notNull(),
  node: text('node').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
