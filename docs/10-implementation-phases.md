# 10 — Implementation Phases

A realistic build plan. Six phases, each one ends with a demoable artifact. You can stop after any phase and still have something worth showing.

## Phase 0 — Scaffold (1–2 evenings)

Just plumbing. Boring. Necessary.

- [ ] `pnpm create next-app sapphire` (TS, App Router, Tailwind, Biome)
- [ ] Init the monorepo: keep it single-package for now; only split if it becomes unwieldy
- [ ] Add Biome config, format-on-save in editor
- [ ] Postgres + pgvector running locally (Docker compose)
- [ ] FalkorDB running locally via `falkordblite` for dev
- [ ] Drizzle setup; first migration with `users` and `books` tables
- [ ] Auth.js with magic-link email or GitHub
- [ ] Env vars set: `ANTHROPIC_API_KEY`, `LLAMA_CLOUD_API_KEY`, `VOYAGE_API_KEY`, `DATABASE_URL`
- [ ] Health check endpoint
- [ ] Tailwind + shadcn/ui set up; install `Button`, `Dialog`, `Input`, `Sonner` (toasts)
- [ ] LangSmith env vars set (or skip if you'll use Langfuse later)
- [ ] Build the home page (signed-out → marketing hero, signed-in → empty book list)

**Done when:** You can sign in, see your empty book list, and the home page looks like the design brief's mockup.

## Phase 1 — Ingestion (1–2 weeks)

The whole PDF → KG pipeline. This is the biggest engineering chunk.

- [ ] Upload route: multipart, store PDF in S3/local, create book row, return ID
- [ ] LlamaParse integration: parse and store the resulting Markdown
- [ ] Chunker (heading-aware + recursive split)
- [ ] Haiku entity extractor with zod schema
- [ ] Entity resolver (name normalize → embedding similarity → merge)
- [ ] Sonnet relationship extractor
- [ ] Theme builder (Louvain community detection via `graphology-communities-louvain` + Haiku summaries)
- [ ] Voyage AI embeddings for chunks, entities, themes
- [ ] FalkorDB writer with idempotent upserts
- [ ] LangGraph state machine wiring all of the above
- [ ] Postgres checkpointer
- [ ] SSE status endpoint
- [ ] Upload UI with progress component
- [ ] Cost tracker (insert into `usage_log` table on every LLM call)
- [ ] Drop-book / re-ingest flow

**Done when:** You upload a 200-page PDF, wait ~8 minutes, and see "ready" with stats (entities, relationships, themes, cost). FalkorDB browser at `:3000` shows the graph populated.

This phase alone is a strong portfolio piece. If you stop here, you have "a system that turns PDFs into knowledge graphs with real-time progress".

## Phase 2 — Basic chat (1 week)

End-to-end chat with retrieval, but no memory tiers yet.

- [ ] Session creation
- [ ] Chat UI: messages list, input, streaming bubbles, typing indicator
- [ ] LangGraph chat machine with: `recall (stub)`, `classify_intent`, `retrieve_low_level`, `retrieve_high_level`, `fuse_context`, `generate`
- [ ] Intent classifier (Haiku, zod-typed output)
- [ ] Low-level retrieval (FalkorDB vector index + 1-hop expand)
- [ ] High-level retrieval (theme vector search + drilldown)
- [ ] Context fusion with token budget
- [ ] Generation node streaming Sonnet
- [ ] Send route as SSE
- [ ] Client SSE hook
- [ ] Citations rendering (`[ch. 3 §2]` → link to chunk in side panel)

**Done when:** You can have a 20-message conversation with the book and the answers feel grounded. Citations open the source chunk.

## Phase 3 — Memory tiers (~1 week)

Adds the L0/L1/L2/L3 system.

- [ ] L0: active context array on the LangGraph state
- [ ] L1: summary chunk generation node (Haiku summarizes the oldest mini-round when threshold hit)
- [ ] L1 table in Postgres; embedding column
- [ ] L2: semantic recall query against the embedding index
- [ ] L3: structured memory schema + extraction node (Haiku updates topics/decisions/open-questions)
- [ ] Memory tab in the UI showing L3 live
- [ ] Recall chip on assistant messages ("Recalled: discussion of X from message 23")
- [ ] Tests: the "100-turn synthetic conversation" benchmark (see `11-evaluation.md`)

**Done when:** A long conversation stays coherent. The Memory tab populates as you talk. The 100-turn test passes.

## Phase 4 — Chat idea graph (1 week)

The Obsidian-like graph view.

- [ ] `extract_ideas` LangGraph node (Haiku, structured output)
- [ ] FalkorDB chat-graph per session
- [ ] Cross-graph reference table in Postgres
- [ ] Idea-graph fetch endpoint
- [ ] Sigma.js + graphology integration on the client
- [ ] ForceAtlas2 layout in a Web Worker
- [ ] Node styling by type, edge styling by type
- [ ] Click-node detail panel
- [ ] Time-slider rewind (this is the wow feature; budget time for it)
- [ ] Soft re-fetch of graph on new `graph` SSE events (don't full-replace; merge deltas)

**Done when:** As you chat, nodes pulse into the graph. The graph view scales to 200+ nodes without lag. You can rewind it.

## Phase 5 — Book graph view + cross-graph (~half a week)

- [ ] Book graph fetch endpoint with pagination
- [ ] Second Sigma.js view for the book KG
- [ ] Visual style differentiation between the two graphs
- [ ] Unified view: cross-graph edges visible
- [ ] "Find this in the book" — click a chat node referencing an entity, jump to the entity in the book graph

**Done when:** You can flip between three views: chat-only graph, book-only graph, unified.

## Phase 6 — Polish + evaluation (~1 week)

The "looks pro" pass. Don't skip this — the difference between Phase 5 done and Phase 6 done is the difference between "cool project" and "I'd hire this person".

- [ ] Design pass on every screen (apply the design brief)
- [ ] Empty states everywhere
- [ ] Loading skeletons (not spinners)
- [ ] Error states that are actually helpful, not technical
- [ ] Mobile responsive (chat works on phone; graph view is desktop-only with a friendly notice)
- [ ] Onboarding flow: first-time user gets a sample book preloaded
- [ ] Settings page: retrieval knobs (top-k, weights), model selection, cost limits
- [ ] Usage / cost dashboard
- [ ] Eval suite running against the demo book; results page in `/admin/evals`
- [ ] README screenshots and a 60-second demo video
- [ ] Vercel deploy + Postgres on Neon + FalkorDB on Fly.io (or FalkorDB Cloud)

**Done when:** A stranger lands on your URL, signs in with GitHub, can upload a book, chat with it, and see the graph populate. And it doesn't look like an MVP — it looks like a small, polished product.

## What to actively *not* build

These will eat weeks and add ~no portfolio value:

- **Multi-user collaboration on the same chat.** Nice idea, huge complexity.
- **An OAuth marketplace of LLM providers.** One provider with one fallback is plenty.
- **A plugin system.** You're not building Obsidian.
- **Mobile-native app.** The web app is your demo.
- **Granular cost controls / spending alerts.** A simple total-spent counter is enough.
- **Multi-language support.** English-only for the demo.
- **Real-time collaboration on the graph.** Single-user is fine.

## Sequencing tips

- **Build the eval suite (Phase 6's evals) as soon as Phase 3 is done.** It saves you from regressions and gives you numbers to put in the README.
- **Show the design brief to "Claude design" at the START of Phase 0**, not Phase 6. You want consistent design from the first commit. (But the deep polish pass still happens in Phase 6.)
- **Set up LangSmith on day one.** Debugging LLM apps without traces is a nightmare.
- **Use seed scripts liberally.** A `seed-demo` that drops in a pre-ingested book + a session with a sample conversation saves you hours of "let me re-ingest the book to debug this".
- **Don't optimize prematurely.** The ingestion pipeline is slow. So what — make it observable, not fast.

## Total budget

Solo, focused, 8–10 hours a week: **8–10 weeks** to a polished Phase 6.

Solo, full-time: **3–4 weeks** to Phase 6.

If you're building this *while interviewing* (the realistic case), aim for Phase 4 done in 4 weeks, then put it in front of recruiters with what you have. Phase 5 and 6 happen on the side while you're already getting calls.
