# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Alvorada Property Research System** — a full-stack real estate research and AI-powered property matching platform:

- **Fastify backend** (TypeScript) — REST API, Drizzle ORM, PostgreSQL
- **Vue 3 + Vite SPA** — Pinia stores, Vue Router, Tailwind CSS 4, Leaflet maps
- **LangGraph** — Agentic workflow for property ranking and similarity search
- **Databases** — PostgreSQL 16 with PostGIS 3.4 (primary), Neo4j 5 (optional knowledge graph)
- **LLM** — OpenRouter API (default: `google/gemini-2.0-flash-001`)

## Commands

### Running the full stack

```bash
docker compose up          # Start all services (Fastify :3000, Postgres :5432, Neo4j :7474)
docker compose down
```

Before first run, copy `.env.example` to `.env` and set `LLM_API_KEY` (OpenRouter key).

### Local development

```bash
npm install                # Install all dependencies
npm run dev                # Concurrently: Fastify API (:3000) + Vite dev server (:5173)
```

Individual servers:
```bash
npm run dev:api            # Fastify on :3000
npm run dev:vite           # Vite dev server on :5173 (proxies /api to :3000)
```

### Building

```bash
npm run build              # Compile Vue SPA (Vite → dist/)
```

### Database

```bash
npm run db:generate        # Generate Drizzle migration from schema changes
npm run db:migrate         # Run pending migrations
npm run db:seed            # Seed 275 US properties with notes and features
```

### Type checking

```bash
npm run typecheck          # TypeScript validation (tsc --noEmit)
```

## Architecture

### Request Flow

```
Vue SPA (Axios → /api)
    └─► Fastify Server (:3000)
            ├─ propertyRoutes → Drizzle → PostgreSQL (CRUD + geocoding)
            ├─ noteRoutes → Drizzle → PostgreSQL
            └─ aiRoutes
                    ├─ Feature extraction → OpenRouter LLM → property_features table
                    ├─ Ranking → LangGraph ranking graph (in-process)
                    └─ Similarity → LangGraph similarity graph (Neo4j + in-process)
```

### Database Schema (Drizzle)

Defined in `src/db/schema.ts`:

**`properties`** — `id`, `name` (unique), `address` (unique), `latitude`, `longitude`, `extra_field` (JSON), timestamps

**`notes`** — `id`, `property_id` (FK → properties), `note` (text), timestamps

**`property_features`** — `id`, `property_id` (FK, unique), booleans (`near_subway`, `needs_renovation`, `parking_available`, `has_elevator`), numerics (`estimated_capacity_people`, `floor_level`, `condition_rating`), string (`recommended_use`), array (`amenities` JSON), AI metadata (`confidence_score`, `raw_ai_response`, `extracted_at`), timestamps

### Key Services

| Service | File | Responsibility |
|---|---|---|
| Geolocation | `src/services/geolocation.ts` | Forward/reverse geocoding via Nominatim |
| OpenRouter | `src/services/openrouter.ts` | LLM client with exponential backoff retries |
| Feature Extraction | `src/services/featureExtraction.ts` | Notes → structured PropertyFeature via LLM |
| Property Scoring | `src/services/propertyScoring.ts` | LLM-based property scoring (fallback) |
| LLM Factory | `src/services/llm.ts` | ChatOpenAI factory for LangGraph |
| Neo4j | `src/services/neo4jService.ts` | Neo4j driver + query helpers |

### LangGraph Graphs

**Ranking** (`src/graph/ranking/`):
1. `parseRequirementsNode` — NL requirements → structured criteria (Zod)
2. `buildRankingQueryNode` — criteria → filters + preferences
3. `validateQueryNode` — validate/correct query fields
4. `executeRankingNode` — Drizzle query → rank candidates by preference match count
5. `generateResponseNode` — LLM scores + explanation + follow-up questions

**Similarity** (`src/graph/similarity/`):
1. `fetchPropertyNode` — Drizzle + Neo4j concept nodes
2. `traverseGraphNode` — Neo4j graph traversal for similar properties
3. `scoreSimilarityNode` — weighted scoring
4. `generateExplanationNode` — LLM explanations + hydrate from Drizzle

**Neo4j** is optional. When `NEO4J_URI`/`NEO4J_PASSWORD` are set, the graph path activates.

### Frontend Structure

**Pages:** `PropertiesIndex`, `PropertyCreate`, `PropertyShow`, `MapView`, `ScoringView`

**Stores:** `propertyStore` (CRUD), `mapStore`, `scoringStore`

**API client:** `client/api/index.js` — Axios wrapper pointing to `/api`

**Vite aliases:** `@/` → `client/`

### API Routes

| Method | Path | Handler |
|---|---|---|
| GET | /api/properties | List all with notes + features |
| POST | /api/properties | Create with geocoding |
| GET | /api/properties/:id | Show with notes + features |
| POST | /api/properties/search | Search by feature criteria |
| POST | /api/properties/by-ids | Batch load by IDs |
| GET | /api/notes | List notes for property |
| POST | /api/notes | Add note |
| POST | /api/ai/extract-features | Extract features from notes |
| POST | /api/ai/score | Rank properties (LangGraph) |
| POST | /api/ai/score/stream | Rank with SSE progress |
| POST | /api/ai/similar | Find similar properties |
| GET | /api/properties/:id/features | Get extracted features |

### Environment Variables

See `.env.example`. Key vars:
- `DATABASE_URL` — PostgreSQL connection string
- `LLM_API_KEY` — OpenRouter API key
- `LLM_MODEL` — default `google/gemini-2.0-flash-001`
- `NEO4J_URI` + `NEO4J_PASSWORD` — optional, activates graph path
- `PORT` — server port (default 3000)

### Project Structure

```
src/                  # Fastify backend (TypeScript)
  ├── server.ts       # App bootstrap
  ├── config.ts       # Environment config
  ├── db/             # Drizzle schema, client, migrations, seeder
  ├── routes/         # API route handlers
  ├── services/       # Business logic services
  └── graph/          # LangGraph ranking + similarity graphs
client/               # Vue 3 SPA
  ├── pages/          # Route views
  ├── components/     # Reusable components
  ├── stores/         # Pinia stores
  ├── api/            # Axios client
  └── router/         # Vue Router config
drizzle/              # Generated SQL migrations
```
