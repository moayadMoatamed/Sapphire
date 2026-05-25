# Sapphire — Design Brief

> A single file to be handed to a designer (human or AI) and have them produce a complete visual identity, UI library, and screen mockups. Self-contained. No need to read other Sapphire docs.

---

## 1. What is Sapphire?

Sapphire is a desktop-first web application where a user uploads PDFs of books, the system ingests them into a knowledge graph, and the user has long, persistent chats with an AI grounded in those books. As the user chats, a second graph — the **chat idea graph** — grows in real time, capturing the claims, questions, decisions, and concepts that surface in the conversation.

The user's primary modes are:
1. **Library** — browsing their uploaded books
2. **Read & ask** — sitting with one book, chatting with the AI about it, watching the idea graph grow
3. **Explore** — looking at either the book's knowledge graph or their own idea graph as standalone visualizations

It's a tool for **deep readers and serious thinkers**. Researchers, grad students, knowledge workers, autodidacts. The aesthetic must feel like a precision instrument, not a chat toy.

## 2. The visual brief in one sentence

> **Obsidian's seriousness, the New York Times' typography, Linear's interface discipline, and a jewel-cut color identity built around sapphire blue.**

Obsidian is the reference for "knowledge tool that respects the user." But Obsidian is visually plain — it leaves the design work to the user via themes. Sapphire ships *as* the theme: opinionated, polished, finished.

## 3. Brand identity

### Name
**Sapphire** — chosen because:
- Conveys depth, clarity, and value
- The graph metaphor (facets, connections, refraction) lives naturally inside the name
- Single word, easy to pronounce, easy to own

### Personality
- **Sharp.** Sharp corners, sharp typography, sharp focus. Not soft, not friendly, not playful.
- **Quiet.** Restrained motion, restrained color, restrained voice. Confidence doesn't shout.
- **Deep.** Dark backgrounds, layered information density, rewards exploration.
- **Crafted.** Every interaction feels considered. No off-the-shelf widgets.

### Voice
- UI copy is **terse** — never "Click here to upload your first amazing book!"; just "Upload PDF".
- Errors are **dignified** — "Couldn't read that file." not "Oops! Something went wrong! 🙈"
- Empty states are **literary** — small, in serif, allowing space.

### What Sapphire is NOT
- Not a chatbot (no Gemini-style avatars, no "Hi! I'm your assistant!" framing)
- Not a SaaS dashboard (no gradients, no whimsical illustrations, no green checkmarks)
- Not an AI productivity app of the current generation (no purple, no neon, no shimmer)
- Not Notion (too soft, too rounded, too friendly)

## 4. Color system

### Primary — Sapphire ramp

Deep oceanic blue. The brand color. Cooler than royal blue, warmer than navy.

| Token            | Hex      | Usage                                          |
| ---------------- | -------- | ---------------------------------------------- |
| `sapphire-50`    | `#EEF3FB`| Body text on dark, max-contrast surfaces       |
| `sapphire-100`   | `#D5E1F2`| Strong text, hero headings on dark             |
| `sapphire-300`   | `#7FA1D4`| Default UI text on dark, icons                 |
| `sapphire-500`   | `#3E66B0`| Interactive (hover), focus rings, links        |
| `sapphire-700`   | `#1F3A78`| Primary brand color, primary buttons           |
| `sapphire-900`   | `#0E1E45`| Card backgrounds, raised surfaces              |
| `sapphire-950`   | `#070F23`| App background (the canvas)                    |

### Neutral — Ink ramp

A near-black with a faint blue undertone. Never pure gray.

| Token        | Hex      | Usage                                          |
| ------------ | -------- | ---------------------------------------------- |
| `ink-50`     | `#F5F6F8`| Light-mode background (later phase)            |
| `ink-100`    | `#E2E4EA`| Subtle borders on light                        |
| `ink-300`    | `#9DA3B0`| Muted text, secondary information              |
| `ink-500`    | `#5E6473`| Disabled, very muted                           |
| `ink-700`    | `#373B47`| Light-mode body text                           |
| `ink-900`    | `#171922`| Light-mode primary text                        |

