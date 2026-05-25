# 02 — Tech Stack

Every choice below is paired with the alternatives that were considered and a one-line explanation of why this one won. When a recruiter asks "why not X?", the answer is here.

## Language and runtime

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Language             | **TypeScript 5.x, strict mode**    | The whole project is one stack, no Python sidecar required (LlamaParse is a hosted API; we never need to spawn Python).                                                                                                                        |
| Runtime              | **Node.js 22 LTS**                 | First-class fetch, native ESM, sufficient performance for the workload. Bun considered — too many edge cases with LangChain's native deps for a portfolio project.                                                                              |
| Package manager      | **pnpm**                           | Workspace support for monorepo layout, faster CI, deterministic installs.                                                                                                                                                                      |

## Application framework

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Web framework        | **Next.js 15 (App Router)**        | Server Actions for upload flows, streaming for chat, Route Handlers for everything else. One framework, no separate API server.                                                                                                                 |
| UI library           | **React 19**                       | Built into Next.js. `useOptimistic` is genuinely useful for the chat UI.                                                                                                                                                                       |
| Styling              | **TailwindCSS 4 + shadcn/ui**      | shadcn gives us the primitives (Dialog, Popover, Command palette) and we own the styling on top. Custom Sapphire design system layered on. Considered Mantine, Radix-direct — shadcn's "you own the code" model fits a portfolio project best. |
| Animation            | **Framer Motion 11**               | Used sparingly for the graph view, chat fade-ins, and the ingestion progress states. Not for everything — overuse is the #1 generic-AI-app tell.                                                                                                |
| Forms                | **React Hook Form + Zod**          | Standard. Zod schemas are reused for LangChain structured output.                                                                                                                                                                              |

## LLM orchestration

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Orchestration        | **LangChain.js 0.3 + LangGraph.js**  | Inspectable state machines for both ingestion and chat. The whole architecture leans on LangGraph's checkpoints — without it, persistent chats would mean a lot of custom plumbing.                                                          |
| State persistence    | **`@langchain/langgraph-checkpoint-postgres`** | Postgres is already in the stack for app data; reusing it for LangGraph checkpoints means one less moving piece. Memory checkpointer in tests, Postgres in dev/prod.                                                                |
| Observability        | **LangSmith** (or self-hosted **Langfuse**)  | Free tier is enough for a portfolio project. Wire it from day one — it's the single biggest reason recruiters can tell whether you've done this before.                                                                                |

## LLMs and embeddings

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Chat model           | **Anthropic Claude Sonnet 4.6** (or newest Sonnet) | Best for the long-context, reasoning-heavy chat path. Sonnet over Opus because cost matters for a project that has to be runnable on a portfolio budget.                                                                            |
| Extraction model     | **Anthropic Claude Haiku 4.5**     | 10–20× cheaper than Sonnet, plenty good enough for entity extraction, summarization, and intent classification.                                                                                                                              |
| Fallback / swap path | **OpenAI** behind an LLMAdapter    | The LLM Adapter (see [`01-architecture.md`](01-architecture.md)) keeps provider details out of the flows.                                                                                                                                  |
| Embeddings           | **Voyage AI `voyage-3-large`**     | Top of MTEB at time of design, has a TypeScript SDK, fast. OpenAI `text-embedding-3-large` is a fine drop-in if Voyage credit is unavailable.                                                                                              |

## PDF parsing

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Primary parser       | **LlamaParse**                     | Best-in-class output quality for book-style documents (preserved headings, table structure, image captions), TS SDK, generous free tier. Cloud call, but no GPU required and parsing happens once per book.                                  |
| Fallback             | **Unstructured.io** (TS SDK)       | Used when LlamaParse fails or for users who insist on self-hosted. Quality is lower but acceptable for text-heavy books.                                                                                                                     |
| Why not `pdf-parse`  | Doesn't preserve structure        | Produces a wall of text. KG extraction quality drops hard — there's no way to know what's a heading and what's body text.                                                                                                                    |
| Why not Docling      | Python only                       | Excellent quality but would force a Python sidecar. Not worth the operational complexity for the portfolio MVP. (Documented as a future option.)                                                                                            |

## Graph database

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Graph DB             | **FalkorDB**                       | Three reasons: (1) a first-class Node.js/TypeScript client with a LangChain.js integration (`@falkordb/langchain-ts`), (2) built-in vector index (HNSW) so we don't need a separate vector store, (3) explicitly built for GraphRAG workloads. |
| Dev mode             | **`falkordblite-ts`**              | Embedded mode — zero config for local dev. Single `await FalkorDB.open()` and you have a graph DB running on a Unix socket. No Docker required for development.                                                                              |
| Prod mode            | **FalkorDB in Docker**             | The same FalkorDB image (`falkordb/falkordb:latest`), with a browser UI at port 3000 for visual debugging.                                                                                                                                  |
| Query language       | **OpenCypher**                     | Industry standard. Knowledge transfers to/from Neo4j.                                                                                                                                                                                       |
| Why not Neo4j        | Heavier ops, slower for analytics | Neo4j is the safer recruiter-recognizable name, but FalkorDB-the-decision tells a more interesting story (sparse matrices, GraphBLAS) and is operationally simpler. If you're worried about recognizability, namedrop both in the README.   |
| Why not KuzuDB       | Archived October 2025             | Apple acquired the team, repo archived. Community forks exist (LadybugDB, Vela-Engineering/kuzu) but carry abandonment risk — not a story you want to tell a recruiter.                                                                     |

