# 05 — Context Management

This is the refined version of the scheme you sketched. The bones are kept (mini-rounds, summarization, memory + context objects), but a few load-bearing pieces are added because the original scheme has failure modes that would hurt UX.

## The problem the original scheme has

Your original:
- mini-round = 1 user message + 1 LLM response
- major-round = 3 mini-rounds
- at every major-round, summarize and keep only the last mini-round
- `memory` object has notes and topic statuses; `context` object has the active mini-rounds

What breaks:

1. **Summary degradation.** After major-round #5, the "summary" you're carrying is a summary of a summary of a summary of a summary. Nuance dies fast — by major-round #10 the model genuinely doesn't know what was said in major-round #2 except in the most generic terms.

2. **Hard cutoff at one mini-round.** A topic that was being unfolded across 4 messages gets sliced in half at the boundary. The LLM forgets specifics mid-thread.

3. **No retrieval mechanism for old content.** Once something is summarized away, it's gone. If the user circles back ("you mentioned earlier that X — can you go deeper?") the model can't surface the original detail.

4. **Token-blind.** A "mini-round" with a 50-word message + 50-word response is not the same as a mini-round with a 2000-word essay + 2000-word response. Counting rounds, not tokens, leads to either premature or delayed summarization.

## The fix: four-tier memory

```
┌─────────────────────────────────────────────────────────────┐
│ L0  ACTIVE CONTEXT       (last N mini-rounds, verbatim)     │
│     ────────────────────────────────────────────────────────│
│     Goal: zero-cost lookup of "what was just said"          │
│     Default size: 3 mini-rounds (6 messages)                │
│     Trigger to compress: > 4000 tokens OR > 6 mini-rounds   │
└─────────────────────────────────────────────────────────────┘
                                  │ when over threshold, oldest pair gets summarized
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│ L1  RECENT SUMMARIES     (rolling window of summary chunks) │
│     ────────────────────────────────────────────────────────│
│     Goal: fluent recall of the recent past                  │
│     Default size: last 5 summary chunks                     │
│     Stored as text + embedding + topic tags                 │
└─────────────────────────────────────────────────────────────┘
                                  │ when over capacity, oldest summary chunk moves out
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│ L2  LONG-TERM SEMANTIC   (all old summaries, searchable)    │
│     ────────────────────────────────────────────────────────│
│     Goal: "I remember we talked about X 30 messages ago"    │
│     Embedded; retrieved by semantic similarity to query     │
│     No size limit                                           │
└─────────────────────────────────────────────────────────────┘
                                  │ continuously updated alongside L0/L1
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│ L3  STRUCTURED MEMORY    (entities, topics, decisions, etc.)│
│     ────────────────────────────────────────────────────────│
│     Goal: explicit state the model can reason over directly │
│     Updated incrementally on every turn                     │
└─────────────────────────────────────────────────────────────┘
```

Each tier earns its place:

- **L0** keeps your "1 mini-round verbatim" idea but extends it to 3 (configurable), so multi-message threads don't get truncated mid-thought.
- **L1** is your "summary after every major round" idea, but kept as a *rolling window of multiple summary chunks*, not a single ever-degrading blob.
- **L2** is new and important — it's what makes long persistent chat actually work. We don't throw away history; we embed it so we can recall it.
- **L3** is your `memory` object, properly schematized.

## Schemas

### L0 (in-memory + checkpointed)

Just the last K messages, in order:

```ts
type ActiveContext = Message[];
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  miniRoundIndex: number;
  tokens: number;
  createdAt: Date;
};
```

### L1 (Postgres `chat_summaries` table)

```ts
type SummaryChunk = {
  id: string;
  sessionId: string;
  ordinal: number;             // 0, 1, 2, ... in creation order
  text: string;                // ~300-500 token summary
  embedding: number[];         // for L2 use
  topicTags: string[];         // surfaced topics for filtering
  coveredMiniRounds: [number, number];  // inclusive range of mini-round indices
  tokenCountOriginal: number;
  tokenCountSummary: number;
  createdAt: Date;
};
```

### L2

Same table as L1. Tier is just "the older chunks beyond the rolling-window cap". Indexed by:
- `sessionId` (B-tree)
- `embedding` (HNSW via pgvector OR FalkorDB if we want to colocate; **decision: Postgres pgvector for memory**, FalkorDB for book/idea graphs only)
- `topicTags` (GIN)

### L3 (Postgres `structured_memory` table, JSONB)

```ts
type StructuredMemory = {
  sessionId: string;
  topics: Topic[];
  decisions: Decision[];
  openQuestions: OpenQuestion[];
  userPreferences: Record<string, string>;  // "user prefers depth over breadth" etc.
  updatedAt: Date;
};

type Topic = {
  id: string;
  name: string;
  status: "ongoing" | "resolved" | "tabled" | "contradicted";
  firstMentionedAt: number;   // mini-round index
  lastMentionedAt: number;
  description: string;
  linkedBookEntityIds: string[];
};

type Decision = {
  id: string;
  statement: string;
  reasoning: string;
  miniRoundIndex: number;
};

type OpenQuestion = {
  id: string;
  question: string;
  raisedAt: number;
  context: string;
};
```