### Accent — Gold

A single warm note. Used sparingly to mark emphasis, focus, and importance. Never decorative.

| Token        | Hex      | Usage                                          |
| ------------ | -------- | ---------------------------------------------- |
| `gold-400`   | `#E2B96A`| Highlights, active state, important markers    |
| `gold-500`   | `#C99A3F`| Emphasis text, key callouts                    |

### Semantic colors

Quiet versions only. Never the screaming reds and greens of dashboards.

| Token            | Hex      | Usage                  |
| ---------------- | -------- | ---------------------- |
| `success-500`    | `#6B9F7E`| Confirmation, healthy  |
| `warning-500`    | `#C99A3F`| Same as gold-500       |
| `danger-500`     | `#B86B6B`| Errors, contradictions |

That's it. **Three blues, two grays, one gold, three muted semantics.** Resist adding more.

### The forbidden colors

- No pure white (`#FFFFFF`) — use `sapphire-50`
- No pure black (`#000000`) — use `sapphire-950`
- No bright blues like `#007AFF` or `#3B82F6`
- No purple. None.
- No neon, no fluorescent, no Y2K
- No gradients except the one specified hero vignette

## 5. Typography

### Faces

```
Serif    →  Source Serif 4    (Adobe, free, OFL)
Sans     →  Inter             (Rasmus Andersson, free, OFL)
Mono     →  JetBrains Mono    (JetBrains, free, OFL)
```

All three are free, open, and battle-tested. No custom fonts.

### Scale

A modular scale, base 16px, ratio ~1.2.

| Token            | Size   | Line height | Weight | Usage                       |
| ---------------- | ------ | ----------- | ------ | --------------------------- |
| `text-display`   | 48px   | 56px        | 400    | Hero page heading (rare)    |
| `text-h1`        | 32px   | 40px        | 500    | Page titles                 |
| `text-h2`        | 24px   | 32px        | 500    | Section headings            |
| `text-h3`        | 18px   | 28px        | 600    | Sub-sections                |
| `text-body`      | 15px   | 24px        | 400    | UI body text                |
| `text-reading`   | 17px   | 28px        | 400    | Chat & book reading surfaces|
| `text-small`     | 13px   | 20px        | 400    | Captions, labels            |
| `text-tiny`      | 11px   | 16px        | 500    | Tags, badges, uppercased    |

### Pairing rules

- **Reading surfaces** (chat bubbles, book reader, document content): serif
- **UI chrome** (buttons, menus, sidebars, headers): sans
- **Code, IDs, timestamps**: mono

Never mix within a single sentence or label. The split must feel intentional.

### Specific decisions

- Chat user messages: serif, 17px, sapphire-50
- Chat AI messages: serif, 17px, sapphire-50, with a `border-l-2 border-sapphire-500/60` 4px from the left edge
- Buttons: sans, 14px, weight 500, no uppercasing
- Sidebar items: sans, 13px, weight 500
- Section labels above content groups: sans, 11px, uppercased, letter-spacing +0.05em, color `ink-300`
- Page titles: sans, 32px, weight 500 (not bold — bold reads aggressive here)

## 6. Spacing & layout

### Base unit
**4px.** Everything is a multiple of 4. (8, 12, 16, 24, 32, 48, 64...)

### Container widths
- Reading column max-width: 680px (the NYT comfortable reading measure)
- Sidebar default: 280px
- Inspector / right rail: 320px
- App max-width: none — Sapphire uses available width on wide screens

### The hero layout

The flagship screen is the **chat + idea graph** split:

```
┌─ Top bar (48px) ────────────────────────────────────────┐
│  ◐ Sapphire   📚 Library   ⚙                            │
├──────────────┬──────────────────────┬───────────────────┤
│              │                      │                   │
│   Sidebar    │      Chat            │   Idea Graph      │
│   (280px)    │      (flex)          │   (flex, min 320) │
│              │                      │                   │
│   - Book A   │   [serif messages]   │   ◯─◯             │
│   - Book B   │   [serif messages]   │    │              │
│   - Book C   │   ────────           │    ◯───◯          │
│   ───        │   [input bar]        │                   │
│   + New      │                      │                   │
│              │                      │                   │
└──────────────┴──────────────────────┴───────────────────┘
```

