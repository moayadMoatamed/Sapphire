<p align="center">
  <img src="Sapphire_imgs/mainBanner.png" alt="Sapphire — Read a book. Talk to it." width="600" />
</p>

<p align="center">
  <strong>Upload a PDF. Sapphire parses it, builds a knowledge graph, and lets you talk to it —<br/>while a live idea graph maps your thinking in real time.</strong>
</p>

---

## How memory works

Sapphire doesn't just answer questions. It remembers what you've discussed, tracks your evolving ideas, and builds a live map of your thinking across an entire conversation.

<p align="center">
  <img src="Sapphire_imgs/ChatMemoryDemo.jpg" alt="Chat Memory Demo" width="800" />
</p>

Every message flows through a **four-tier memory architecture** designed to keep the model aware of both the immediate thread and the deep past:

```
┌─────────────────────────────────────────────────────────┐
│ L0  ACTIVE CONTEXT     last N mini-rounds, verbatim      │
│     Compresses when: > 4000 tokens OR > 6 mini-rounds    │
├─────────────────────────────────────────────────────────┤
│ L1  RECENT SUMMARIES   rolling window of summary chunks  │
│     Last 5 summaries with topic tags and embeddings      │
├─────────────────────────────────────────────────────────┤
│ L2  LONG-TERM MEMORY   all old summaries, searchable     │
│     Retrieved by semantic similarity to the query        │
├─────────────────────────────────────────────────────────┤
│ L3  STRUCTURED MEMORY  topics, decisions, open questions │
│     Deduplicated, tracked across the full session        │
└─────────────────────────────────────────────────────────┘
```

- **L0** gives the LLM verbatim recall of what was just said — zero latency, zero degradation.
- **L1** keeps a rolling window of compact summaries so the model remembers the last 15–20 minutes of conversation.
- **L2** does semantic retrieval over *everything* you've ever discussed in the session, so circling back to an old topic works.
- **L3** tracks structured facts: active topics, decisions you've made, and questions still open. This is what the memory panel renders in the sidebar.

---

## The ingestion pipeline

This is the core engineering — how a raw PDF becomes a queryable knowledge graph:

```
PDF
 │
 ▼
[parse]            LlamaParse → structured Markdown
 │
 ▼
[chunk]            Recursive split, 1200-char blocks, 200-char overlap
 │
 ▼
[extract entities] DeepSeek extracts entities + claims per chunk (parallel, concurrency 8)
 │
 ▼
[resolve]          Name normalization + embedding similarity (cosine ≥ 0.92) deduplicates entities
 │
 ▼
[relationships]    LLM extracts typed triples between resolved entities (12 relationship types)
 │
 ▼
[build themes]     BFS connectivity clustering → LLM synthesizes theme title/summary per cluster
 │
 ▼
[embed]            Voyage AI (`voyage-3-large`) batches all chunks, entities, and themes
 │
 ▼
[write graph]      Idempotent upsert into PostgreSQL — clears old data, bulk-inserts new
 │
 ▼
[finalize]         Book marked ready with entity/relationship/theme counts
```

The pipeline is a **LangGraph state machine**. Each step updates the book's status in the database, and the UI streams progress in real time via Server-Sent Events — you watch each stage tick by as your book is ingested.

**Relationship types**: `INFLUENCES`, `CRITIQUES`, `EXTENDS`, `CONTRADICTS`, `IS_A`, `PART_OF`, `AUTHORED`, `MENTIONS`, `CAUSES`, `EXEMPLIFIES`, `DEFINES`, `PROVES` — each tagged with confidence (high/medium/low) and grounded in source evidence.

---

## The chat engine

When you send a message, a second LangGraph state machine fires:

```
recall → classify_intent → retrieve_low_level ─┬─→ fuse_context → generate → extract_ideas → update_memory → update_graph
                               retrieve_high_level ─┘
```

| Step | What happens |
|---|---|
| **recall** | Loads L0 active context, L1 summaries, and L3 structured memory for this session |
| **classify intent** | LLM classifies the query (factual / conceptual / comparative / thematic / clarification / meta) and sets retrieval weights |
| **retrieve (low)** | Embeds the query, does vector search over entity embeddings, fetches neighbors via relationship edges |
| **retrieve (high)** | Vector search over theme embeddings, loads key entities per theme |
| **fuse context** | Merges low + high results with weighted scoring, trims to a 3000-token budget |
| **generate** | DeepSeek streaming chat — user sees tokens in real time |
| **extract ideas** | LLM pulls 1–3 structured idea nodes from the response (Claims, Questions, Decisions, Concepts) |
| **update memory** | Persists messages to L0 in-memory store and PostgreSQL |
| **update graph** | Writes new idea nodes + edges to the chat idea graph, rendered live in the sidebar |

