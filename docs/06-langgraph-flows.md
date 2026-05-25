# 06 — LangGraph Flows

This doc shows the actual state machines you build in LangGraph.js. Sapphire has two: the ingestion graph and the chat graph.

## Why LangGraph specifically

You could write all of this as plain async functions. LangGraph buys you four things that matter:

1. **Checkpointing.** Ingestion can fail at chunk 200 of 600; LangGraph resumes from a saved state. Chat threads can resume across server restarts.
2. **Observability.** Each node call is traced (LangSmith), so when a recruiter asks "show me what happens on a turn", you literally show them.
3. **Conditional edges.** "Run X then Y, but if intent is `meta`, skip the book retrieval" is one declarative edge, not a tangle of `if/else`.
4. **Streaming.** Token-level streaming from the generation node, plus event-level streaming as nodes complete (lets us update progress UIs cheaply).

## The Ingestion graph

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   parse     │  (LlamaParse)
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   chunk     │  (heading-aware + semantic)
                    └──────┬──────┘
                           ▼
                    ┌─────────────────────┐
                    │ extract_entities    │  (Haiku, parallel batches)
                    │ (fanout: chunks)    │
                    └──────┬──────────────┘
                           ▼
                    ┌─────────────┐
                    │ resolve_dup │  (name + embedding similarity)
                    └──────┬──────┘
                           ▼
                    ┌──────────────────────┐
                    │ extract_relationships│  (Sonnet, parallel over pairs)
                    └──────┬───────────────┘
                           ▼
                    ┌─────────────┐
                    │ build_themes│  (Louvain community detection + summaries)
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   embed     │  (Voyage AI)
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │write_graph  │  (FalkorDB transactional write)
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  finalize   │  (mark ready, emit event)
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │    END      │
                    └─────────────┘
```

### State shape

```ts
import { Annotation } from "@langchain/langgraph";

export const IngestionState = Annotation.Root({
  bookId:        Annotation<string>(),
  filePath:      Annotation<string>(),
  markdown:      Annotation<string>(),
  chunks:        Annotation<Chunk[]>(),
  rawEntities:   Annotation<RawEntity[]>(),
  entities:      Annotation<ResolvedEntity[]>(),
  relationships: Annotation<Relationship[]>(),
  themes:        Annotation<Theme[]>(),
  embeddings:    Annotation<EmbeddingMap>(),
  progress:      Annotation<Progress>(),
  errors:        Annotation<ErrorRecord[]>({ reducer: (curr, next) => [...curr, ...next], default: () => [] }),
});
```

### Building the graph

```ts
import { StateGraph } from "@langchain/langgraph";

export function buildIngestionGraph() {
  const g = new StateGraph(IngestionState)
    .addNode("parse",                 parseNode)
    .addNode("chunk",                 chunkNode)
    .addNode("extract_entities",      extractEntitiesNode)
    .addNode("resolve_duplicates",    resolveDuplicatesNode)
    .addNode("extract_relationships", extractRelationshipsNode)
    .addNode("build_themes",          buildThemesNode)
    .addNode("embed",                 embedNode)
    .addNode("write_graph",           writeGraphNode)
    .addNode("finalize",              finalizeNode);

  g.addEdge("__start__", "parse");
  g.addEdge("parse",                 "chunk");
  g.addEdge("chunk",                 "extract_entities");
  g.addEdge("extract_entities",      "resolve_duplicates");
  g.addEdge("resolve_duplicates",    "extract_relationships");
  g.addEdge("extract_relationships", "build_themes");
  g.addEdge("build_themes",          "embed");
  g.addEdge("embed",                 "write_graph");
  g.addEdge("write_graph",           "finalize");
  g.addEdge("finalize",              "__end__");

  return g;
}

