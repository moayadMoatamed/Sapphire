# 03 — PDF Ingestion Pipeline

This is how a PDF becomes a populated, queryable knowledge graph. It's the biggest piece of engineering in Sapphire and the one a recruiter is most likely to ask about in detail.

## Pipeline overview

```
PDF
 │
 ▼
[parse] ─────► structured Markdown (LlamaParse)
 │
 ▼
[chunk] ─────► semantic chunks (~800 tokens, heading-aware)
 │
 ▼
[extract_entities] ────► raw entities + claims  per chunk    (Haiku, parallel batches)
 │
 ▼
[resolve_duplicates] ──► canonicalized entities             (name + embedding similarity)
 │
 ▼
[extract_relationships] ► triples between resolved entities (Sonnet)
 │
 ▼
[build_themes] ────────► theme clusters from chunk neighborhoods (Haiku summaries)
 │
 ▼
[embed] ───────────────► vectors for chunks, entities, themes (Voyage AI)
 │
 ▼
[write_to_graph] ──────► FalkorDB graph `book_<bookId>`     (transactional)
 │
 ▼
[finalize] ────────────► mark book ready, emit completion event
```

Each step is a LangGraph node. State carries the full intermediate data and a `progress` field that the API streams back to the UI as SSE.

## Step 1 — Parse

**Goal:** Turn the PDF into clean, structured Markdown.

**How:**

```ts
import { LlamaParseReader } from "llama-cloud-services/parse";

const reader = new LlamaParseReader({
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
  resultType: "markdown",
  // Treat each chapter-like section as its own "page" for downstream chunking
  splitByPage: false,
  // Send images of pages for vision-aware parsing (better for diagrams/figures)
  premiumMode: true,
});

const docs = await reader.loadData(filePath);
const markdown = docs.map(d => d.text).join("\n\n");
```

Why LlamaParse:
- Preserves heading hierarchy (`#`, `##`, `###`) — critical for semantic chunking
- Handles tables natively
- Captions images (which we then store and can reference in the chat)
- Fast (cloud), no GPU on our side

**Fallback path** (when LlamaParse is unavailable or the user opts out):

```ts
import { UnstructuredClient } from "unstructured-client";
// ...
const partitions = await client.general.partition({
  partitionParameters: { files: { content: pdfBuffer, fileName: "book.pdf" }, strategy: "hi_res" },
});
```

Both paths produce a string. From that point on, the pipeline is identical.

**Failure modes & handling:**
- **Parse timeout** → retry once with `premiumMode: false`, then fail loudly with a user-facing error.
- **Empty document** → likely a scanned PDF without OCR. LlamaParse handles this automatically; if Unstructured is the parser, set `strategy: "hi_res"`.
- **Very large book** (>500 pages) → split into chapter-sized chunks of pages on the parser side, process in parallel.

## Step 2 — Chunk

**Goal:** Split the Markdown into chunks that are coherent, neither too short nor too long, and that respect document structure.

**Strategy:** *Hierarchical heading-aware chunking with semantic splitting at the leaves.*

```ts
import { MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const headerSplitter = new MarkdownHeaderTextSplitter({
  headersToSplitOn: [["#", "h1"], ["##", "h2"], ["###", "h3"]],
});

const headerSections = await headerSplitter.splitText(markdown);

const leafSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,       // tokens, roughly
  chunkOverlap: 100,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

const chunks: Chunk[] = [];
for (const section of headerSections) {
  const leafChunks = await leafSplitter.splitText(section.pageContent);
  for (const [i, content] of leafChunks.entries()) {
    chunks.push({
      id: `book_${bookId}_chunk_${chunks.length.toString().padStart(5, "0")}`,
      content,
      headings: section.metadata,
      orderIndex: chunks.length,
    });
  }
}
```

Important:
- **Heading metadata travels with the chunk**, so every entity extracted from a chunk knows which chapter/section it came from. This is what lets you eventually answer questions like "what does the author argue in chapter 4?" by filtering on the `chapter` property of the chunks.
- **Overlap** prevents extraction from missing entities that straddle a chunk boundary.

For a 300-page book expect 400–700 chunks.

## Step 3 — Extract entities & claims

**Goal:** For each chunk, extract the named entities (people, concepts, theories, places, works) and the claims the text makes about them.

**Model:** Haiku. Cheap and very capable for structured extraction.

**Prompting:** Use the LangChain `withStructuredOutput` pattern with a zod schema. NOT freeform JSON parsing.