Chat:graph ratio default 62:38. Resizable via drag handle. Minimum widths enforced.

On narrower screens (<1100px), the graph collapses to a tab the user can toggle.

### The library layout

A dense card grid:

```
┌─ Library ──────────────────────────────────────┐
│                                                │
│   📕 Book A      📗 Book B      📘 Book C      │
│   author/year    author/year    author/year    │
│   ▓▓▓▓▓░░░       ▓▓▓▓▓▓▓▓░      ▓▓▓░░░░░       │ ← ingestion progress
│                                                │
│   📕 Book D      📕 Book E      ＋ Upload      │
│                                                │
└────────────────────────────────────────────────┘
```

3 columns on desktop, 2 on tablet, 1 on mobile. Card aspect ratio 3:4 (book-like). Cover thumbnails when available, falling back to a generated cover using the book title set in serif on a `sapphire-900` background with a faint texture.

### The book reader layout

```
┌─ Book reader + KG split ───────────────────────┐
│  Reader (60%)         │   Book KG (40%)        │
│  serif body, 17/28    │   Sigma.js graph       │
│  chapter nav          │   filter chips         │
│                       │   selected node panel  │
└────────────────────────────────────────────────┘
```

The reader pane is the **only** place the serif reading column is centered (max-width 680px) inside a wider pane. Everywhere else, content fills available space.

## 7. Components

### Buttons

**Primary** — used once per screen (the main action)
- Bg: `sapphire-700`, hover `sapphire-500`
- Text: `sapphire-50`, weight 500
- Padding: 8px 16px
- Radius: 6px
- No shadow, no gradient

**Secondary** — frequent actions
- Bg: transparent
- Border: `1px solid sapphire-700/60`, hover `sapphire-500`
- Text: `sapphire-100`

**Ghost** — tertiary, inline
- No bg, no border
- Text: `ink-300`, hover `sapphire-100`

**Icon-only**
- 32×32px hit area, 16px icon
- Same color rules as Ghost

**Destructive**
- Bg: transparent
- Border: `1px solid danger-500/60`
- Text: `danger-500`

No "extra small" or "extra large" sizes. One size, used consistently.

### Inputs

- Background: `sapphire-900/60`
- Border: `1px solid sapphire-700/40`
- Focus: border `sapphire-500`, no glow, no ring beyond the border color change
- Radius: 6px
- Padding: 10px 12px
- Placeholder: `ink-300`

### Cards

- Background: `sapphire-900`
- Border: `1px solid sapphire-700/40`
- Radius: 4px (sharper than buttons — deliberate)
- Padding: 16px or 24px
- Hover lift: shift up 2px on 180ms transition, NO shadow

### Dialogs / modals

- Background: `sapphire-900`
- Border: `1px solid sapphire-700/60`
- Backdrop: `sapphire-950/80` with a 8px backdrop-blur
- Max width: 520px for confirm dialogs, 720px for content dialogs
- Close button: top-right, 16px, ghost style

### Toasts

- Position: bottom-right
- Background: `sapphire-900` border `sapphire-700`
- Max width: 360px
- Duration: 4s for info, 6s for errors, manual dismiss for actions
- No icons (or one 16px Lucide icon at most)

### Sidebar nav

- Width: 280px
- Background: same as app bg (`sapphire-950`)
- Border-right: `1px solid sapphire-800/40`
- Item: 32px tall, 12px horizontal padding, sans 13px
- Active item: bg `sapphire-900`, gold-400 left bar 2px wide
- Hover: bg `sapphire-900/50`

## 8. Graph visualization

This is **the** visual centerpiece. Both the book KG and the chat idea graph use the same visual language; only the node types differ.

### Canvas
- Background: same as app bg (`sapphire-950`) — the graph dissolves into the page
- No grid, no axes, no chrome
- Full bleed inside its pane

### Node visual