export const ingestionGraph = buildIngestionGraph().compile({
  checkpointer: new PostgresSaver(/* config */),
});
```

### Streaming progress to the UI

```ts
const events = await ingestionGraph.stream(
  { bookId, filePath },
  { configurable: { thread_id: `ingest_${bookId}` }, streamMode: "updates" }
);

for await (const event of events) {
  // event is { [nodeName]: stateUpdate }, broadcast it via SSE
  await sse.send({ event: "ingestion.progress", data: event });
}
```

The UI just listens and updates its progress component.

### Resume on failure

If the worker dies, the next time `ingestionGraph.invoke` is called with the same `thread_id`, LangGraph reads the last checkpoint and resumes from the next node. Tested before you ship it; do a forced-kill mid-extraction during dev.

---

## The Chat graph

```
                  ┌─────────────┐
                  │   START     │
                  └──────┬──────┘
                         ▼
                  ┌─────────────┐
                  │   recall    │  (L0 + L1 + L3 always; L2 by similarity)
                  └──────┬──────┘
                         ▼
                  ┌─────────────────┐
                  │ classify_intent │  (Haiku, structured output)
                  └──────┬──────────┘
                         ▼
                ┌────────┴────────┐
                ▼                 ▼
       ┌──────────────┐   ┌──────────────────┐
       │ retrieve_    │   │ retrieve_         │
       │  low_level   │   │  high_level       │
       └──────┬───────┘   └──────┬────────────┘
              └────────┬─────────┘
                       ▼
              ┌────────────────┐
              │  fuse_context  │
              └────────┬───────┘
                       ▼
              ┌────────────────┐
              │   generate     │  (Sonnet, STREAMING)
              └────────┬───────┘
                       ▼ (parallel)
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
  ┌──────────┐  ┌─────────────┐  ┌──────────────┐
  │ extract_ │  │  update_    │  │  update_     │
  │  ideas   │  │  memory     │  │  graph       │
  └────┬─────┘  └─────┬───────┘  └──────┬───────┘
       └──────────────┼─────────────────┘
                      ▼
              ┌──────────────┐
              │     END      │
              └──────────────┘
```

### State shape

```ts
export const ChatState = Annotation.Root({
  sessionId:        Annotation<string>(),
  bookId:           Annotation<string>(),
  userMessage:      Annotation<string>(),

  // Memory tiers (populated by recall node)
  activeContext:    Annotation<Message[]>(),
  recentSummaries:  Annotation<SummaryChunk[]>(),
  recalled:         Annotation<SummaryChunk[]>(),
  structuredMemory: Annotation<StructuredMemory>(),

  // Intent (populated by classify_intent)
  intent:           Annotation<Intent>(),

  // Retrieval (populated by retrieve_low_level / retrieve_high_level)
  lowLevelResults:  Annotation<LowLevelResult[]>(),
  highLevelResults: Annotation<HighLevelResult[]>(),
  fusedContext:     Annotation<string>(),

  // Output
  assistantMessage: Annotation<string>(),

  // Side-effects from post-stream nodes
  newIdeaNodes:     Annotation<IdeaNode[]>({ reducer: (c, n) => [...c, ...n], default: () => [] }),
});
```

### Conditional routing on intent

```ts
function routeByIntent(state: typeof ChatState.State) {
  if (state.intent.intent === "meta") {
    // Skip book retrieval — meta questions are about the conversation, not the book
    return "fuse_context";
  }
  return ["retrieve_low_level", "retrieve_high_level"];  // parallel
}

g.addConditionalEdges("classify_intent", routeByIntent);
```

### Streaming the generation node

The generate node is the one that token-streams to the user. LangGraph supports streaming individual node tokens via `streamMode: "messages"`:

```ts
const stream = await chatGraph.stream(
  { sessionId, bookId, userMessage },
  {
    configurable: { thread_id: sessionId },
    streamMode: ["updates", "messages"],
  }
);

