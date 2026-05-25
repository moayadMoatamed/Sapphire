# 04 — GraphRAG Design

The retrieval design is the heart of the system. Get this right and answers feel grounded; get it wrong and Sapphire is a slightly fancier RAG demo.

## The principle: dual-level retrieval

Sapphire uses a LightRAG-inspired dual-level retrieval pattern:

- **Low-level retrieval** answers "what does the book say about *X specifically*?" → search at entity granularity, expand by 1 graph hop.
- **High-level retrieval** answers "what are the book's main ideas about *Y*?" → search at theme granularity, then drill down to constituent entities.

For most user questions, *both* run, and their results are fused. Some queries (e.g. "what's the main argument of chapter 3?") will lean more on the high-level layer; others (e.g. "what did the author say about Wittgenstein's beetle?") will lean low-level. The query *classifier* (Haiku) decides the mix weights.

This is roughly the same architecture LightRAG and FalkorDB's GraphRAG SDK use, and it's the published-research-backed choice over Microsoft GraphRAG's community-traversal approach (cheaper, faster on incremental updates, better recall on cross-cutting questions).

## Retrieval flow, in detail

```
User message
    │
    ▼
┌─────────────────────────────────────────┐
│  classify_intent (Haiku, fast)          │
│  → { intent, low_level_weight,          │
│      high_level_weight, filters }        │
└──────────────────┬──────────────────────┘
                   │
   ┌───────────────┼───────────────┐
   ▼                               ▼
┌──────────────────┐         ┌──────────────────┐
│ low_level_retrieve│         │ high_level_retrieve│
│  (entity search) │         │  (theme search)  │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         ▼                            ▼
┌──────────────────┐         ┌──────────────────┐
│ expand_1_hop     │         │ resolve_to_       │
│ (neighbors)      │         │  entities         │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         └──────────────┬─────────────┘
                        ▼
              ┌──────────────────┐
              │   fuse_context    │
              │  (dedup, rank,    │
              │   token-budget)   │
              └────────┬─────────┘
                       ▼
                 Generation prompt
```

## classify_intent

A small Haiku call before retrieval. Returns structured output:

```ts
const IntentSchema = z.object({
  intent: z.enum([
    "factual",      // "Who founded X?"
    "conceptual",   // "What does Y mean?"
    "comparative",  // "How does X differ from Y?"
    "thematic",     // "What is the main argument?"
    "clarification",// "Wait, but earlier you said..."
    "meta",         // "Can you remind me what we talked about?"
  ]),
  topics: z.array(z.string()).describe("Key entity-like phrases from the query"),
  lowLevelWeight: z.number().min(0).max(1),
  highLevelWeight: z.number().min(0).max(1),
  filterByChapter: z.string().nullable(),
});
```

Heuristics the prompt nudges toward:
- `factual` / `conceptual` → low-weight 0.8, high-weight 0.2
- `thematic` → low-weight 0.2, high-weight 0.8
- `comparative` → balanced 0.5 / 0.5
- `clarification` → use memory recall, low retrieval weight 0.3 / 0.3
- `meta` → skip book retrieval entirely; the memory service handles it

## low_level_retrieve

1. Embed the user query.
2. Run a vector search against the `Entity` index in FalkorDB:

```cypher
CALL db.idx.vector.queryNodes('Entity', 'embedding', 12, $queryVector)
YIELD node, score
RETURN node, score
ORDER BY score DESC
```

3. For each top entity, expand 1 hop:

```cypher
MATCH (e:Entity {id: $eid})-[r]-(n:Entity)
WHERE NOT type(r) IN ['MENTIONED_IN']  -- exclude weak chunk-link edges here
RETURN e, r, n
LIMIT 8
```

4. Also fetch the top-3 chunks where the entity is mentioned, for direct quotation:

```cypher
MATCH (e:Entity {id: $eid})-[:MENTIONED_IN]->(c:Chunk)
RETURN c
ORDER BY c.orderIndex
LIMIT 3
```

Output structure:
```ts
type LowLevelResult = {
  entity: Entity;
  score: number;
  neighbors: Array<{ entity: Entity; relationshipType: string; description: string }>;
  chunks: Array<{ content: string; headings: Heading[]; chunkId: string }>;
};
```

## high_level_retrieve

1. Embed the user query.
2. Vector search against the `Theme` index:

```cypher
CALL db.idx.vector.queryNodes('Theme', 'embedding', 5, $queryVector)
YIELD node, score
RETURN node, score;
```

3. For each top theme, fetch member entities (top 5 by centrality within the theme):

```cypher
MATCH (e:Entity)-[:MEMBER_OF]->(th:Theme {id: $themeId})
RETURN e
ORDER BY size((e)--()) DESC
LIMIT 5
```

Output:
```ts
type HighLevelResult = {
  theme: { title: string; summary: string };
  score: number;
  representativeEntities: Entity[];
};
```

## fuse_context

The fusion step is where engineering judgment shows up.