| Type        | Fill              | Border            | Shape   | Notes                                |
| ----------- | ----------------- | ----------------- | ------- | ------------------------------------ |
| Entity      | `sapphire-300`    | none              | circle  | Book KG                              |
| Theme       | `gold-400`        | none              | circle  | Book KG, larger than entities        |
| Claim       | `sapphire-100`    | none              | circle  | Chat idea graph                      |
| Question    | transparent       | `sapphire-100`, dashed | circle | Chat idea graph                  |
| Decision    | `gold-400`        | none              | square (rotated 45°, "diamond") | Chat idea graph |
| Concept     | `ink-100`         | none              | circle  | Chat idea graph                      |

Node size: log-scaled by mention count or by in-degree. Min 6px diameter, max 24px.

### Edge visual

- Color: `ink-500` at 40% opacity (very muted)
- Width: 1px default
- Special edges:
  - `contradicts` → `danger-500` at 60% opacity, 1.5px
  - `supports` → `success-500` at 60% opacity, 1px
  - `derived-from` → dashed `sapphire-500` 40% opacity
- No arrowheads except on directional edges (`contradicts`, `supports`, `answers`)
- Arrowheads: small, 4px, matching edge color

### Labels

- Font: sans 11px, weight 500
- Color: `sapphire-100`
- Position: above the node, centered
- Hidden by default at >40 visible nodes; appear on hover and for selected node + neighbors

### Interaction states

- **Hover node**: gold-400 1px outer ring, label appears, neighbors keep full opacity, all others fade to 30% opacity
- **Click node**: selection persists, inspector panel slides in from the right showing details
- **Selected + hover other**: original selection stays, hovered node also highlights
- **Empty graph**: a single faint `sapphire-700/40` thin ring centered, with the message "The idea graph builds as you chat" in sans 13px ink-300

### Layout

ForceAtlas2 layout via `graphology-layout-forceatlas2`. Settle in ~600 frames, then stop. Manual repositioning persists.

### Time-slider (chat idea graph only)

A horizontal slider at the bottom of the graph pane:
- Range: turn 1 → current turn
- Default: at current
- Dragging back fades in / out nodes and edges based on their `turn` property
- Animation when "playing": 800ms ease-in-out per turn transition
- Player controls: play, pause, jump to start/end — minimal, Lucide icons

This is **the** demo move. Make sure it works flawlessly.

## 9. Motion

### The default
```
180ms cubic-bezier(0.2, 0.0, 0.0, 1.0)
```
This is the only easing the app uses for state changes, hovers, transitions, fades, slides.

### Exceptions
- **Time-slider playback in the chat graph**: 800ms ease-in-out per turn
- **Page-level transitions**: 240ms ease-out, fade only, no slide
- **Toast enter**: 220ms slide-up + fade
- **Streaming text in chat**: characters appear without animation — text just types. No fade-in per token.

### What's forbidden
- Bounce / spring animations
- Long fades (>250ms outside of the time-slider)
- Loading skeletons that pulse (use a step-list instead for the ingestion run)
- Scroll-jacking on landing/marketing pages
- Parallax of any kind
- Animated gradients

## 10. Iconography

**Lucide React.** Single source. Default 16px, occasionally 20px.

Always `text-sapphire-300` by default. Active or emphasis state: `text-gold-400`. Destructive: `text-danger-500`.

Recurring icons:
- Book — `book-open`
- Library — `library`
- Chat — `messages-square`
- Graph — `share-2`
- Add — `plus`
- Settings — `settings-2`
- Search — `search`
- Upload — `upload`
- Inspector toggle — `panel-right`
- Time slider play — `play`, `pause`

## 11. The hero / marketing surface

A single signed-out landing page. Same visual language, dialed up.

### Above-the-fold composition
- App bg `sapphire-950` with a subtle radial gradient centered top-third: `sapphire-700` at 0% alpha center, fading to `sapphire-950` at 70%. The **only** gradient in the app.
- Headline: serif display, 48px, `sapphire-50`. Centered. One line.
  - Suggested headline: **"Read deeper. Think clearer."** (subject to taste)
