# 11 — Evaluation

How you prove Sapphire works. This file is what separates a portfolio project that *looks* impressive from one a senior engineer takes seriously. Build the eval harness alongside the system, not as an afterthought.

The short pitch for recruiters: **"Here's a number, here's how I got it, here's what happens when I turn the knobs."** Three benchmarks, all reproducible, all in the repo:

1. **Retrieval benchmark** — 30 Q/A pairs over a known book, four retrieval strategies compared
2. **Memory benchmark** — 100-turn synthetic conversation, can the system still recall turn 15 at turn 60?
3. **Contradiction benchmark** — does the idea graph correctly mark contradicting claims?

Each one outputs a JSON report and a Markdown summary. Put the Markdown summaries in the README.

---

## Benchmark 1 — Retrieval quality (the big one)

### Setup

Pick one or two books with rich, well-known content. Good choices:
- *Thinking, Fast and Slow* — lots of named concepts, clear cross-references, dense
- *Sapiens* — narrative + named entities, themes that span chapters
- A textbook in a domain you know well (e.g., *Designing Data-Intensive Applications*) — you'll catch wrong answers immediately

Hand-write **30 question/expected-answer pairs**. Mix the types deliberately:

| Type             | Count | Example                                                            |
| ---------------- | ----- | ------------------------------------------------------------------ |
| Direct fact      | 8     | "What is System 1 according to Kahneman?"                          |
| Multi-hop        | 8     | "How does loss aversion relate to the endowment effect?"           |
| Thematic         | 6     | "What's the book's overall stance on expert intuition?"            |
| Comparison       | 4     | "How do availability and representativeness heuristics differ?"    |
| Negative/absence | 2     | "Does Kahneman discuss reinforcement learning?" (expected: no)     |
| Adversarial      | 2     | Question phrased to mislead retrieval (e.g., wrong entity name)    |

Store as `evals/retrieval/qa-pairs.json`:

```json
[
  {
    "id": "fast-slow-001",
    "type": "direct",
    "question": "What is System 1 according to Kahneman?",
    "expected_answer": "System 1 is fast, automatic, intuitive thinking...",
    "expected_entities": ["System 1", "Daniel Kahneman"],
    "expected_chunks_contain": ["fast", "automatic", "intuitive"]
  }
]
```

### The four conditions

Run each question through four retrieval strategies:

1. **Naive RAG** — chunk vector search, top-k=5, no graph
2. **Low-level only** — entity vector search + 1-hop expand, no themes
3. **High-level only** — theme vector search + drilldown to chunks, no entity-level
4. **Full hybrid** — the system as designed (low + high + fused)

All four call the same Sonnet generation prompt. Only retrieval differs. This isolates the variable.

### Scoring

Two scores per answer:

**Groundedness (0–5)** — Does every claim in the answer trace to retrieved context?
**Completeness (0–5)** — Does the answer cover what the expected answer covers?

Use LLM-as-judge with Sonnet. Prompt sketch:

```
You are grading a Q&A system answer.

Question: {question}
Expected answer: {expected_answer}
System answer: {system_answer}
Retrieved context: {retrieved_context}

Score GROUNDEDNESS 0-5: For each claim in the system answer, can it be verified from the retrieved context? 5 = every claim is in context. 0 = the answer hallucinates.

Score COMPLETENESS 0-5: Does the system answer cover the same key points as the expected answer? 5 = covers all key points. 0 = misses everything important.

Return JSON: {"groundedness": int, "completeness": int, "groundedness_notes": str, "completeness_notes": str}
```

**Reduce judge variance** by running each judgement 3 times and taking the median. LLM judges drift; the median fixes it.

Also track:
- **Retrieval latency** (ms) per condition
- **Tokens retrieved** per condition (cost proxy)
- **Entity recall** — of the expected entities, how many appeared in the retrieved context?

### What good looks like

Rough targets (calibrate after a first run; these are aspirations, not promises):

| Condition       | Groundedness | Completeness | Latency  |
| --------------- | ------------ | ------------ | -------- |
| Naive RAG       | ~3.5         | ~2.8         | fastest  |
| Low-level only  | ~4.0         | ~3.2         | +30%     |
| High-level only | ~3.2         | ~3.5         | +20%     |
| **Full hybrid** | **~4.3**     | **~4.0**     | +50%     |

If the full hybrid doesn't win on both axes, something in the design is wrong — go back and check fusion, dedup, and the token budget. Don't fudge the numbers; the gap itself is the story.

### Output

`evals/retrieval/results-{date}.json` with per-question scores and aggregates.
`evals/retrieval/results-{date}.md` with a summary table — copy this into the README.

---

## Benchmark 2 — Memory & long-context recall

The whole point of the L0/L1/L2/L3 tier system is that the model can remember turn 15 when you're at turn 60. Prove it.

### Setup

Write **one 100-turn synthetic conversation** about a chosen book. Plant explicit recall hooks at known turns:

