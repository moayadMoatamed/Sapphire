# 09 — API Design

All API routes live under `app/api/` as Next.js Route Handlers. Streaming uses Server-Sent Events (SSE) — simpler than WebSockets for a one-way server-to-client stream and plays nicely with Next.js's runtime.

## Routes

| Method | Path                              | Purpose                                          | Streams?            |
| ------ | --------------------------------- | ------------------------------------------------ | ------------------- |
| POST   | `/api/books/upload`               | Upload a PDF, kick off ingestion                 | No (returns book ID immediately) |
| GET    | `/api/books`                      | List user's books                                | No                  |
| GET    | `/api/books/:id`                  | Get book details + stats                        | No                  |
| GET    | `/api/books/:id/status`           | SSE — ingestion progress                        | **Yes** (SSE)        |
| DELETE | `/api/books/:id`                  | Delete book + its FalkorDB graph                | No                  |
| GET    | `/api/books/:id/graph`            | Fetch the book's KG (paginated)                 | No                  |
| GET    | `/api/books/:id/entity/:eid`      | Drill-down on one entity                        | No                  |
| POST   | `/api/sessions`                   | Create new chat session for a book              | No                  |
| GET    | `/api/sessions`                   | List user's sessions                            | No                  |
| GET    | `/api/sessions/:id/messages`      | Fetch message history (paginated)               | No                  |
| GET    | `/api/sessions/:id/memory`        | Fetch L3 structured memory                      | No                  |
| GET    | `/api/sessions/:id/idea-graph`    | Fetch the chat idea graph                       | No                  |
| POST   | `/api/chat/send`                  | Send a message, stream the assistant reply      | **Yes** (SSE)        |
| GET    | `/api/usage`                      | Per-user cost/usage summary                     | No                  |
| GET    | `/api/admin/traces/:threadId`     | LangGraph trace details (debug)                 | No                  |

## Streaming contract

The two streaming endpoints emit a shared event schema:

```ts
// Event envelope
type SseEvent =
  | { type: "status";  data: { node: string; phase: "start" | "end" | "error"; details?: unknown } }
  | { type: "token";   data: { content: string } }
  | { type: "message"; data: { role: "assistant"; content: string; id: string } }
  | { type: "graph";   data: { sessionId: string; nodes: IdeaNode[]; edges: IdeaEdge[] } }
  | { type: "memory";  data: { topics?: Topic[]; openQuestions?: OpenQuestion[] } }
  | { type: "stats";   data: BookStats }
  | { type: "error";   data: { code: string; message: string } }
  | { type: "done";    data: { /* terminal event */ } };
```

Sent as standard SSE — each event is a `data: <JSON>\n\n` block, with `event: <type>` prefix for client-side dispatch.

## POST `/api/chat/send`

Request:
```ts
{ sessionId: string; content: string }
```

Response (SSE):
- `event: status` — node-level lifecycle from LangGraph (`recall`, `classify_intent`, `retrieve_low_level`, `retrieve_high_level`, `fuse_context`, `generate`, `extract_ideas`, `update_memory`, `update_graph`)
- `event: token` — streamed assistant content
- `event: message` — full assistant message (after stream ends)
- `event: graph` — delta of new chat-graph nodes/edges (after `extract_ideas` completes)
- `event: memory` — delta of structured memory updates (after `update_memory` completes)
- `event: done`

The client renders tokens into the chat bubble live, then refreshes the side-panel graph view from the `graph` event delta.

Server implementation sketch:

```ts
// app/api/chat/send/route.ts
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { sessionId, content } = await req.json();
  const userId = await getUserId(req);
  await assertSessionOwnership(userId, sessionId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        const session = await getSessionWithBook(sessionId);
        const events = await chatGraph.stream(
          { sessionId, bookId: session.bookId, userMessage: content },
          { configurable: { thread_id: sessionId }, streamMode: ["updates", "messages"] }
        );

        for await (const [mode, payload] of events) {
          if (mode === "messages") {
            send("token", { content: payload.content });
          } else if (mode === "updates") {
            const [node, delta] = Object.entries(payload)[0];
            send("status", { node, phase: "end", details: pickProgressFields(delta) });
            if (node === "extract_ideas" && delta.newIdeaNodes?.length) {
              send("graph", { sessionId, nodes: delta.newIdeaNodes, edges: delta.newIdeaEdges ?? [] });
            }
            if (node === "update_memory" && delta.structuredMemory) {
              send("memory", delta.structuredMemory);
            }
          }
        }

        send("done", {});
      } catch (err) {
        send("error", { code: "CHAT_FAILED", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
```

