# 07 — The Chat Idea Graph

This is the feature that makes Sapphire memorable. It's also the easiest one to ship badly. The difference between "wow, a live mind map of my thinking" and "lol, a bunch of disconnected dots" is the typing of the nodes and edges.

## What it is

As the user chats, the system extracts structured *idea nodes* from the conversation, links them to each other and to entities in the book's knowledge graph, and renders the whole thing as a force-directed graph beside the chat.

Picture it: chat on the left, graph on the right. As the user sends a message, a couple of new nodes pulse into existence in the graph. Edges form. Older nodes drift to the periphery. The user is *literally watching their thinking become a map*.

## What goes into the graph

Four node types:

| Node type    | Description                                                                                                  | Example                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **Claim**    | An assertion the user made or that emerged from the conversation that wasn't already in the book           | "Kant's categorical imperative fails when applied to lying to the murderer"      |
| **Question** | An open question the conversation raised but didn't resolve                                                  | "Is the sublime culturally constructed or universal?"                            |
| **Decision** | An interpretive choice the user committed to during the chat                                                | "I'll read Kant's third Critique as primarily about epistemology, not aesthetics" |
| **Concept**  | A user-derived concept — a synthesis, a label, a heuristic — that isn't a direct book entity              | "Negative virtue ethics"                                                         |

Importantly, *book entities themselves don't go in the chat graph*. They live in the book graph. The chat graph holds *the user's relationship to those entities*. When a user node references a book entity, it gets a link to it (rendered as an edge between the two graphs in the unified view).

Five edge types:

| Edge type        | Connects                | Means                                                                                  |
| ---------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `supports`       | Claim → Claim/Concept    | The source provides reason for the target                                              |
| `contradicts`    | Claim → Claim            | The source argues against the target                                                   |
| `refines`        | Claim → Claim            | The source is a more nuanced version of the target (the target stays for history)    |
| `derived-from`   | Any → Book Entity        | The user's node was prompted by this book concept                                      |
| `answers`        | Claim → Question         | The claim is an answer (proposed or final) to the question                             |

That's it. Five edge types, four node types. Don't expand the schema without a fight.

## How nodes get created

The `extract_ideas` LangGraph node runs after every assistant message. It sees:

- The user's last message
- The assistant's response
- The current chat-graph state (last ~30 nodes + recent edges)
- The book entities mentioned in the retrieval context

It runs a Haiku call with structured output:

```ts
const IdeaExtractionSchema = z.object({
  newNodes: z.array(z.object({
    type: z.enum(["Claim", "Question", "Decision", "Concept"]),
    title: z.string().describe("Short noun phrase, ~5-10 words"),
    content: z.string().describe("Full statement, 1-2 sentences"),
    miniRoundIndex: z.number(),
    confidence: z.enum(["high", "medium", "low"]),
  })),
  newEdges: z.array(z.object({
    sourceRef: z.string().describe("Title of a node (new or existing) that is the source"),
    targetRef: z.string().describe("Title of a node (new or existing) that is the target"),
    type: z.enum(["supports", "contradicts", "refines", "derived-from", "answers"]),
  })),
  resolvesQuestions: z.array(z.string()).describe("Titles of existing Question nodes that this turn resolved"),
});
```

The system prompt for this extractor is *strict*:

```
You are extracting ideas from a single turn of conversation about a book.

Be conservative. Only extract nodes that are real intellectual content:
- A new Claim that wasn't trivially obvious from the book itself
- A genuine open Question the conversation raised
- An interpretive Decision the user made
- A synthesized Concept that the user has now committed to

DO NOT extract:
- Restatements of book content (those are book entities)
- Politeness, transitions, filler
- Speculative possibilities the user didn't endorse
- More than 3 nodes per turn unless the turn is genuinely dense

For edges, prefer fewer high-confidence edges over many speculative ones.

Existing chat-graph nodes are shown below as context. Reuse them where appropriate via the `sourceRef`/`targetRef` fields by exact title match. Don't recreate them.
```

After extraction, a small post-processing step:
1. Resolve `sourceRef`/`targetRef` to actual node IDs (by exact title match → fall back to embedding similarity > 0.85 → fall back to creating a stub node)
2. Dedupe: if a new node has an embedding similarity > 0.92 to an existing node, merge content into the existing one instead of creating a new node
3. Write to FalkorDB

## The book ↔ chat connection

When the user mentions a book entity in a way the chat graph picks up (e.g., a Claim talks about "Kant's categorical imperative"), the extractor emits a `derived-from` edge:

```ts
{ sourceRef: "<claim title>", targetRef: "<book entity name>", type: "derived-from" }
```

The graph service resolves the target: it tries the chat graph first, then falls back to the book graph. If it finds the entity in the book graph, the edge is stored as a *cross-graph reference*:

