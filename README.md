# Alvorada Property Research System

A full-stack real estate research platform built as a study project to explore **AI-driven agentic workflows**, **GraphRAG**, and **structured LLM output** in a real-world domain.

The system lets users catalog commercial properties, attach free-text notes, and then leverage three distinct AI pipelines: **feature extraction** (notes to structured data), **property ranking** (natural-language requirements to scored results), and **similarity search** (knowledge-graph traversal with LLM explanations).

[**Watch the demo video**](https://drive.google.com/file/d/1K2ZUQOF_UxYK0jvEG5vkb_dRWz1vV_1X/view?usp=sharing)

---

## Usage Example

A typical workflow from adding a property to getting AI-powered results.

### Step 1 &mdash; Create a Property

Navigate to `/properties/create` and enter a name and address. The backend auto-geocodes the address via Nominatim and stores the coordinates.

### Step 2 &mdash; Add Notes

Open the property detail page and switch to the **Notes** tab. Add free-text observations about the property:

> "Three-story building near the 4th Street subway station. Ground floor has a large open area, could work as retail or a coworking space. Has a freight elevator and 10-car parking lot in the back. Condition is decent but the second floor needs new flooring. Estimated capacity around 120 people."

### Step 3 &mdash; Extract Features (AI Pipeline 1)

Switch to the **Features** tab and click **Extract Features**. The system collects all notes, sends them to the LLM with a Zod schema, and gets back structured data:

```
near_subway:        true
parking_available:  true
has_elevator:       true
needs_renovation:   true
estimated_capacity: 120
floor_level:        3
condition_rating:   3
recommended_use:    "retail"
amenities:          ["freight elevator", "parking lot"]
confidence_score:   0.87
```

These features are now queryable in the database and feed into the other two pipelines.

### Step 4 &mdash; Rank Properties (AI Pipeline 2)

Go to the **Scoring** page (`/scoring`) and type a natural-language requirement:

> "Office space for 20-30 people near the subway with parking, modern condition preferred"

Click **Score All Properties**. The UI shows a real-time pipeline stepper as each LangGraph node executes:

```
[1] Parse Requirements     ✓  (NL → structured criteria via LLM)
[2] Build Ranking Query    ✓  (split into hard filters + soft preferences)
[3] Validate Query         ✓  (type-check, bounds-correct)
[4] Execute Ranking        ✓  (SQL query + in-memory preference matching)
[5] Generate Response      ✓  (LLM scores 0-10 with explanations)
```

Results appear as scored cards with strengths, weaknesses, and follow-up questions.

### Step 5 &mdash; Find Similar Properties (AI Pipeline 3)

On any property detail page, switch to the **Similar** tab and click **Find Similar Properties**. The system traverses the Neo4j knowledge graph to find properties sharing neighborhoods, landmarks, amenities, and use types:

```
[1] Fetch Property         ✓  (PostgreSQL + Neo4j concepts)
[2] Traverse Graph         ✓  (Cypher: shared concept weighted scoring)
[3] Score Similarity       ✓  (normalize 0-100%)
[4] Generate Explanation   ✓  (LLM writes per-property explanations)
```

Each result shows a similarity percentage, shared concept badges (e.g. "Downtown", "near: Central Station", "parking"), and an LLM-written explanation of why the properties are similar.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | **Fastify 5** &middot; TypeScript &middot; Drizzle ORM |
| Frontend | **Vue 3** &middot; Pinia &middot; Vue Router &middot; Tailwind CSS 4 &middot; Leaflet |
| AI Orchestration | **LangGraph** &middot; LangChain &middot; Zod structured output |
| LLM | **OpenRouter API** (default: `google/gemini-2.0-flash-001`) |
| Primary DB | **PostgreSQL 16** + PostGIS 3.4 |
| Graph DB | **Neo4j 5** Community (optional &mdash; enables similarity search) |
| Geocoding | Nominatim (OpenStreetMap) |
| Infrastructure | Docker Compose &middot; Multi-stage Dockerfile (Node 22 Alpine) |

---

## Architecture Overview

```
                         ┌─────────────────────────┐
                         │   Vue 3 SPA (:5173)     │
                         │  Pinia · Vue Router      │
                         │  Tailwind · Leaflet      │
                         └───────────┬─────────────┘
                                     │ Axios /api
                                     ▼
                         ┌─────────────────────────┐
                         │   Fastify Server (:3000) │
                         │      TypeScript          │
                         ├─────────┬───────┬────────┤
                         │  CRUD   │ Notes │   AI   │
                         │ Routes  │ Routes│ Routes │
                         └────┬────┴───┬───┴───┬────┘
                              │        │       │
                    ┌─────────▼────────▼─┐     │
                    │  Drizzle ORM       │     │
                    │  PostgreSQL 16     │     │
                    │  + PostGIS 3.4     │     │
                    └────────────────────┘     │
                                               │
          ┌────────────────────────────────────┼──────────────────────┐
          │                                    │                      │
          ▼                                    ▼                      ▼
 ┌──────────────────┐            ┌──────────────────┐    ┌──────────────────┐
 │ Feature          │            │ Ranking           │    │ Similarity       │
 │ Extraction       │            │ Graph             │    │ Graph            │
 │ (LLM + Zod)     │            │ (5-node LangGraph)│    │ (4-node LangGraph│
 └──────────────────┘            └──────────────────┘    │ + Neo4j)         │
                                                          └──────────────────┘
```

---

## AI Pipelines (Deep Dive)

The core learning focus of this project. Three independent AI pipelines, each using different techniques.

### 1. Feature Extraction &mdash; Notes to Structured Data

Transforms free-text property notes into structured, queryable features using **LLM structured output with Zod validation**.

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────┐     ┌──────────────┐
│ User adds    │────▶│ Collect all      │────▶│ LLM + Zod Schema  │────▶│ Upsert to    │
│ notes to a   │     │ notes for the    │     │ (structured output)│     │ property_    │
│ property     │     │ property         │     │                   │     │ features     │
└─────────────┘     └──────────────────┘     └───────────────────┘     └──────────────┘
```

**What it extracts:**

| Field | Type | Example |
|-------|------|---------|
| `near_subway` | boolean | `true` |
| `needs_renovation` | boolean | `false` |
| `parking_available` | boolean | `true` |
| `has_elevator` | boolean | `true` |
| `estimated_capacity_people` | integer | `250` |
| `floor_level` | integer | `3` |
| `condition_rating` | integer (1-5) | `4` |
| `recommended_use` | string | `"office"` |
| `amenities` | string[] | `["lobby", "gym", "parking"]` |
| `confidence_score` | float (0-1) | `0.85` |

**Key technique:** `ChatOpenAI.withStructuredOutput(ZodSchema)` forces the LLM to return valid, typed JSON. No regex parsing, no hope-based extraction &mdash; Zod validates every field at runtime.

---

### 2. Property Ranking &mdash; LangGraph Agentic Pipeline

A **5-node LangGraph state machine** that takes natural-language requirements and returns scored, explained results. This is the most complex AI flow in the project.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LangGraph Ranking Pipeline                          │
│                                                                             │
│  "I need a large office space near the subway with parking"                 │
│                              │                                              │
│                              ▼                                              │
│                 ┌─────────────────────────┐                                 │
│            ┌───▶│ 1. Parse Requirements   │  NL text → structured criteria  │
│            │    │    (LLM + Zod)          │  via LLM with structured output │
│            │    └────────────┬────────────┘                                 │
│            │                 │ ParsedCriteria                               │
│            │                 ▼                                              │
│            │    ┌─────────────────────────┐                                 │
│            │    │ 2. Build Ranking Query  │  Split criteria into:           │
│  error     │    │    (deterministic)      │  • hard filters (WHERE clauses) │
│  short-    │    └────────────┬────────────┘  • soft preferences (in-memory) │
│  circuit   │                 │ RankingQuery                                 │
│  to step   │                 ▼                                              │
│  5         │    ┌─────────────────────────┐                                 │
│            │    │ 3. Validate Query       │  Type-check fields, bounds,     │
│            │    │    (deterministic)      │  auto-correct invalid values    │
│            │    └────────────┬────────────┘                                 │
│            │                 │ ValidatedQuery                               │
│            │                 ▼                                              │
│            │    ┌─────────────────────────┐                                 │
│            ├───▶│ 4. Execute Ranking      │  Drizzle query → candidates     │
│            │    │    (DB + in-memory)     │  Count matched preferences      │
│            │    └────────────┬────────────┘  Sort by match_count DESC       │
│            │                 │ RankedCandidates                             │
│            │                 ▼                                              │
│            │    ┌─────────────────────────┐                                 │
│            └───▶│ 5. Generate Response    │  LLM scores 0-10 per property  │
│                 │    (LLM)               │  + strengths, weaknesses,       │
│                 └────────────┬────────────┘  follow-up questions, summary  │
│                              │                                              │
│                              ▼                                              │
│                   ScoredProperty[] + answer + followUpQuestions              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- **Dual-path filtering** &mdash; hard filters become SQL WHERE clauses (fast DB-level filtering), soft preferences are counted in-memory (flexible fuzzy matching including amenity substring matching)
- **Conditional routing** &mdash; errors at any node short-circuit to `generateResponse`, which returns a graceful error message instead of crashing
- **LangGraph state** &mdash; typed via `Annotation.Root`, each node reads from and writes to a shared state object
- **SSE streaming** &mdash; the `/api/ai/score/stream` endpoint uses Fastify's `reply.hijack()` to emit real-time `node_complete` events as each graph step finishes

---

### 3. Similarity Search &mdash; GraphRAG with Neo4j

A **4-node LangGraph pipeline** that finds similar properties using **knowledge graph traversal** rather than text similarity. This is the GraphRAG component.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LangGraph Similarity Pipeline                         │
│                                                                             │
│  Property #42 → "Find similar properties"                                   │
│                              │                                              │
│                              ▼                                              │
│                 ┌─────────────────────────┐                                 │
│                 │ 1. Fetch Property       │  PostgreSQL: property data       │
│                 │    (DB + Neo4j)         │  Neo4j: concept relationships    │
│                 └────────────┬────────────┘                                 │
│                              │ PropertyWithConcepts                         │
│                              ▼                                              │
│                 ┌─────────────────────────┐                                 │
│                 │ 2. Traverse Graph       │  Cypher query: find properties   │
│                 │    (Neo4j)              │  sharing concepts, compute       │
│                 └────────────┬────────────┘  weighted similarity scores     │
│                              │ TraversalResult                              │
│                              ▼                                              │
│                 ┌─────────────────────────┐                                 │
│                 │ 3. Score Similarity     │  Normalize scores 0-100         │
│                 │    (deterministic)      │  Map concepts to labels          │
│                 └────────────┬────────────┘                                 │
│                              │ ScoredSimilarity[]                           │
│                              ▼                                              │
│                 ┌─────────────────────────┐                                 │
│                 │ 4. Generate Explanation │  Hydrate from PostgreSQL         │
│                 │    (LLM)               │  LLM writes per-property         │
│                 └────────────┬────────────┘  explanations + overall summary │
│                              │                                              │
│                              ▼                                              │
│                   SimilarProperty[] + summary                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Neo4j Knowledge Graph Schema

```
                    ┌──────────────┐
           ┌──IN──▶│ Neighborhood │  (Downtown, Midtown, Industrial Park...)
           │       └──────────────┘
           │
┌──────────┤       ┌──────────────┐
│ Property ├─NEAR─▶│  Landmark    │  (Central Station, City Park, Hospital...)
└──────────┤       └──────────────┘
           │
           │       ┌──────────────┐
           ├─HAS──▶│   Amenity    │  (lobby, gym, parking, loading_dock...)
           │       └──────────────┘
           │
           │       ┌──────────────┐
           └─SUIT─▶│  Use Type    │  (office, retail, warehouse, medical...)
                   └──────────────┘
```

**Weighted similarity scoring:**

| Concept Type | Weight | Rationale |
|-------------|--------|-----------|
| Neighborhood | 4x | Location is the strongest similarity signal |
| Landmark | 3x | Proximity to landmarks implies similar context |
| Amenity | 2x | Shared amenities suggest similar property class |
| Use Type | 1x | Same use type is a baseline match |

**Feature-aware graph seeding** &mdash; the Neo4j seeder reads extracted features to wire meaningful relationships:
- `nearSubway: true` &rarr; connects to transit landmarks
- `hasElevator + high capacity` &rarr; connects to commercial landmarks
- `conditionRating >= 4` &rarr; connects to premium neighborhoods
- `recommendedUse` &rarr; maps to affinity neighborhoods (office &rarr; Downtown, warehouse &rarr; Industrial Park)

---

## Streaming & Real-Time Progress

Both ranking and similarity pipelines support **Server-Sent Events (SSE)** for real-time UI updates.

```
Client                           Server (Fastify)
  │                                │
  │  POST /api/ai/score/stream     │
  │───────────────────────────────▶│
  │                                │  reply.hijack() → raw HTTP
  │  event: nodes                  │
  │  data: [{id,label}...]        │
  │◀───────────────────────────────│  Pipeline starts
  │                                │
  │  event: node_complete          │
  │  data: {node:"parseReq..."}   │
  │◀───────────────────────────────│  Step 1 done
  │                                │
  │  event: node_complete          │
  │  data: {node:"buildRan..."}   │
  │◀───────────────────────────────│  Step 2 done
  │        ...                     │
  │                                │
  │  event: result                 │
  │  data: {scored_properties...}  │
  │◀───────────────────────────────│  Final results
  │                                │
  │  event: done                   │
  │◀───────────────────────────────│  Stream closes
```

The Vue frontend renders a **pipeline stepper** that animates through each node in real time.

---

## Database Schema

```
┌─────────────────────┐       ┌─────────────────────┐
│     properties      │       │       notes          │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │◀──┐   │ id (PK)             │
│ name (unique)       │   └───│ property_id (FK)     │
│ address (unique)    │       │ note (text)          │
│ latitude            │       │ created_at           │
│ longitude           │       │ updated_at           │
│ extra_field (JSON)  │       └─────────────────────┘
│ created_at          │
│ updated_at          │       ┌─────────────────────┐
└─────────────────────┘       │  property_features   │
         ▲                    ├─────────────────────┤
         │                    │ id (PK)             │
         └────────────────────│ property_id (FK, UQ)│
                              │ near_subway         │
                              │ needs_renovation    │
                              │ parking_available   │
                              │ has_elevator        │
                              │ estimated_capacity  │
                              │ floor_level         │
                              │ condition_rating    │
                              │ recommended_use     │
                              │ amenities (JSON[])  │
                              │ confidence_score    │
                              │ raw_ai_response     │
                              │ extracted_at        │
                              └─────────────────────┘
```

The `property_features` table is **entirely AI-generated** &mdash; populated by the feature extraction pipeline from free-text notes.

---

## Frontend

Built with **Vue 3 + Pinia + Tailwind CSS 4**.

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Properties Index | `/` | Searchable grid of property cards with feature badges |
| Property Create | `/properties/create` | Form with auto-geocoding on save |
| Property Show | `/properties/:id` | Tabbed view: Features, Similar Properties, Notes + mini map |
| Map View | `/map` | Full-page Leaflet map with marker clustering |
| Scoring View | `/scoring` | NL requirements input with real-time pipeline progress and scored results |

### Key UI Patterns

- **Pipeline stepper** &mdash; animated progress through LangGraph nodes during scoring/similarity
- **Confidence bars** &mdash; color-coded (green/amber/red) display of AI confidence scores
- **Feature badges** &mdash; subway, parking, elevator, use type shown on property cards
- **SSE event parsing** &mdash; custom protocol handling in Pinia stores for real-time updates
- **Glassmorphic cards** &mdash; `backdrop-blur` + semi-transparent backgrounds

---

## API Reference

### CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/properties` | List all (includes notes + features) |
| POST | `/api/properties` | Create with auto-geocoding |
| GET | `/api/properties/:id` | Single property detail |
| POST | `/api/properties/search` | Filter by feature criteria |
| POST | `/api/properties/by-ids` | Batch load by IDs |
| POST | `/api/notes` | Add note to property |
| GET | `/api/notes` | List notes (query: `property_id`) |

### AI Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/extract-features` | Run feature extraction from notes |
| POST | `/api/ai/score` | Rank properties (returns when complete) |
| POST | `/api/ai/score/stream` | Rank properties (SSE real-time progress) |
| POST | `/api/ai/similar` | Find similar properties |
| POST | `/api/ai/similar/stream` | Find similar (SSE real-time progress) |
| GET | `/api/properties/:id/features` | Get cached extracted features |

---

## Quick Start

### With Docker

```bash
cp .env.example .env          # Set LLM_API_KEY (OpenRouter)
docker compose up              # Fastify :3000 · Postgres :5432 · Neo4j :7474
```

### Local Development

```bash
cp .env.example .env          # Set DATABASE_URL, LLM_API_KEY
npm install
npm run db:migrate
npm run db:seed               # 275 US properties with notes and features
npm run neo4j:seed            # Optional: populate knowledge graph
npm run dev                   # Fastify :3000 + Vite :5173
```

Visit http://localhost:5173 (dev) or http://localhost:3000 (Docker/prod).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LLM_API_KEY` | Yes | OpenRouter API key |
| `LLM_MODEL` | No | Default: `google/gemini-2.0-flash-001` |
| `NEO4J_URI` | No | e.g. `bolt://localhost:7687` &mdash; enables GraphRAG |
| `NEO4J_PASSWORD` | No | Neo4j password |
| `PORT` | No | Server port (default 3000) |

---

## npm Scripts

```bash
npm run dev             # Fastify + Vite concurrently
npm run dev:api         # Fastify only (:3000)
npm run dev:vite        # Vite only (:5173)
npm run build           # Vue SPA → dist/
npm run typecheck       # TypeScript validation (tsc --noEmit)
npm run db:generate     # Generate Drizzle migration from schema changes
npm run db:migrate      # Run pending migrations
npm run db:seed         # Seed 275 US properties
npm run neo4j:seed      # Seed Neo4j knowledge graph
```

---

## Project Structure

```
src/                          # Fastify backend (TypeScript)
  ├── server.ts               # App bootstrap
  ├── config.ts               # Environment config
  ├── db/
  │   ├── schema.ts           # Drizzle schema (3 tables)
  │   ├── client.ts           # PostgreSQL connection
  │   ├── seed.ts             # Property seeder
  │   └── neo4jSeeder.ts      # Knowledge graph seeder
  ├── routes/
  │   ├── propertyRoutes.ts   # CRUD + geocoding
  │   ├── noteRoutes.ts       # Note management
  │   └── ai.ts               # AI endpoints + SSE streaming
  ├── services/
  │   ├── llm.ts              # ChatOpenAI factory (OpenRouter)
  │   ├── openrouter.ts       # Raw LLM client with retry logic
  │   ├── featureExtraction.ts # Notes → structured features
  │   ├── propertyScoring.ts  # LLM-based property scoring
  │   ├── geolocation.ts      # Nominatim geocoding
  │   └── neo4jService.ts     # Neo4j driver + query helpers
  └── graph/
      ├── ranking/            # 5-node ranking pipeline
      │   ├── graph.ts        # LangGraph compilation + routing
      │   ├── state.ts        # RankingAnnotation (typed state)
      │   └── nodes.ts        # Node implementations
      └── similarity/         # 4-node similarity pipeline
          ├── graph.ts        # LangGraph compilation + routing
          ├── state.ts        # SimilarityAnnotation
          └── nodes.ts        # Node implementations

client/                       # Vue 3 SPA
  ├── app.js                  # Vue + Pinia + Router bootstrap
  ├── App.vue                 # Root layout + transitions
  ├── pages/
  │   ├── PropertiesIndex.vue # Property grid with search
  │   ├── PropertyCreate.vue  # Create form
  │   ├── PropertyShow.vue    # Detail tabs (Features, Similar, Notes)
  │   ├── MapView.vue         # Full-page Leaflet map
  │   └── ScoringView.vue     # AI ranking interface
  ├── components/
  │   ├── AppNavbar.vue       # Navigation bar
  │   ├── PropertyCard.vue    # Property summary card
  │   ├── PropertyForm.vue    # Create/edit form
  │   ├── FeatureCard.vue     # AI-extracted features display
  │   ├── ScoreCard.vue       # Scored property result
  │   ├── NoteForm.vue        # Add note form
  │   ├── NoteList.vue        # Note list display
  │   └── ...                 # EmptyState, LoadingSpinner, Toast
  ├── stores/
  │   ├── propertyStore.js    # Property CRUD + AI actions
  │   ├── scoringStore.js     # Ranking pipeline state + SSE
  │   └── mapStore.js         # Map UI state
  ├── composables/
  │   ├── useApi.js           # Generic HTTP request wrapper
  │   └── useToast.js         # Toast notification system
  ├── api/
  │   └── index.js            # Axios instance + interceptors
  └── router/
      └── index.js            # Route definitions (lazy-loaded)

drizzle/                      # Generated SQL migrations
```

---

## Key Patterns & Techniques

| Pattern | Where | Why |
|---------|-------|-----|
| **Zod structured output** | Feature extraction, requirement parsing | Forces LLM to return valid typed JSON &mdash; no regex parsing |
| **LangGraph state machines** | Ranking, Similarity | Typed state, conditional routing, error isolation per node |
| **Dual-path filtering** | Ranking pipeline | Hard filters in SQL (fast), soft preferences in-memory (flexible) |
| **GraphRAG** | Similarity pipeline | Knowledge graph traversal instead of text similarity |
| **Feature-aware graph seeding** | Neo4j seeder | AI-extracted features drive meaningful graph relationships |
| **SSE streaming** | AI endpoints | Real-time pipeline progress via `reply.hijack()` |
| **Exponential backoff** | OpenRouter client | Retries with 2^n second delays, auth errors fail immediately |
| **Lazy graph compilation** | LangGraph graphs | Graphs compile on first request, not at server startup |
| **Confidence tracking** | Feature extraction, scoring | 0-1 confidence scores flag uncertain AI outputs |

---

## Learning Goals

This project was built to explore:

1. **LangGraph** &mdash; Building multi-step agentic workflows with typed state, conditional routing, and error recovery
2. **Structured LLM output** &mdash; Using Zod schemas with LangChain's `withStructuredOutput()` to get reliable, typed data from LLMs
3. **GraphRAG** &mdash; Combining graph databases (Neo4j) with LLM-generated explanations for semantic similarity search
4. **Streaming AI pipelines** &mdash; Server-Sent Events for real-time progress through multi-step AI workflows
5. **Full-stack AI integration** &mdash; Connecting LLM capabilities end-to-end: Vue UI to Fastify API to LangGraph to LLM to database
