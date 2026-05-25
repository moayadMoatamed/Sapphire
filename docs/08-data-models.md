# 08 — Data Models

Three storage layers, three schemas. Each one is specified concretely so a recruiter or future-you can ground "where does X live?" instantly.

## Postgres (app data + LangGraph checkpoints + L1/L2 memory)

### Drizzle schema sketch

```ts
// src/db/schema.ts
import { pgTable, text, timestamp, integer, jsonb, vector, uuid, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  author: text("author"),
  filePath: text("file_path").notNull(),   // S3/R2 key
  status: text("status", { enum: ["uploading", "parsing", "extracting", "embedding", "ready", "error"] }).notNull().default("uploading"),
  stats: jsonb("stats").$type<BookStats>(),  // entity counts, costs, time
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readyAt: timestamp("ready_at"),
}, (t) => ({
  userIdx: index("books_user_idx").on(t.userId),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  bookId: uuid("book_id").references(() => books.id).notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at"),
}, (t) => ({
  userBookIdx: index("sessions_user_book_idx").on(t.userId, t.bookId),
}));

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  miniRoundIndex: integer("mini_round_index").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  tokens: integer("tokens"),
  metadata: jsonb("metadata").$type<MessageMetadata>(),  // model, latency, cost, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  sessionIdx: index("messages_session_idx").on(t.sessionId, t.miniRoundIndex),
}));

export const chatSummaries = pgTable("chat_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  ordinal: integer("ordinal").notNull(),
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }),
  topicTags: text("topic_tags").array().notNull().default([]),
  coveredMiniRoundStart: integer("covered_mini_round_start").notNull(),
  coveredMiniRoundEnd: integer("covered_mini_round_end").notNull(),
  tokenCountOriginal: integer("token_count_original").notNull(),
  tokenCountSummary: integer("token_count_summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  sessionOrdinalIdx: index("chat_summaries_session_ordinal_idx").on(t.sessionId, t.ordinal),
  embeddingIdx: index("chat_summaries_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  tagsIdx: index("chat_summaries_tags_idx").using("gin", t.topicTags),
}));

export const structuredMemory = pgTable("structured_memory", {
  sessionId: uuid("session_id").primaryKey().references(() => sessions.id),
  data: jsonb("data").$type<StructuredMemoryData>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const crossGraphRefs = pgTable("cross_graph_refs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  chatNodeId: text("chat_node_id").notNull(),
  bookId: uuid("book_id").references(() => books.id).notNull(),
  bookEntityId: text("book_entity_id").notNull(),
  edgeType: text("edge_type", { enum: ["derived-from"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  sessionIdx: index("xgraph_session_idx").on(t.sessionId),
  bookEntityIdx: index("xgraph_book_entity_idx").on(t.bookId, t.bookEntityId),
}));

export const usageLog = pgTable("usage_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  scope: text("scope", { enum: ["ingestion", "chat"] }).notNull(),
  scopeId: uuid("scope_id").notNull(),     // book_id or session_id
  provider: text("provider").notNull(),     // anthropic, voyage, etc.
  model: text("model").notNull(),
  tokensIn: integer("tokens_in").notNull(),
  tokensOut: integer("tokens_out").notNull(),
  costCents: integer("cost_cents").notNull(),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`pgvector` extension required:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

LangGraph checkpoint tables are created automatically by `@langchain/langgraph-checkpoint-postgres` on `setup()`. They live alongside the app tables.

## FalkorDB (knowledge graphs + chat idea graph)

One *graph* in FalkorDB terminology per book and per session (their model supports this — a FalkorDB instance hosts multiple named graphs).

Graph names: `book_<bookUUID>` and `chat_<sessionUUID>`.

### Book graph schema (Cypher DDL — FalkorDB syntax)

```cypher
// --- Node tables ---
// (FalkorDB uses property graphs without strict DDL like Kuzu; the schema is
//  implicit, but documenting it here as if explicit for clarity. Constraints
//  enforce essentials.)

CREATE CONSTRAINT ON (e:Entity) ASSERT e.id IS UNIQUE;
CREATE CONSTRAINT ON (c:Chunk) ASSERT c.id IS UNIQUE;
CREATE CONSTRAINT ON (t:Theme) ASSERT t.id IS UNIQUE;

CREATE INDEX FOR (e:Entity) ON (e.name);
CREATE INDEX FOR (e:Entity) ON (e.type);

CREATE VECTOR INDEX FOR (e:Entity) ON e.embedding
OPTIONS { dimension: 1024, similarityFunction: 'COSINE', M: 16, efConstruction: 200 };

CREATE VECTOR INDEX FOR (c:Chunk) ON c.embedding
OPTIONS { dimension: 1024, similarityFunction: 'COSINE' };

CREATE VECTOR INDEX FOR (t:Theme) ON t.embedding
OPTIONS { dimension: 1024, similarityFunction: 'COSINE' };
```

### Conceptual schema

```
(Entity)─[:MENTIONED_IN]─►(Chunk)
(Entity)─[:MEMBER_OF]─►(Theme)
(Entity)─[:INFLUENCES|CRITIQUES|EXTENDS|CONTRADICTS|IS_A|PART_OF|AUTHORED|MENTIONS|CAUSES|EXEMPLIFIES|DEFINES|PROVES]─►(Entity)
```

Properties:

```
Entity: { id, name, type, description, aliases[], embedding[], bookId, importanceScore }
Chunk:  { id, content, headings, orderIndex, embedding[], bookId, tokenCount }
Theme:  { id, title, summary, keyEntities[], embedding[], bookId }

