# Alvorada Property Research System

A full-stack real estate research platform with AI-powered property ranking and GraphRAG-based similarity search.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Fastify, TypeScript, Drizzle ORM |
| Frontend | Vue 3, Pinia, Vue Router, Tailwind CSS 4, Leaflet |
| AI | LangGraph, LangChain, Zod |
| LLM | OpenRouter API (default: `google/gemini-2.0-flash-001`) |
| Primary DB | PostgreSQL 16 + PostGIS 3.4 |
| Graph DB | Neo4j 5 Community (optional) |
| Geocoding | Nominatim (OpenStreetMap) |

## Quick Start

### With Docker

```bash
cp .env.example .env          # set LLM_API_KEY
docker compose up             # Fastify :3000, Postgres :5432, Neo4j :7474
```

### Local development

```bash
cp .env.example .env          # set DATABASE_URL, LLM_API_KEY
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # Fastify :3000 + Vite :5173
```

Visit http://localhost:5173 (dev) or http://localhost:3000 (Docker/prod).

## Environment Setup

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LLM_API_KEY` | Yes | OpenRouter API key |
| `LLM_MODEL` | No | Default: `google/gemini-2.0-flash-001` |
| `NEO4J_URI` | No | e.g. `bolt://localhost:7687` — enables GraphRAG |
| `NEO4J_PASSWORD` | No | Neo4j password |
| `PORT` | No | Server port (default 3000) |

## npm Scripts

```bash
npm run dev             # Start Fastify + Vite concurrently
npm run dev:api         # Fastify only (:3000)
npm run dev:vite        # Vite only (:5173)
npm run build           # Compile Vue SPA → dist/
npm run typecheck       # TypeScript validation
npm run db:generate     # Generate Drizzle migration
npm run db:migrate      # Run pending migrations
npm run db:seed         # Seed 275 US properties with notes and features
```

## Architecture

```
Vue SPA (Axios → /api)
    └─► Fastify (:3000)
            ├─ propertyRoutes → Drizzle → PostgreSQL
            ├─ noteRoutes    → Drizzle → PostgreSQL
            └─ aiRoutes
                    ├─ Feature extraction → OpenRouter LLM
                    ├─ Ranking  → LangGraph ranking graph (in-process)
                    └─ Similarity → LangGraph similarity graph (Neo4j + in-process)
```

**Ranking graph** (`src/graph/ranking/`): `parseRequirements → buildRankingQuery → validateQuery → executeRanking → generateResponse`

**Similarity graph** (`src/graph/similarity/`): `fetchProperty → traverseGraph → scoreSimilarity → generateExplanation`

Neo4j is optional. Without it, similarity search is unavailable; ranking works entirely through PostgreSQL.

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/properties` | List all with notes + features |
| POST | `/api/properties` | Create (auto-geocoded) |
| GET | `/api/properties/:id` | Single property |
| POST | `/api/properties/search` | Filter by criteria |
| POST | `/api/notes` | Add note to property |
| POST | `/api/ai/extract-features` | Extract features from notes |
| POST | `/api/ai/score` | Rank properties by requirements |
| POST | `/api/ai/score/stream` | Rank with SSE progress |
| POST | `/api/ai/similar` | Find similar properties (GraphRAG) |