## When the cascade fires

**After every assistant turn** (post-streaming, async):

```ts
async function summarizeIfNeeded(sessionId: string) {
  const l0 = await getActiveContext(sessionId);
  const tokens = sumTokens(l0);

  // Compress oldest mini-round into a summary chunk if either threshold hits
  while (tokens > L0_TOKEN_LIMIT || l0.length > L0_MINI_ROUNDS_LIMIT * 2) {
    const oldestPair = l0.splice(0, 2); // [user, assistant]
    const summary = await summarizeMiniRound(oldestPair);
    await appendSummaryChunk(sessionId, summary);
    tokens -= sumTokens(oldestPair);
  }

  await persistActiveContext(sessionId, l0);
  await maybeCompactSummaryChunks(sessionId); // see below
}
```

**`maybeCompactSummaryChunks`** (every few summaries, opportunistically):

If L1 exceeds its size (default 5 chunks), it doesn't *delete* the oldest — it just stops including it in active context. It stays in L2, retrievable by recall.

Periodically (e.g., every 10 turns), an optional *meta-compaction* fires: take the 3 oldest L1 chunks and re-summarize them into one denser chunk. This is the only place "summary of summaries" happens, and it's bounded — we never recursively compact a meta-summary.

## How the context block is assembled on each turn

```ts
async function buildContextForTurn(sessionId: string, userMessage: string): Promise<ContextBlock> {
  // 1. Active context — always in
  const active = await getActiveContext(sessionId);

  // 2. Recent summaries — always in
  const recent = await getRecentSummaries(sessionId, { limit: 5 });

  // 3. Semantic recall — search L2 for relevant old summaries
  const recalled = await recallSemantic(sessionId, userMessage, {
    k: 3,
    minScore: 0.7,
    excludeIds: recent.map(r => r.id),  // don't duplicate
  });

  // 4. Structured memory — always in (it's small)
  const structured = await getStructuredMemory(sessionId);

  return {
    active,
    recent,
    recalled,
    structured,
  };
}
```

The generation prompt has dedicated, labeled sections for each (see [`06-langgraph-flows.md`](06-langgraph-flows.md) for the prompt template):

```
<active_conversation>
  (last 3 mini-rounds verbatim)
</active_conversation>

<recent_summary>
  (L1 rolling summaries, concatenated)
</recent_summary>

<earlier_relevant>
  (L2 recalled by similarity to the current message)
</earlier_relevant>

<known_state>
  Open questions: ...
  Resolved decisions: ...
  Active topics: ...
</known_state>

<book_context>
  (from GraphRAG retrieval)
</book_context>

User: <current message>
```

## What the user sees

Most of this is invisible — that's the point. But surface enough to be a portfolio differentiator:

- **A "Memory" tab next to the chat.** Shows the structured L3 in real time: active topics with statuses, decisions made, open questions. As the user chats, these populate live.
- **A "Recall" indicator on each assistant message.** Small chip: "Recalled: discussion of intentionality from message 23 ↗" (click → jumps to that message). This makes the L2 retrieval visible and impressive.
- **A "Summarize now" button.** For power users who want to see the system compress mid-conversation. Mostly a demo move, but useful.

## Edge cases

- **User pastes a 5000-word document into a message.** Treat oversized messages specially: the message itself is *not* stored in L0 verbatim; instead it's chunk-summarized inline and the summary goes in L0, while the full text is stored in a `large_inputs` table with embedding for recall.
- **Topic re-opens.** When semantic recall surfaces a topic the structured memory has marked `resolved`, mark it `ongoing` again on the next turn that elaborates it.
- **Contradictions.** If a new decision contradicts a stored one, *don't* overwrite — mark the old one `contradicted` and add the new one. The graph view shows this as a contradiction edge.

## Implementation note

This is the part to use LangGraph's checkpointing for, not roll your own. The graph state includes references to L0/L1/L3 (L2 is queried, not stored in state), and the checkpointer persists it. When a chat thread resumes, the LangGraph machine reconstructs everything from state — no extra bookkeeping.

```ts
import { StateGraph, Annotation } from "@langchain/langgraph";

const ChatState = Annotation.Root({
  messages: Annotation<Message[]>({ reducer: (curr, next) => [...curr, ...next] }),
  activeContext: Annotation<Message[]>(),
  recentSummaries: Annotation<SummaryChunk[]>(),
  recalled: Annotation<SummaryChunk[]>(),
  structuredMemory: Annotation<StructuredMemory>(),
  bookContext: Annotation<RetrievalContext>(),
  // ...
});
```

## What to test (and brag about in the README)

1. **The "100-turn test"**: a synthetic conversation of 100 turns on a single book. Compare:
   - No memory system (just OpenAI's default behavior with a chat history list, truncated by length)
   - Your tiered memory
   Score: factual consistency of references made at turn 100 to claims established at turn 5.
2. **The "I forgot what you said" recall test**: at turn 60, ask about something from turn 15. Confirm L2 retrieves it.
3. **The contradiction test**: explicitly make two contradictory claims 30 turns apart, then ask the model which is correct. Confirm the graph shows the contradiction edge.

Document the results. This is the kind of evidence-of-engineering that gets you to second-round interviews.