- **Turn 8**: User says "Let's call the protagonist's worldview 'Nominal Realism' for shorthand."
- **Turn 15**: User makes a specific claim: "I think the author conflates intuition with expertise."
- **Turn 22**: User decides: "We'll treat all of chapter 4 as the source of truth for this discussion."
- **Turn 34**: User asks a question that's deferred: "Remind me to come back to whether System 2 has free will."
- **Turn 50**: Topic switches deliberately to a different chapter for ~15 turns
- **Turn 67**: **Recall probe** — "What did we decide about chapter 4 being source of truth?"
- **Turn 73**: **Recall probe** — "What was the term we coined for the protagonist's worldview?"
- **Turn 88**: **Recall probe** — "Did we ever come back to the System 2 / free will question?"

Each recall probe has an expected answer that depends on something said many turns earlier — well past the L0 buffer, requiring L1 summaries and/or L2 semantic recall to work.

Store as `evals/memory/scripted-conversation.json` with turn index, role, content, and (for probes) `expected_recall`.

### Run it

Replay the conversation through the actual chat engine. After each turn, snapshot:
- L0 buffer contents (mini-rounds in active context)
- L1 summary chain (how many summaries, what they cover)
- L2 retrievals (which old summaries got pulled back in)
- L3 memory object (topics, decisions, open questions)

When you hit a recall probe, score the response:

- **Recall correctness (0–2)** — 0=missed, 1=partial, 2=correctly recalled
- **Source attribution** — did the system pull from L0, L1, L2, or L3? Log it.

### What good looks like

- All three recall probes scored ≥1, ideally 2
- The "coined term" probe (turn 73, ref turn 8) should hit via L2 semantic search — L1 summaries will have compressed the exact term out by then
- The "deferred question" probe should hit via L3 (it's in the open-questions list)
- The "source of truth" probe should hit via L1 (it's a recent-enough decision)

If everything routes through L0 or everything misses, the cascade is broken.

### Bonus: contradiction handling

Add turn 40: user contradicts what they said at turn 15. The L3 memory object should show the topic as `"contested"` and surface both views when the model is asked about it later. Score this as a separate probe.

---

## Benchmark 3 — Idea graph correctness

The chat idea graph is half the demo; it has to actually be right. Otherwise it's eye candy with errors.

### Setup

Use the same 100-turn conversation from Benchmark 2. Hand-label what *should* be in the graph:
- Expected `Claim` nodes (count + key ones)
- Expected `Question` nodes
- Expected `Decision` nodes
- Expected `Concept` nodes (the coined "Nominal Realism", etc.)
- Expected edges, especially: any `contradicts` edge, any `answers` edge

Store as `evals/idea-graph/expected.json`.

### Run it

After replaying the conversation, dump the actual chat idea graph and compare.

### Metrics

- **Node precision/recall** by type (out of expected Claim nodes, how many are in the graph, and how many graph Claim nodes are spurious?)
- **Edge precision/recall**, weighted toward the two edges that matter: `contradicts` and `answers`
- **Type-confusion matrix** — are Claims being miscategorised as Concepts, etc.?

### What good looks like

- ≥80% recall on Claim and Question nodes (the model misses some — that's OK, you can re-extract)
- ≥90% precision on edges (false edges are worse than missing ones; they corrupt the graph)
- 100% recall on the planted contradiction edge — if you miss this, the demo flops

---

## Running it all

Wire up `pnpm eval:retrieval`, `pnpm eval:memory`, `pnpm eval:idea-graph`, and `pnpm eval:all`.

Each command:
1. Loads its fixture file from `evals/`
2. Runs against a local Sapphire instance (or a deployed staging instance)
3. Writes JSON and Markdown reports to `evals/{name}/results-{ISO date}.{json,md}`
4. Prints a summary table to stdout

Commit the latest reports. Recruiters who actually open the repo will look at them.

## The README move

In your README, under a `## Evaluation` heading, paste:

- The retrieval results table (3 conditions vs. full hybrid)
- A one-paragraph "what this proves"
- A link to the full reports

Then add a short paragraph: *"Methodology, fixtures, and judge prompts are reproducible — run `pnpm eval:all`."*

That single section, with real numbers, makes the project look two orders of magnitude more serious. It's the difference between "side project" and "engineering work."

## A note on judges

LLM-as-judge isn't perfect. To keep it honest:
- Always run judges with a different model than the system under test if you can (Claude judges Claude is fine for self-consistency but spot-check with GPT-4 or a human pass on a 10% sample)
- Always run judges with temperature 0 *and* median-of-3 (kill drift)
- Always log the judge's reasoning, not just the score — you'll need it when you debug a regression
- For the 30 retrieval Q/A pairs, do a one-time human grading pass yourself as ground truth, and check the judge against it. If judge↔human agreement is below ~85%, your judge prompt needs work before the scores mean anything.

This is the part that separates "I have an eval" from "my eval is trustworthy." Recruiters who've built ML systems will know to ask.