```ts
import { z } from "zod";

const EntitySchema = z.object({
  name: z.string().describe("Canonical name of the entity"),
  type: z.enum(["Person", "Concept", "Theory", "Work", "Place", "Event", "Organization"]),
  description: z.string().describe("One-sentence definition grounded in the chunk text"),
  aliases: z.array(z.string()).describe("Alternative names mentioned in the chunk").default([]),
});

const ClaimSchema = z.object({
  subject: z.string().describe("Entity name the claim is about"),
  predicate: z.string().describe("The relation or assertion, in short verb-phrase form"),
  object: z.string().describe("The object of the claim — another entity or a literal value"),
  evidence: z.string().describe("Exact phrase or sentence from the chunk supporting this claim"),
});

const ExtractionSchema = z.object({
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
});

const extractor = haikuModel.withStructuredOutput(ExtractionSchema);

const extracted = await extractor.invoke([
  { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
  { role: "user", content: chunk.content },
]);
```

**Concurrency:** run extraction in batches of ~10 chunks in parallel (`p-limit(10)`) — respects rate limits and uses cores. Failed batches are retried with exponential backoff.

**Prompt design** (see `prompts/extract_entities.md` in the repo):
- Few-shot with 2 examples drawn from a different domain than the book (so the model doesn't memorize examples)
- Explicit instruction to prefer canonical names ("Immanuel Kant" not "Kant", "Critique of Pure Reason" not "the first Critique")
- Penalize generic entities (don't extract "knowledge" or "system" as a Concept on their own — only when they're a specific, named concept in the book)

## Step 4 — Resolve duplicates

**Goal:** Across chunks, "Kant", "Immanuel Kant", and "I. Kant" should all be one entity.

**Algorithm:**

```ts
async function resolveEntities(raw: ExtractedEntity[]): Promise<ResolvedEntity[]> {
  // 1. Normalize names (strip titles, normalize whitespace, lowercase compare)
  const normalized = raw.map(e => ({ ...e, key: normalizeName(e.name) }));

  // 2. Group by normalized exact match
  const groups = groupBy(normalized, e => e.key);

  // 3. For each group, embed the descriptions and merge entries with cosine >0.92
  for (const [, group] of groups) {
    if (group.length === 1) continue;
    const embeddings = await embed(group.map(e => e.description));
    // Union-find by similarity threshold
    const components = unionFindBySim(embeddings, 0.92);
    // Each component becomes one entity; descriptions concatenated and re-summarized by Haiku
  }

  // 4. Cross-group: detect potential merges by embedding similarity of names+descriptions
  // (e.g. "the categorical imperative" and "Kant's moral law" might be the same)
  // Threshold: 0.95+ to merge, 0.88-0.95 flagged for review (logged, not blocked)

  return mergedEntities;
}
```

This is the step where most amateur ingestion pipelines fall over. You can show this off at a recruiter's screen-share by demoing: "look, the same author appears 200 times in the chunks; here are the 200 raw extractions, here is the one resolved entity."

## Step 5 — Extract relationships

**Goal:** Now that entities are canonical, identify the relationships between them.

**Model:** Sonnet, because relationship extraction needs reasoning ("does the author *endorse* this view or *critique* it?").

**Approach:** For each pair of co-occurring entities (i.e. both mentioned in the same chunk or in adjacent chunks), have Sonnet determine if there's a meaningful relationship.

```ts
const RelationshipSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum([
    "INFLUENCES", "CRITIQUES", "EXTENDS", "CONTRADICTS",
    "IS_A", "PART_OF", "AUTHORED", "MENTIONS",
    "CAUSES", "EXEMPLIFIES", "DEFINES", "PROVES",
  ]),
  description: z.string().describe("Short justification, grounded in the source text"),
  evidence: z.string().describe("Quoted snippet from the chunk"),
  confidence: z.enum(["high", "medium", "low"]),
});
```

Filter out `confidence: low` relationships from the graph; keep them in a side-table for "weak signal" recovery during retrieval.

The relationship type vocabulary is a key design decision. Don't let the LLM invent types — provide a fixed enum or you'll get 200 distinct relationship types like `IS_INFLUENCED_BY`, `INFLUENCED_BY`, `WAS_INFLUENCED_BY`. Constrain it.

## Step 6 — Build themes (high-level layer)

**Goal:** LightRAG-style dual-level retrieval needs *two* indexes: one for entities (low-level), one for themes (high-level). This step builds the themes.

**Approach:**
1. Run a community-detection algorithm over the entity graph. Two options:
   - **graphology + graphology-communities-louvain** — fast, runs in Node, perfect.
   - In FalkorDB itself once `CALL algo.louvain(...)` is fully there — check current support.
2. For each community, summarize the entities + their claims into a "theme" via Haiku:

```ts
const ThemeSchema = z.object({
  title: z.string().describe("3-5 word theme title"),
  summary: z.string().describe("2-3 paragraph synthesis of the theme"),
  keyEntities: z.array(z.string()),
});
```

3. Themes become nodes themselves with `MEMBER_OF` edges from entities.

Themes are the "global understanding" layer — they're what GraphRAG uses for "what is this book about?" queries.

## Step 7 — Embed

**Goal:** Make everything searchable by vector similarity.

Three things get embedded:
- **Chunks** — for naive RAG fallback
- **Entity descriptions** — for low-level retrieval
- **Theme summaries** — for high-level retrieval

```ts
import { VoyageEmbeddings } from "@langchain/community/embeddings/voyage";

const embeddings = new VoyageEmbeddings({
  apiKey: process.env.VOYAGE_API_KEY,
  modelName: "voyage-3-large",
});
```

Voyage's `voyage-3-large` is currently top of MTEB for general English. `text-embedding-3-large` (OpenAI) is the swap-in.

Vectors are stored *in FalkorDB* as properties on the corresponding nodes. FalkorDB has built-in HNSW indexing — one less moving piece.

```cypher
CREATE VECTOR INDEX FOR (e:Entity) ON e.embedding
OPTIONS { dimension: 1024, similarityFunction: 'COSINE', M: 16, efConstruction: 200 };
```

## Step 8 — Write to graph

**Goal:** Persist everything in FalkorDB inside a graph named `book_<bookId>`.

```cypher
// Entities
UNWIND $entities AS e
MERGE (n:Entity {id: e.id})
SET n += {
  name: e.name,
  type: e.type,
  description: e.description,
  aliases: e.aliases,
  embedding: e.embedding,
  bookId: e.bookId
};

// Chunks (kept for citation-by-passage)
UNWIND $chunks AS c
CREATE (n:Chunk {id: c.id})
SET n += {
  content: c.content,
  headings: c.headings,
  orderIndex: c.orderIndex,
  embedding: c.embedding,
  bookId: c.bookId
};

// MENTIONS edges (entity → chunk)
UNWIND $mentions AS m
MATCH (e:Entity {id: m.entityId})
MATCH (c:Chunk {id: m.chunkId})
MERGE (e)-[:MENTIONED_IN]->(c);

// Typed relationships
UNWIND $relationships AS r
MATCH (s:Entity {id: r.sourceId})
MATCH (t:Entity {id: r.targetId})
CALL apoc.create.relationship(s, r.type, {description: r.description, evidence: r.evidence, confidence: r.confidence}, t)
YIELD rel
RETURN rel;
// (FalkorDB equivalents apply; relationship type set dynamically with CYPHER's standard syntax)

// Themes
UNWIND $themes AS t
CREATE (th:Theme {id: t.id, title: t.title, summary: t.summary, embedding: t.embedding})
WITH th, t
UNWIND t.keyEntityIds AS eid
MATCH (e:Entity {id: eid})
MERGE (e)-[:MEMBER_OF]->(th);
```

Wrap the whole thing in a transaction. If it fails partway, drop the graph and retry from a checkpoint — don't leave a half-built book in the DB.

## Step 9 — Finalize

- Mark the book row in Postgres as `status='ready'`
- Compute summary stats (#entities, #relationships, #themes, total cost in $) and store them
- Emit a `book.ready` SSE event so the UI flips from "ingesting" to "chat now"

## Cost & time, expected

| Item                       | Per 300-page book (typical)                |
| -------------------------- | ------------------------------------------- |
| LlamaParse                 | ~$0.10 (free tier covers ~3 books / month) |
| Entity extraction (Haiku)  | ~$0.30                                      |
| Relationship extraction (Sonnet) | ~$0.50–1.50 depending on entity count   |
| Theme summaries (Haiku)    | ~$0.05                                      |
| Embeddings (Voyage)        | ~$0.05                                      |
| **Total**                  | **~$1.00–$2.00 per book**                   |
| Wall-clock time            | 6–12 minutes                                |

Surface these numbers in the UI. It's an honesty signal that builds trust with the user (and tells a recruiter you think about cost).

## What to show off

- **The progress UI.** As each stage completes, show counts: "247 entities found, 89 relationships extracted, 12 themes identified". Live. Streamed.
- **An interactive log.** Right-side panel during ingestion: every LLM call, with token counts and cost. Click any one to see the prompt and response.
- **The "explain this entity" feature post-ingestion.** Click any entity in the graph → see its description, the chunks it appears in, its claims, and its relationships. That's the polished demo move.