---

## The chat idea graph

As you discuss the book, a **live graph** grows in the sidebar — you watch your thinking become a map.

<p align="center">
  <img src="Sapphire/ChatTest.png" alt="Chat with live idea graph" width="800" />
</p>

**Node types:**

| Type | Meaning |
|---|---|
| **Claim** | An assertion you made or that emerged from the conversation |
| **Question** | An open question raised but not yet resolved |
| **Decision** | An interpretive choice you committed to |
| **Concept** | A synthesis, label, or heuristic — your idea, not the book's |

**Edge types:** `supports`, `contradicts`, `refines`, `derived-from` (links to book entities), `answers`

The graph is rendered on a Canvas element with a custom force-directed layout engine — pan, zoom, hover glow, and smooth interpolation.

---

## App screenshots

<p align="center">
  <img src="Sapphire/Screenshot 2026-05-24 215318.png" alt="Sapphire Library" width="800" />
</p>

<p align="center">
  <img src="Sapphire/Screenshot 2026-05-24 215410.png" alt="Sapphire Book View" width="800" />
</p>

---

## Tech stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, Radix UI primitives, Framer Motion |
| **LLM** | DeepSeek (`deepseek-chat`) — streaming chat + structured extraction |
| **Embeddings** | Voyage AI (`voyage-3-large`) — 1024-dimensional |
| **PDF parsing** | LlamaParse — PDF → structured Markdown |
| **Orchestration** | LangGraph.js — state machines for ingestion + chat |
| **Database** | PostgreSQL 16 (Drizzle ORM) — books, chunks, entities, relationships, themes, sessions, messages |
| **State** | TanStack Query, Zustand |
| **Visualization** | Custom Canvas force-directed layout (no library dependency) |
| **DevOps** | Docker Compose (Postgres + FalkorDB) |

---

## Getting started

### Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL)

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USER/sapphire.git
cd sapphire

# Install dependencies
npm install

# Start the database
docker compose up -d

# Set up environment
cp .env.example .env.local
# Edit .env.local — add your API keys:
#   DEEPSEEK_API_KEY=sk-...
#   VOYAGE_API_KEY=...
#   LLAMAPARSE_API_KEY=llx-...
#   DATABASE_URL=postgres://sapphire:sapphire@localhost:5432/sapphire

# Run migrations
npm run db:migrate

# Start the production server
npm run build && npm start
```

Open [http://localhost:3000](http://localhost:3000), upload a PDF, and start chatting.

### Development

```bash
npm run dev        # Next.js dev server (Turbopack)
npm run db:studio  # Drizzle Studio — inspect the database
```

---

## Project structure

```
src/
  app/                    # Next.js App Router
    (main)/               # Route group — shared layout with nav
      books/              # Library, book detail, upload
      chat/[sessionId]/   # Chat interface with side panel
      settings/           # Retrieval config + API key status
    api/                  # Route handlers (REST + SSE streaming)
  components/             # UI components (shadcn/ui pattern)
    books/                # Upload dropzone, ingestion progress
    chat/                 # Message bubbles, input, streaming
    graph/                # Canvas force-directed graph renderer
    memory/               # Structured memory panel
    ui/                   # Button, dialog, input, dropdown primitives
  hooks/                  # React hooks (useChatStream, useGraphView, useMemoryPanel)
  types/                  # Shared TypeScript types
  db/                     # Drizzle ORM schema + migrations
  services/
    chat/                 # Chat LangGraph state machine
      nodes/              # recall, classify-intent, retrieve, fuse, generate, extract-ideas, update-memory, update-graph
    ingestion/            # PDF ingestion LangGraph state machine
      nodes/              # parse, chunk, extract-entities, resolve-duplicates, extract-relationships, build-themes, embed, write-graph
    retrieval/            # Low-level (entity) + high-level (theme) retrieval + context fusion
    memory/               # Four-tier memory (L0–L3) + mini-round summarization
    graph/                # Book KG and chat idea graph data access
    llm/                  # DeepSeek + Voyage AI adapter
```
