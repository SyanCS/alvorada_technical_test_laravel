# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Alvorada Property Research System** — a full-stack real estate research and AI-powered property matching platform:

- **Laravel 13 backend** (PHP 8.3+) — REST API, Eloquent ORM, PostgreSQL/PostGIS
- **Vue 3 + Vite SPA** — Pinia stores, Vue Router, Tailwind CSS 4, Leaflet maps
- **AI Service** (Node.js/TypeScript) — LangGraph agentic workflow, Fastify server
- **Databases** — PostgreSQL 16 with PostGIS 3.4 (primary), Neo4j 5 (optional knowledge graph)
- **LLM** — OpenRouter API (default: `google/gemini-2.0-flash-001`)

## Commands

### Running the full stack

```bash
docker compose up          # Start all services (Laravel :8000, AI :3001, Postgres :5432, Neo4j :7474)
docker compose down
```

Before first run, copy `.env.example` to `.env` and set `LLM_API_KEY` (OpenRouter key).

### Local development (without Docker)

```bash
composer setup             # Install deps, run migrations
composer dev               # Concurrently: artisan serve + queue + pail + vite dev
```

Individual servers:
```bash
php artisan serve          # Laravel on :8000
npm run dev                # Vite dev server on :5173
```

### Building

```bash
npm run build              # Compile frontend assets (Vite → public/build/)
php artisan migrate        # Run database migrations
php artisan db:seed        # Seed 275 US properties (PropertySeeder)
```

### Testing

```bash
composer test              # Clear config cache + run full PHPUnit suite
php artisan test           # Same without config:clear
php artisan test tests/Feature/ExampleTest.php   # Single file
php artisan test --filter=testExample            # By method name
php artisan test --parallel                      # Parallel execution
```

Tests use SQLite in-memory (`DB_CONNECTION=sqlite` in phpunit.xml). No real database required.

### Linting

```bash
vendor/bin/pint            # PHP code formatting (Laravel Pint)
```

### AI Service (standalone)

```bash
cd ai-service
npm run dev                # Watch mode (tsx --watch)
npm run start              # Production
npm run typecheck          # TypeScript validation
npm run sync-graph         # Sync Neo4j knowledge graph from PostgreSQL
```

## Architecture

### Request Flow

```
Vue SPA (Axios)
    └─► Laravel API (:8000)
            ├─ PropertyController → PostgreSQL (CRUD + geocoding)
            ├─ NoteController → PostgreSQL
            └─ AIController
                    ├─ FeatureExtractionService → OpenRouter LLM → property_features table
                    └─ PropertyScoringService OR proxy → AI Service (:3001)

AI Service (:3001) — POST /search
    ├─ LangGraph state machine
    ├─ Neo4j path: Cypher generation → execution → hydrate from Laravel
    └─ SQL fallback: /api/properties/search → score candidates → synthesize response
```

### Database Schema

**`properties`** — core records; `address` (unique), `latitude`, `longitude`, `extra_field` (JSON, Nominatim enrichment: city, state, osm_type, etc.)

**`property_features`** — AI-extracted per-property (one-to-one): booleans (`near_subway`, `needs_renovation`, `parking_available`, `has_elevator`), numerics (`estimated_capacity_people`, `floor_level`, `condition_rating` 1–5), string (`recommended_use`), array (`amenities` JSON), and AI metadata (`confidence_score`, `raw_ai_response`).

**`notes`** — unstructured research text, many-to-one with properties.

### Key Services

| Service | Responsibility |
|---|---|
| `GeolocationService` | Forward/reverse geocoding via Nominatim (OpenStreetMap) |
| `OpenRouterService` | OpenAI-compatible LLM client; exponential backoff retries; JSON extraction mode |
| `FeatureExtractionService` | Notes → structured `PropertyFeature` via LLM (upserts) |
| `PropertyScoringService` | PHP-based scoring fallback when AI Service is unavailable |

### AI Service LangGraph Nodes

Located in `ai-service/src/graph/nodes/`:

1. `parseRequirements` — NL requirements → structured criteria (Zod schema)
2. `cypherGenerator` / `cypherExecutor` / `cypherCorrection` — Neo4j path (skipped if Neo4j not configured)
3. `hydrateFromLaravel` — fetch full property data via `POST /api/properties/by-ids`
4. `retrieveProperties` — SQL fallback via `POST /api/properties/search`
5. `loosenCriteria` — up to 7 rounds of filter relaxation if no results
6. `scoreCandidates` — parallel LLM scoring (0–10 with explanation, strengths, weaknesses)
7. `generateResponse` — synthesize final answer + follow-up questions

**Neo4j** is optional. When `NEO4J_URI`/`NEO4J_PASSWORD` are set, the graph path activates; otherwise the service falls back to SQL retrieval.

### Frontend Structure

Vue Router pages: `PropertiesIndex`, `PropertyCreate`, `PropertyShow`, `MapView`, `ScoringView`.

Pinia stores: `propertyStore` (primary CRUD), `mapStore`, `scoringStore`.

API client at `resources/js/api/index.js` — Axios wrapper pointing to `/api`.

Vite aliases: `@/` → `resources/js/`.

### Environment Variables

Critical vars (see `.env.example`):
- `LLM_API_KEY` — OpenRouter API key (shared by Laravel and AI Service)
- `LLM_MODEL` — default `google/gemini-2.0-flash-001`
- `AI_SERVICE_URL` — default `http://localhost:3001`; set to `http://ai-service:3001` in Docker
- `NEO4J_PASSWORD` — default `neo4j-secret` (activates graph path when set alongside `NEO4J_URI`)
- `LANGSMITH_API_KEY` + `LANGCHAIN_TRACING_V2=true` — optional LangSmith tracing

### Config Files

Custom Laravel configs live in `config/`: `ai.php`, `llm.php`, `geolocation.php`.