## POST `/api/books/upload`

Multipart form upload. Saves to object storage, creates a `books` row with `status: 'uploading'`, kicks off the ingestion job, returns the book ID immediately.

```ts
// Response
{ bookId: string; status: "uploading" }
```

Client then opens an SSE connection to `/api/books/:id/status` for progress updates.

## GET `/api/books/:id/status`

SSE stream of ingestion progress.

```ts
// Events
event: status   data: { node: "parse" | "chunk" | ...; phase: "start" | "end" | "error" }
event: stats    data: { entitiesFound, relationshipsFound, themesFound, chunksProcessed, costCents }
event: error    data: { code, message }
event: done     data: { bookId, status: "ready" | "error" }
```

If the user navigates away and comes back, opening the SSE connection again resumes from the current state — server reads the latest LangGraph checkpoint and emits a synthetic "current state" status before continuing live.

## GET `/api/books/:id/graph`

Returns the KG. Paginated because large books have thousands of entities.

```ts
// Query: ?cursor=<id>&limit=200&type=Entity&minScore=0.0
// Response:
{
  nodes: Array<{ id, type, name, properties }>,
  edges: Array<{ source, target, type, properties }>,
  cursor: string | null,
  total: number,
}
```

For the visualization, the client requests in batches and progressively populates Sigma. The initial 200 entities by `importanceScore` are enough for a first paint.

## GET `/api/sessions/:id/idea-graph`

Returns the chat idea graph + cross-graph refs.

```ts
// Response
{
  nodes: IdeaNode[],
  edges: IdeaEdge[],
  crossRefs: Array<{
    chatNodeId: string,
    bookEntity: { id, name, type, description, bookId },
  }>,
}
```

Cross-refs are pre-joined server-side so the client doesn't have to query two APIs.

## Auth

Every route except `/api/auth/*` requires a valid session. Auth.js handles it; the route handlers just call `await getServerSession()` and 401 if absent.

## Rate limiting

Sensible defaults:
- Upload: 10 / hour / user
- Chat send: 60 / hour / user
- Book delete: 30 / day / user

Use `@upstash/ratelimit` or your own Postgres-backed counter. Don't go overboard — for a portfolio project, sensible per-IP limits are enough.

## Error envelope

Every non-streaming endpoint that errors returns:

```ts
{ error: { code: string, message: string, details?: unknown } }
```

Stable codes:
- `UNAUTHORIZED` — 401
- `NOT_FOUND` — 404
- `RATE_LIMITED` — 429
- `LLM_FAILED` — 502 from a provider
- `GRAPH_FAILED` — 502 from FalkorDB
- `VALIDATION_ERROR` — 400, body fails zod parse
- `INTERNAL_ERROR` — 500

Returned as JSON with appropriate HTTP status. Client uses this to localize messages.

## Client hooks pattern

The UI uses TanStack Query for non-streaming reads and a hand-rolled SSE hook for streams.

```ts
// hooks/useChatStream.ts
export function useChatStream(sessionId: string) {
  const [tokens, setTokens] = useState<string>("");
  const [status, setStatus] = useState<NodeStatus[]>([]);
  const [done, setDone] = useState(false);

  const send = useCallback(async (content: string) => {
    setTokens(""); setStatus([]); setDone(false);
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, content }),
    });
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += value;
      const events = parseSse(buffer);
      buffer = events.remaining;
      for (const e of events.parsed) handleEvent(e, { setTokens, setStatus, setDone });
    }
  }, [sessionId]);

  return { send, tokens, status, done };
}
```

(Standard pattern — write it once in a util module, reuse for the ingestion stream too.)

## What I'd say in an interview

"The API is split into normal REST for state changes and SSE for everything streaming. Two streams: ingestion progress and chat. Both use the same envelope schema, so the client only needs one parser. I leaned on Next.js Route Handlers to keep the deploy story simple — same process serves the web app and the API."