**Algorithm:**
1. Combine all entities from low-level (with their neighbors) and high-level results into a single set, deduplicated by entity ID.
2. For each entity, compute a fused score: `low_score * lowWeight + theme_score * highWeight`. Entities only in the low list use 0 for the theme term; only in the high list use 0 for the low term.
3. Sort by fused score; take top N (start with N=20, tune).
4. Pull the entities' chunks (deduplicated by chunk ID), themes, and relationships.
5. Render into a Markdown context block under a strict token budget (default: 3000 tokens for context out of the model's window, leaving room for memory tiers and the actual conversation).

**The context block layout** that gets injected into the generation prompt:

```markdown
## Relevant from the book

### Themes (high-level synthesis)
- **Theme: "<title>"** — <summary, condensed to ~80 words>
- **Theme: "<title>"** — <summary>

### Key entities
- **<Entity name>** (<type>) — <description>
  - Related: <name> [<rel-type>], <name> [<rel-type>], ...
- **<Entity name>** — ...

### Source passages
> "<chunk content>"
> — *Chapter <n>, Section <name>*
>
> "<chunk content>"
> — *Chapter <n>*
```

This is the *only* book-derived input the generator sees. Memory tiers go in a separate block. Conversation history goes in its own.

## Why not "just throw chunks at it"

A naive RAG approach (embed query → top-k chunks → stuff into prompt) is going to fail Sapphire's user. Specifically:

- **Bad on cross-cutting questions.** "What's the author's overall view on free will?" can't be answered from any 5 chunks because the view is built up across the book. Themes solve this.
- **Bad at disambiguation.** Two chunks might both mention "the cave" — one is Plato's, one is a metaphor for plot-events in another chapter. Entity-typed retrieval makes the distinction concrete.
- **Bad at follow-ups.** "And what about Kant's response to him?" — without a graph, the system doesn't know "him" is Hume from two messages ago. With a graph, the chat-memory's structured entities point straight at the right node.

## Caching

Two layers of cache, both important:

- **Entity-resolution cache**: once we look up an entity by name during a session, we cache it for the session. Same with theme membership. Cheap, big speed-up.
- **Retrieval cache by (sessionId, query-hash)**: identical query within a session returns the cached fused context. Useful for the inevitable "say that again, but ELI5" follow-up.

LRU, 100 entries per session, no time-based expiry needed.

## A worked example

User: *"How does the author treat the concept of the 'sublime' compared to the 'beautiful'?"* (talking to a book on aesthetics)

1. `classify_intent` → `comparative`, topics `["sublime", "beautiful"]`, weights `0.5 / 0.5`.
2. `low_level_retrieve`:
   - Vector search hits entities `Sublime`, `Beautiful`, `Aesthetic Judgment`, `Kant's Third Critique`, scores 0.91, 0.89, 0.78, 0.71.
   - Expand 1 hop on each → pulls in `Burke`, `Critique of Judgment`, `Mathematical Sublime`, `Dynamic Sublime`, etc.
   - Fetch top chunks for each.
3. `high_level_retrieve`:
   - Theme `"Two faculties of aesthetic response"` scores 0.86.
   - Theme `"The history of the sublime/beautiful distinction"` scores 0.79.
4. `fuse_context`:
   - Top entities: `Sublime`, `Beautiful`, `Mathematical Sublime`, `Dynamic Sublime`, `Burke`, `Kant`.
   - Top themes: both, with summaries.
   - 4 chunks of supporting prose, deduplicated.
5. Generation prompt gets:
   - Context block (entities + themes + chunks, ~2500 tokens)
   - Memory tiers (active + relevant L2 recall, ~800 tokens)
   - Conversation so far (~1500 tokens)
   - System prompt + the user message
6. Sonnet generates a paragraph answer with one or two inline citations like `[ch. 3 §2]`.
7. After streaming, `extract_ideas` notices a new claim node "Sublime evokes awe through magnitude; Beautiful evokes harmony through form" and links it to the `Sublime` and `Beautiful` book entities. New chat-graph node, two new edges.

## Knobs

The hybrid retrieval has a few hyperparameters. Defaults are listed below; tune by eyeballing 20 example conversations.

| Knob                          | Default | Sane range |
| ----------------------------- | ------- | ---------- |
| Low-level top-k entities      | 12      | 5–20       |
| Low-level neighbor depth      | 1       | 1–2        |
| Neighbor cap per entity       | 8       | 4–15       |
| Chunks per entity             | 3       | 1–5        |
| High-level top-k themes       | 5       | 3–8        |
| Entities per theme            | 5       | 3–10       |
| Entity merge cosine threshold | 0.92    | 0.88–0.96  |
| Fused context token budget    | 3000    | 1500–5000  |

Make these adjustable from a Settings → Retrieval screen. Recruiters love seeing a system you can actually tune.

## Evaluation

See [`11-evaluation.md`](11-evaluation.md). The short version: prepare a hand-built set of ~30 question/expected-answer pairs over one or two known books. Compare:
- Naive chunk RAG (baseline)
- Low-level only
- High-level only
- Full hybrid (the system as designed)

Score with LLM-as-judge (Sonnet rates groundedness and completeness). The hybrid setup should win meaningfully on both. Putting the eval and the numbers in the README is a flex worth doing.