(typed Entity↔Entity relationships): { description, evidence, confidence }
```

### Chat idea graph

```
(Idea)─[:supports|contradicts|refines|derived-from|answers]─►(Idea)
```

Properties:

```
Idea: { id, type (Claim|Question|Decision|Concept), title, content,
        miniRoundIndex, confidence, embedding[], createdAt, status }
```

Cross-graph references (Idea ↔ Entity across different FalkorDB graphs) live in Postgres `cross_graph_refs` and are resolved at visualization time.

## TypeScript domain types

```ts
// src/types/book.ts
export type EntityType =
  | "Person" | "Concept" | "Theory" | "Work"
  | "Place"  | "Event"   | "Organization";

export type RelationshipType =
  | "INFLUENCES" | "CRITIQUES" | "EXTENDS"   | "CONTRADICTS"
  | "IS_A"        | "PART_OF"  | "AUTHORED"   | "MENTIONS"
  | "CAUSES"      | "EXEMPLIFIES" | "DEFINES" | "PROVES";

export type Entity = {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  aliases: string[];
  bookId: string;
  importanceScore?: number;
};

export type Chunk = {
  id: string;
  content: string;
  headings: Heading[];
  orderIndex: number;
  bookId: string;
};

export type Heading = { level: 1 | 2 | 3; text: string };

export type Theme = {
  id: string;
  title: string;
  summary: string;
  keyEntityIds: string[];
  bookId: string;
};

export type Relationship = {
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  description: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
};
```

```ts
// src/types/memory.ts
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  miniRoundIndex: number;
  tokens: number;
  createdAt: Date;
};

export type SummaryChunk = {
  id: string;
  sessionId: string;
  ordinal: number;
  text: string;
  embedding: number[];
  topicTags: string[];
  coveredMiniRounds: [number, number];
  tokenCountOriginal: number;
  tokenCountSummary: number;
  createdAt: Date;
};

export type StructuredMemoryData = {
  topics: Topic[];
  decisions: Decision[];
  openQuestions: OpenQuestion[];
  userPreferences: Record<string, string>;
};

export type Topic = {
  id: string;
  name: string;
  status: "ongoing" | "resolved" | "tabled" | "contradicted";
  firstMentionedAt: number;
  lastMentionedAt: number;
  description: string;
  linkedBookEntityIds: string[];
};

export type Decision = {
  id: string;
  statement: string;
  reasoning: string;
  miniRoundIndex: number;
};

export type OpenQuestion = {
  id: string;
  question: string;
  raisedAt: number;
  context: string;
};
```

```ts
// src/types/idea.ts
export type IdeaNodeType = "Claim" | "Question" | "Decision" | "Concept";
export type IdeaEdgeType = "supports" | "contradicts" | "refines" | "derived-from" | "answers";

export type IdeaNode = {
  id: string;
  type: IdeaNodeType;
  title: string;
  content: string;
  miniRoundIndex: number;
  confidence: "high" | "medium" | "low";
  status: "active" | "resolved" | "superseded";
  createdAt: Date;
};

export type IdeaEdge = {
  sourceId: string;
  targetId: string;
  type: IdeaEdgeType;
  miniRoundIndex: number;
  createdAt: Date;
};

export type CrossGraphRef = {
  id: string;
  sessionId: string;
  chatNodeId: string;
  bookId: string;
  bookEntityId: string;
  edgeType: "derived-from";
};
```

## Why these particular boundaries

- **Why not put L1/L2 in FalkorDB too?** Because they're embeddings over text, not graph data. Postgres with pgvector is the right shape and we already need Postgres for app data.
- **Why not put book entities in Postgres too?** Because relationship queries dominate ingestion-time and retrieval-time, and Postgres recursive CTEs are not fun.
- **Why one FalkorDB graph per book/session?** Isolation. Faster queries (smaller scan space). Easier debug. Drop-a-book is just `GRAPH.DELETE`. The downside — true cross-book reasoning — is a feature we'd add later, not an MVP requirement.
- **Why store the embeddings in *both* the graph (for entities/themes) and Postgres (for summaries)?** Because the lookups are different shapes. FalkorDB's vector index is essential for the GraphRAG retrieval (you want to combine graph traversal and vector search in one query). Postgres pgvector handles plain text-similarity lookups for memory chunks.

## Migrations and seeds

```
drizzle/
  0000_initial.sql     # users, books, sessions, messages
  0001_memory.sql      # chat_summaries, structured_memory
  0002_xgraph.sql      # cross_graph_refs
  0003_usage.sql       # usage_log

scripts/
  seed-demo.ts         # Inserts a demo user + a pre-ingested book + a sample session
  reset-falkor.ts      # Drops and recreates indexes
```

The `seed-demo` script is your portfolio one-liner: `pnpm seed:demo && pnpm dev` and someone landing on your demo URL sees a populated, working app.
