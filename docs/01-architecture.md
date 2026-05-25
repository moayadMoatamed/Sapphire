# 01 — Architecture

## The system at one glance

```
                          ┌──────────────────────────────┐
                          │        Sapphire UI           │
                          │  (Next.js 15 + React 19)     │
                          └──────────────┬───────────────┘
                                         │ Server Actions / Streaming
                                         ▼
                          ┌──────────────────────────────┐
                          │        API Layer             │
                          │   (Next.js Route Handlers)   │
                          └──────────────┬───────────────┘
                                         │
                ┌────────────────────────┼────────────────────────┐
                ▼                        ▼                        ▼
        ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
        │  Ingestion    │        │   Chat        │        │   Graph       │
        │  Pipeline     │        │   Engine      │        │   Service     │
        │  (LangGraph)  │        │  (LangGraph)  │        │               │
        └───────┬───────┘        └───────┬───────┘        └───────┬───────┘
                │                        │                        │
                └────────────────────────┼────────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
       ┌────────────┐            ┌────────────┐            ┌────────────┐
       │ FalkorDB   │            │ Postgres   │            │  Object    │
       │ (graph +   │            │ (app data, │            │  Storage   │
       │  vectors)  │            │ checkpoints)│           │  (PDFs)    │
       └────────────┘            └────────────┘            └────────────┘
```

## Modules

There are exactly five backend modules. Each has a clear contract; they don't reach into each other's internals.

### 1. Ingestion Pipeline (`/services/ingestion`)

A LangGraph state machine that takes a PDF and produces a populated subgraph in FalkorDB + embeddings.

States: `parse → chunk → extract_entities → resolve_duplicates → build_relationships → embed → write_to_graph → finalize`

Each state is idempotent and resumable from a checkpoint. If extraction fails on chunk 47 of 200, you resume from chunk 47, not from the start. This matters — book ingestion is the most expensive operation in the system and a recruiter will absolutely ask you about failure modes.

See [`03-pdf-ingestion-pipeline.md`](03-pdf-ingestion-pipeline.md) for the full design.

### 2. Chat Engine (`/services/chat`)

A LangGraph state machine that takes a user message + a session ID and produces a streamed assistant response, side-effecting the memory and chat-idea-graph stores.

States: `recall → classify_intent → retrieve_low_level → retrieve_high_level → fuse_context → generate → extract_ideas → update_memory → update_graph`

This is the hot path. Most engineering effort goes here. See [`06-langgraph-flows.md`](06-langgraph-flows.md).

### 3. Memory Service (`/services/memory`)

Owns the tiered memory (L0–L3) for each session. Exposes:

- `getActiveContext(sessionId): Message[]` — verbatim L0
- `getRecentSummaries(sessionId): Summary[]` — L1 rolling summaries
- `recallSemantic(sessionId, query, k): Summary[]` — L2 embedding search over old summaries
- `getStructuredMemory(sessionId): StructuredMemory` — L3 entities, topics, decisions, open questions
- `summarizeIfNeeded(sessionId): Promise<void>` — invoked after each turn; rolls L0 → L1 → L2 when thresholds hit

See [`05-context-management.md`](05-context-management.md).

### 4. Graph Service (`/services/graph`)

The only module that talks to FalkorDB directly. Two responsibilities:

- **Book graph operations** — write entities/relationships during ingestion, query during retrieval
- **Chat idea graph operations** — add chat nodes, link to book entities, fetch for visualization