```ts
type CrossGraphEdge = {
  sourceId: string;          // chat-graph node ID
  targetType: "BookEntity";
  targetBookId: string;
  targetEntityId: string;
  edgeType: "derived-from";
};
```

In the unified visualization, book entities that are referenced from the chat appear as nodes in the visualization (otherwise the user-graph would have edges to nowhere). They're styled distinctly — slightly muted, with the book's color.

## Layout

**Force-directed (ForceAtlas2 via graphology)** with these tunings:

- Node repulsion scaled by node degree (highly connected nodes get more space)
- Edge length proportional to age (older edges shrink, pulling stable clusters together)
- Gravity *low* (the graph spreads, doesn't ball up)
- Continuous incremental layout — when a new node is added, existing nodes barely move (use graphology's `inferSettings` then nudge)

Visual:
- Claim → blue
- Question → amber
- Decision → green
- Concept → purple
- Book entity (when shown) → muted ink, with book accent color
- Edge color = type; thickness = confidence

A "focus mode" toggle: click any node → it stays centered, the rest fade to background. Useful for screenshotting and for actual reading.

## Visualization tech

Sigma.js + graphology, as covered in [`02-tech-stack.md`](02-tech-stack.md). Specifics:

```ts
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";

const graph = new Graph({ multi: false, type: "undirected" });
// ... addNode, addEdge from server data

const layout = new FA2Layout(graph, {
  settings: {
    gravity: 0.1,
    scalingRatio: 8,
    strongGravityMode: false,
    barnesHutOptimize: true,
  },
});

layout.start();

const renderer = new Sigma(graph, container, {
  defaultNodeColor: theme.colors.ink,
  defaultEdgeColor: theme.colors.edgeDim,
  labelColor: { color: theme.colors.foreground },
  // Custom node program for the "pulse" animation on new nodes
});
```

A WebWorker runs the force layout; the main thread just renders. This is what keeps it feeling like Obsidian instead of locking up.

## Why this is more than Obsidian's graph view

Obsidian's graph view is gorgeous but dumb — it shows file-to-file backlinks. Sapphire's:

- **Has typed nodes**: not just "things connected to things", but Claims, Questions, etc.
- **Has typed edges**: not just edges, but `supports`, `contradicts`, `refines`.
- **Builds itself**: you don't have to write the links by hand.
- **Connects to the source material**: chat nodes link back to book entities.
- **Shows evolution**: temporal data on every node and edge means we can do a "rewind" animation showing how the graph grew (huge demo move).

## Interactions

| User action                       | Effect                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Click a chat-graph node           | Side panel shows the node's content, the chat turns it was extracted from, its edges |
| Click a book-entity node           | Side panel shows the book entity, jumps to the chat-graph nodes that reference it    |
| Hover a node                       | Highlights its 1-hop neighborhood                                                    |
| Right-click a node                 | "Find similar" (embedding search), "Hide", "Pin position"                            |
| Click an edge                      | Shows the turns where the relation was established                                   |
| Search box                         | Filter nodes by title or content (full-text + embedding fallback)                    |
| Time slider at the bottom          | Rewind the graph — what did it look like at turn 30? At turn 50? **Demo gold.**       |

## Persistence

Chat-graph nodes live in FalkorDB in a graph named `chat_<sessionId>` (one graph per session). Same FalkorDB instance as book graphs.

```cypher
// Schema
CREATE NODE TABLE Idea(
  id STRING PRIMARY KEY,
  type STRING,           // Claim | Question | Decision | Concept
  title STRING,
  content STRING,
  miniRoundIndex INT64,
  confidence STRING,
  embedding FLOAT[1024],
  createdAt INT64,
  status STRING           // active | resolved | superseded
);

CREATE REL TABLE IdeaEdge(
  FROM Idea TO Idea,
  type STRING,            // supports | contradicts | refines | derived-from | answers
  createdAt INT64,
  miniRoundIndex INT64
);

CREATE VECTOR INDEX FOR (i:Idea) ON i.embedding
OPTIONS { dimension: 1024, similarityFunction: 'COSINE' };
```

Cross-graph references (chat node → book entity) live in Postgres, not FalkorDB — they cross a graph boundary, which FalkorDB doesn't handle natively. Cheap join at query time.

## Don't oversell it

The chat-graph will sometimes be wrong. Nodes will be created that the user wouldn't have called nodes; the model will occasionally type a Claim as a Question. Two mitigations:

1. **Confidence levels are persisted.** The graph view dim-codes low-confidence nodes.
2. **A small "✗" on every node** lets the user delete one with no friction. This is more important than it sounds: a feature that's wrong sometimes but easy to correct beats one that pretends to be perfect.

## The killer demo move

Set up a 20-message conversation with a book ahead of time. Hit "rewind" on the graph. Watch nodes pulse into existence in the order they were created. Pause at message 8. Show the resolved questions becoming filled in. Then play to the end.

This is your portfolio video. Record it.