- Subhead: sans 17px, `sapphire-300`, 2 lines max
  - Suggested: "Sapphire turns books into knowledge graphs and lets you have long, grounded conversations with them."
- Primary CTA: sapphire-700 button, "Get started"
- Below: a single screenshot of the chat+graph hero layout, with a subtle 1px `sapphire-700/40` border, no frame, no laptop mockup

### Three small feature blocks below the fold
Three columns, terse copy, no illustrations. Each has a one-word title (sans h3) and a 2-sentence description (sans body).

### Footer
- One line. Sapphire wordmark left, `© 2026` and a Privacy link on the right.

## 12. Logo / wordmark

### Wordmark
**"Sapphire"** set in Source Serif 4, weight 500, letter-spacing -0.01em, in `sapphire-100`.

### Mark (optional, for favicon and tight spaces)
A geometric **cut gemstone** — a hexagonal outline with two internal lines suggesting facets. Outline only, 1.5px stroke, `sapphire-300`.

Avoid:
- Generic "S" monograms
- Glyph-style logos that look like a thousand other apps
- 3D rendered gems
- Faceted brilliance / sparkle effects

The mark should feel like a technical drawing, not a marketing render.

## 13. Light mode (later phase)

When light mode lands:
- Background: `ink-50`
- Surface: `sapphire-50`
- Primary text: `sapphire-950`
- Brand: `sapphire-700` stays
- Borders: `ink-100`
- Graph background: `sapphire-50`
- Node fills: invert ramp (entity `sapphire-700`, theme `gold-500`, etc.)

**Do not ship light mode until it's been reviewed against this brief.** Light mode is where Sapphire is most likely to drift into generic territory. Be ruthless.

## 14. Accessibility

- All text/background combinations must meet WCAG AA contrast (4.5:1 for body, 3:1 for large text). Verify with a contrast checker; the sapphire palette as specified meets this, but if you derive new colors, test them.
- Focus indicators: 2px `sapphire-500` outline offset 2px, always visible on keyboard nav
- Reduce motion media query: replace all 180ms transitions with `none`, skip the time-slider animation
- Graph viz: provide a list-view fallback for the chat idea graph for screen reader users
- Color is never the only signal — contradiction edges should also be dashed or carry an icon, not just red

## 15. Deliverables expected from this brief

A designer working from this brief should produce:

1. **Token sheet** — exportable Tailwind config + CSS variables
2. **Component sheet** — Figma or Storybook showing buttons, inputs, cards, dialogs, toasts, sidebar items, chat bubbles
3. **Three screens, fully designed:**
   - Library (signed-in home)
   - Chat + Idea Graph (the hero)
   - Book reader + Book KG
4. **One marketing landing page**
5. **Favicon + wordmark** in SVG
6. **Empty states** for library, chat, graph, book reader
7. **Loading state for the ingestion run** — the step list with active/done/error per step
8. **One short motion spec** describing the time-slider replay animation

## 16. North-star references (for mood, not for copying)

- **Obsidian** — knowledge tool seriousness, graph view as first-class
- **Linear** — interface discipline, restraint, dark mode done right
- **Are.na** — taste in typography and white space (in their case, dark space)
- **iA Writer** — reverence for the reading surface
- **The New York Times articles** — serif reading column quality
- **Tana** — dense information design without becoming cluttered

What Sapphire is NOT trying to look like:
- ChatGPT or Claude.ai (too chat-toy)
- Notion (too soft)
- Perplexity (too neon)
- Roam Research (too academic-rough)
- Mem.ai (too sparkly)
- Pretty much any 2024–2026 "AI app" landing page

---

## A final note for the designer

Sapphire's user is someone who has read a lot, thinks carefully, and is allergic to interfaces that condescend. They've grown tired of AI products that look like toys. They want a tool that respects how seriously they take their reading.

Every design decision should pass one test: **"Would this make a reader who finishes 30 books a year want to use it?"** If the answer is "this looks like another GPT wrapper," go back.

Make it sharp. Make it deep. Make it earned.