See [`docs/04-graphrag-design.md`](04-graphrag-design.md) for how FalkorDB's combined graph + vector store is exploited.

## App data

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Relational DB        | **PostgreSQL 16**                  | Stores: user accounts, books metadata, sessions, messages, LangGraph checkpoints, memory summaries (L1/L2). Postgres' `pgvector` extension is NOT used — embeddings live in FalkorDB. Postgres just stores text + structured rows.            |
| ORM                  | **Drizzle ORM**                    | TypeScript-first, no codegen step, SQL-shaped. Prisma was considered — the runtime overhead and generator dance is not worth it here.                                                                                                          |
| Migrations           | **drizzle-kit**                    | Built-in.                                                                                                                                                                                                                                    |
| Queue (optional)     | **BullMQ on Redis**                | Used for ingestion jobs only. Not required for MVP — `setImmediate` + a status table works fine until you have multiple users.                                                                                                              |
| Object storage       | **S3-compatible (R2 / MinIO)**     | Stores the original PDFs. Local filesystem for dev.                                                                                                                                                                                          |

## Graph visualization

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Graph rendering      | **Sigma.js + graphology**          | WebGL renderer, scales to ~10k+ nodes smoothly, force-atlas2 layout, event-driven reactivity that plays well with React. The data model (graphology) is a clean separate library — easy to dispatch updates from server-side events.        |
| Alternative          | `react-force-graph-2d`            | Good but locks you into a `Canvas` renderer that struggles past ~3k nodes. Acceptable for the chat-idea graph (which stays small), considered for that view.                                                                                |
| Why not Cytoscape.js | DOM-based, doesn't scale          | Beautiful API, but DOM-based architecture means each node is a real element. Bookssized KGs (1k+ entities) will choke it.                                                                                                                  |
| Why not React Flow   | Built for diagrams, not networks   | Excellent for the LangGraph state-machine visualization (debugging UI), wrong tool for a force-directed concept map.                                                                                                                          |

Practical layout: Sigma.js for both graph views (book KG and chat ideas) with different stylings; React Flow for the internal "show me the LangGraph trace of this turn" debug panel.

## Client state

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Server state         | **TanStack Query 5**               | Caching, refetch-on-focus, optimistic updates.                                                                                                                                                                                              |
| Client state         | **Zustand 5**                      | Minimal. Only used for UI state (panel widths, theme, current selection in graph).                                                                                                                                                          |
| Streaming            | **Vercel AI SDK** (UI hooks only) or hand-rolled SSE | The `useChat` hook is convenient but not required. If you want full control over the streaming protocol (custom event types for graph updates), roll it by hand with SSE.                                                                |

## Auth (lightweight)

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Auth library         | **Auth.js** (formerly NextAuth)    | Magic links or GitHub OAuth. Single-user mode also supported via a `?dev=true` bypass for local development.                                                                                                                                |
| Sessions             | Database sessions in Postgres     | Drizzle adapter exists.                                                                                                                                                                                                                     |

For a portfolio project, single-user mode with no auth is *fine*. Add Auth.js if/when you want to share a hosted demo without it becoming everyone's private chat.

## DevX and testing

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Test runner          | **Vitest 2**                       | Fast, TypeScript-native, drop-in for Jest API.                                                                                                                                                                                              |
| E2E                  | **Playwright**                     | One end-to-end happy-path test (upload PDF → chat → see graph) is *plenty* for a portfolio. Don't go test-crazy.                                                                                                                          |
| Linter / formatter   | **Biome**                          | One tool instead of ESLint + Prettier. Way faster, well-supported, simpler config.                                                                                                                                                          |
| Git hooks            | **Lefthook**                       | Lighter than Husky.                                                                                                                                                                                                                          |

## Deployment (optional but recommended for the demo)

| Concern              | Pick                              | Why                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| App hosting          | **Vercel**                         | Next.js native. Free hobby tier is sufficient.                                                                                                                                                                                              |
| Postgres             | **Neon** or **Supabase**           | Both have generous free tiers.                                                                                                                                                                                                              |
| FalkorDB             | **FalkorDB Cloud** or self-hosted **Fly.io** | FalkorDB Cloud has a free instance. Fly.io for cheap self-host.                                                                                                                                                                       |
| File storage         | **Cloudflare R2**                  | S3-compatible, no egress fees.                                                                                                                                                                                                              |

## A note on "but recruiters know X"

Recruiters in the LLM/agents space in 2026 know LangChain, LangGraph, and the major embeddings/vector providers. They will recognize FalkorDB if they're current; if not, the README's first paragraph names "knowledge graph + GraphRAG" and they'll fill in the rest. Don't pick Neo4j just for name recognition — the *story* about why FalkorDB (combined graph + vectors, built for GraphRAG, embedded dev mode) is *itself* a recruiter signal that you make decisions on merit, not vibes.