Exposes typed methods, not raw Cypher. (Cypher is generated inside this module from typed query builders; consumers don't touch query strings.) See [`08-data-models.md`](08-data-models.md) for the schema.

### 5. LLM Adapter (`/services/llm`)

A thin abstraction over Anthropic SDK + LangChain. Two models in active use:

- **Claude Sonnet** — chat generation, complex extraction (relationships, idea nodes)
- **Claude Haiku** — cheap entity extraction during ingestion, intent classification, summarization

Provides:
- `generate(messages, opts): AsyncIterable<StreamEvent>` — streaming chat
- `extract<T>(input, schema): Promise<T>` — structured output via tool use, zod-validated
- `embed(texts): Promise<number[][]>` — embeddings (Voyage AI default; OpenAI swappable)

Keeping LLM details behind this seam means you can swap providers or local models later without touching the LangGraph flows.

## Data flow: ingesting a book

1. User uploads PDF via `<UploadDropzone />`. POST to `/api/books/upload` — returns a `bookId` immediately, kicks off ingestion as a background job (BullMQ on Redis, or just an async function for the MVP).
2. Ingestion worker dequeues, runs the LangGraph ingestion machine with `bookId` and the file path.
3. LlamaParse parses the PDF (cloud call). Result: structured Markdown with preserved headings.
4. Splitter chunks the Markdown semantically (respecting headings; targets ~800 tokens with overlap). Chunks get IDs like `book_<bookId>_chunk_0042`.
5. For each chunk in parallel batches (Haiku): extract entities + claims as JSON via tool use.
6. Entity resolver deduplicates: name normalization → embedding similarity (>0.92) → merge.
7. Second pass (Sonnet) extracts relationships between entities within and across nearby chunks.
8. Embedding service embeds (a) chunks, (b) entity descriptions, (c) high-level theme summaries from chunk clusters.
9. Graph writer writes everything to FalkorDB inside a single graph named `book_<bookId>`.
10. Status broadcast to the UI via Server-Sent Events.

A 300-page textbook takes ~6–12 minutes and ~$0.50–$2.00 in LLM costs depending on density. Both numbers should be surfaced in the UI.

## Data flow: answering a message

1. User sends message via the chat UI. POST to `/api/chat/send` with `sessionId` and `content`.
2. Server resolves which book this session is bound to (a session = one book + one user).
3. LangGraph chat machine starts streaming:
   - **recall**: pull L0 (active), L1 (recent summaries), L3 (structured memory). Run L2 semantic recall against the user message.
   - **classify_intent**: Haiku classifies: factual, conceptual, comparative, clarification, meta. Affects retrieval strategy.
   - **retrieve_low_level**: vector search over entity embeddings → top-k entities → fetch 1-hop subgraph
   - **retrieve_high_level**: vector search over theme summaries → top-k themes → fetch member entities
   - **fuse_context**: deduplicate, prioritize, build the actual prompt context block
   - **generate**: Sonnet streams the response with the assembled context + tier 0/1/3 memory
   - (post-stream) **extract_ideas**: Haiku reads the assistant message and extracts new idea-graph nodes
   - **update_memory**: append to L0, possibly trigger L0 → L1 → L2 cascade
   - **update_graph**: write new idea nodes, link to book entities mentioned
4. Client receives stream, renders incrementally, then the graph panel does a soft re-fetch of the idea graph.

## Why two graphs, not one

You could put chat-idea nodes in the same FalkorDB graph as book entities. Don't. Two reasons:

- **Lifecycle.** A book graph is built once and rarely changes. The chat graph mutates on every turn. Mixing them complicates indexing and makes debugging harder.
- **Multitenancy.** Many users can chat with the same book. Their idea graphs are personal. Same-graph mixing leaks personal nodes into shared queries.

Implement as: one FalkorDB *graph* (in FalkorDB terminology) per book, one per chat-idea collection per user-session. Edges between book and chat exist as `Book_Entity_Reference` references — just an entity ID + book ID stored on the chat-graph node, resolved at visualization time by querying both graphs.

## Non-goals (for the portfolio MVP)

- Multi-user collaboration on the same chat
- Sharing books between accounts
- Editing the extracted KG by hand from the UI (read-only graph is fine; manual editing is a rabbit hole)
- Mobile app (responsive web is enough)
- Self-hosted Ollama path (cool stretch goal, not blocking)

## Operational concerns worth showing recruiters

- **Resumable ingestion.** LangGraph checkpoints into Postgres. Kill the worker mid-ingestion, restart, it resumes.
- **Cost telemetry.** Every LLM call logs tokens-in/tokens-out + model + cost. Visible per book and per chat session in a Settings → Usage screen.
- **Tracing.** Wire LangSmith (or local Langfuse if self-hosted) from day one. Recruiters want to see you can debug LLM apps.
- **Error budgets per node.** If `extract_ideas` fails, the chat still ships — graph just doesn't grow that turn. Don't let secondary features take down the primary one.