for await (const [mode, chunk] of stream) {
  if (mode === "messages") {
    // chunk is { content, role, meta } — push to client as a token event
    await sse.sendToken(chunk.content);
  } else if (mode === "updates") {
    // chunk is { nodeName: stateDelta } — push as a status event (handy for "Retrieving..." indicators)
    await sse.sendStatus(chunk);
  }
}
```

This gives you both the token stream (for the chat bubble to type out word by word) and node-completion events (for the "Searching graph...", "Extracting ideas..." status under the input).

### The generation prompt template

```ts
const GENERATION_PROMPT = `You are Sapphire, a focused thinking partner discussing the book "{bookTitle}" with the user.

You have grounded knowledge of the book through the structured context below. You also have memory of this ongoing conversation across multiple tiers. Use it.

<book_context>
{fusedContext}
</book_context>

<active_conversation>
{activeContextRendered}
</active_conversation>

<recent_summary>
{recentSummariesRendered}
</recent_summary>

<earlier_relevant>
{recalledRendered}
</earlier_relevant>

<known_state>
Active topics:
{activeTopics}

Decisions reached:
{decisions}

Open questions:
{openQuestions}
</known_state>

Rules:
- Ground every factual claim about the book in the <book_context>.
- When you reference earlier conversation, refer to it naturally — don't say "as we discussed in mini-round 4", say "earlier when you mentioned X".
- If the user asks something you don't have grounded context for, say so plainly — don't bluff.
- Aim for depth over breadth. The user is reading a serious book; they want a thinking partner, not a tour guide.
- Use Markdown for emphasis where it helps. Quote the book inline when directly relevant, with a citation like [ch. 3 §2].

User: {userMessage}
`;
```

### The post-stream nodes

After `generate` completes, three nodes run **in parallel** (not blocking the stream the user is reading):

**`extract_ideas`** — Haiku call that reads the assistant message + the user message and emits new idea-graph nodes:

```ts
const IdeaExtractionSchema = z.object({
  newNodes: z.array(z.object({
    type: z.enum(["Claim", "Question", "Decision", "Concept"]),
    title: z.string(),
    content: z.string(),
    linkedBookEntityNames: z.array(z.string()),
  })),
  newEdges: z.array(z.object({
    sourceTitle: z.string(),
    targetTitle: z.string(),
    type: z.enum(["supports", "contradicts", "refines", "derived-from"]),
  })),
});
```

**`update_memory`** — kicks off the L0/L1/L2 cascade and updates L3 (topics, decisions, open questions). This is mostly Postgres writes + one Haiku call to update the structured memory.

**`update_graph`** — writes the new idea nodes/edges into FalkorDB; resolves linked book-entity names to IDs.

These three are fire-and-forget *from the user's perspective* but they're proper LangGraph nodes so they're traced and resumable.

---

## Error handling pattern

Each node wraps its body in a try/catch and either:
- **Hard-fails the graph** for critical nodes (parse, write_graph) — propagate to the user
- **Logs and skips** for non-critical nodes (extract_ideas, update_graph) — chat still works, just no idea-graph growth this turn

Generic helper:

```ts
function nodeWithFallback<S extends Record<string, unknown>>(
  name: string,
  fn: (s: S) => Promise<Partial<S>>,
  critical: boolean,
) {
  return async (state: S): Promise<Partial<S>> => {
    try {
      return await fn(state);
    } catch (err) {
      const record = { node: name, error: serializeError(err), at: new Date() };
      logger.error(record);
      if (critical) throw err;
      return { errors: [record] } as Partial<S>;
    }
  };
}
```

---

## Debug surface

Build a debug view in the app at `/admin/traces/:threadId`:

- React Flow rendering of the graph (one node per LangGraph node)
- Nodes colored by status (success/in-progress/error/skipped)
- Click a node → see the prompt sent, response received, tokens, latency
- Replay a single node with edited input — using LangGraph's `update_state` API

This is overkill for an MVP, but it's *exactly* the kind of thing that wins recruiter conversations. Save it as a stretch goal.
