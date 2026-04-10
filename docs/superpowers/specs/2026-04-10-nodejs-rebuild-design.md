# Node.js Rebuild Design Spec

## Goal

Merge the Laravel backend and the AI service into a single Fastify/Node.js server. The Vue 3 SPA stays. The result is two processes instead of three: one Fastify server (API + static SPA) and Postgres. Neo4j remains optional.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Motivation | Simplify architecture — eliminate inter-service HTTP calls | Laravel was just a CRUD proxy; AI service already runs Node.js |
| Framework | Fastify (existing AI service) | Already in use, performant, TypeScript-native |
| ORM | Drizzle ORM | Lightweight, TS-first, SQL-like, great type inference |
| SPA serving | Fastify serves built SPA + API on one port | Single deployment unit, Vite dev proxy for development |
| Migrations | Drizzle Kit (TS schema → SQL migrations) | Clean slate for domain tables only |
| Neo4j | Keep as optional | Graph path already works in AI service code |
| Approach | In-place migration inside this repo | Preserves git history, AI service code stays in place |

## Project Structure

```
alvorada/
├── src/
│   ├── server.ts                # Fastify bootstrap, plugin registration, static serving
│   ├── config.ts                # Env vars (DB, LLM, Neo4j, etc.)
│   ├── db/
│   │   ├── schema.ts            # Drizzle table definitions
│   │   ├── migrate.ts           # Drizzle Kit migration runner
│   │   ├── seed.ts              # Port of PropertySeeder (275 US properties)
│   │   └── index.ts             # Drizzle client + connection pool (node-postgres)
│   ├── routes/
│   │   ├── properties.ts        # CRUD + search + by-ids
│   │   ├── notes.ts             # List + create
│   │   └── ai.ts                # extract-features, score, score/stream, similar, features
│   ├── services/
│   │   ├── geolocation.ts       # Nominatim geocoding (port from PHP)
│   │   ├── openrouter.ts        # OpenRouter LLM client (port from PHP)
│   │   ├── featureExtraction.ts # Notes → structured features via LLM (port from PHP)
│   │   ├── propertyScoring.ts   # PHP scoring fallback (port from PHP)
│   │   ├── neo4jService.ts      # Existing (unchanged)
│   │   └── llm.ts               # Existing (unchanged)
│   ├── graph/                   # Existing LangGraph code
│   │   ├── factory.ts
│   │   ├── ranking/
│   │   │   ├── graph.ts
│   │   │   ├── types.ts
│   │   │   └── nodes/
│   │   │       ├── parseRequirementsNode.ts
│   │   │       ├── buildRankingQueryNode.ts
│   │   │       ├── validateQueryNode.ts
│   │   │       ├── executeRankingNode.ts
│   │   │       └── generateResponseNode.ts
│   │   └── similarity/
│   │       ├── graph.ts
│   │       ├── types.ts
│   │       └── nodes/
│   │           ├── fetchPropertyNode.ts
│   │           ├── traverseGraphNode.ts
│   │           ├── scoreSimilarityNode.ts
│   │           └── generateExplanationNode.ts
│   └── index.ts                 # Entry point
├── client/                      # Vue SPA (moved from resources/js/)
│   ├── api/
│   │   └── index.js             # Axios client (baseURL: '/api', remove CSRF)
│   ├── components/              # All 10 existing .vue components
│   ├── pages/                   # All 5 existing page views
│   ├── stores/                  # 3 Pinia stores
│   ├── composables/
│   ├── router/
│   ├── App.vue
│   ├── app.js
│   └── bootstrap.js
├── public/
│   └── index.html               # SPA entry (replaces Blade template)
├── drizzle/                     # Generated migration SQL files
├── drizzle.config.ts
├── vite.config.ts               # Standalone SPA build (no laravel-vite-plugin)
├── package.json                 # Unified deps
├── tsconfig.json
├── docker-compose.yml
├── Dockerfile                   # Node.js image
└── .env.example
```

## Database Schema

Three domain tables matching the existing Postgres schema. Column names stay snake_case in the database; TypeScript fields use camelCase with Drizzle mapping.

**properties** — `id`, `name` (unique), `address` (unique), `latitude`, `longitude`, `extra_field` (JSON), `created_at`, `updated_at`

**notes** — `id`, `property_id` (FK → properties, cascade delete), `note` (text), `created_at`, `updated_at`

**property_features** — `id`, `property_id` (FK → properties, unique, cascade delete), `near_subway`, `needs_renovation`, `parking_available`, `has_elevator`, `estimated_capacity_people`, `floor_level`, `condition_rating`, `recommended_use`, `amenities` (JSON), `confidence_score`, `source_notes_count`, `raw_ai_response` (JSON), `extracted_at`, `created_at`, `updated_at`

No users/cache/jobs tables — those were Laravel-specific.

## API Routes

Exact same endpoints, same request/response shapes. The Vue SPA should not need route changes.

| Method | Path | Source |
|---|---|---|
| GET | /api/properties | PropertyController::index |
| POST | /api/properties | PropertyController::store |
| POST | /api/properties/search | PropertyController::search |
| POST | /api/properties/by-ids | PropertyController::byIds |
| GET | /api/properties/:id | PropertyController::show |
| GET | /api/notes | NoteController::index |
| POST | /api/notes | NoteController::store |
| POST | /api/ai/extract-features | AIController::extractFeatures |
| POST | /api/ai/score | AIController::scoreProperties |
| POST | /api/ai/score/stream | AIController::scorePropertiesStream (SSE) |
| POST | /api/ai/similar | AIController::similar |
| GET | /api/properties/:id/features | AIController::getPropertyFeatures |

Key difference: `/api/ai/score` and `/api/ai/similar` no longer proxy to a separate service — they invoke the LangGraph graphs directly in-process.

## Services Port Plan

### geolocation.ts (from GeolocationService.php)
- Forward/reverse geocoding via Nominatim
- Use `fetch` (native Node.js) instead of Laravel's Http facade
- Same user-agent header, timeout, error handling

### openrouter.ts (from OpenRouterService.php)
- OpenAI-compatible chat completions via OpenRouter
- Exponential backoff retries (same logic)
- JSON extraction mode
- Replace Laravel's Http with `fetch`

### featureExtraction.ts (from FeatureExtractionService.php)
- Same system/user prompts (copy verbatim)
- Same parsing logic (boolean, numeric, text, array field validation)
- Uses openrouter.ts instead of PHP's OpenRouterService
- Uses Drizzle for upsert instead of Eloquent

### propertyScoring.ts (from PropertyScoringService.php)
- Same scoring prompts and response parsing
- Direct Drizzle queries instead of Eloquent
- Used as fallback; primary path is the LangGraph ranking graph

## Graph Nodes — What Changes

Most graph code is unchanged. The main change is eliminating `laravelClient.ts`:

- **laravelClient.ts** — DELETE. This made HTTP calls to Laravel's `/api/properties/search` and `/api/properties/by-ids`. Those calls become direct Drizzle queries.
- **executeRankingNode.ts** — Instead of calling `laravelClient.searchProperties()`, query Drizzle directly
- **fetchPropertyNode.ts** — Instead of calling `laravelClient.getPropertyByIds()`, query Drizzle directly
- All other nodes (parseRequirements, buildRankingQuery, validateQuery, generateResponse, traverseGraph, scoreSimilarity, generateExplanation) — unchanged

## Vue SPA Changes

Minimal changes required:

1. **Move** `resources/js/*` → `client/`
2. **index.html** — New standalone HTML file (replaces Blade template). Loads `client/app.js`.
3. **api/index.js** — Remove CSRF token interceptor (no more Laravel sessions). `baseURL: '/api'` stays the same.
4. **vite.config.ts** — Remove `laravel-vite-plugin`, use standard `@vitejs/plugin-vue`. Configure proxy to Fastify `:3000` in dev mode.
5. **All components, pages, stores, router** — unchanged.

## Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': '/client' } },
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
```

## Docker Setup

**Dockerfile** — Single-stage Node.js image. Builds the Vue SPA at build time, runs Fastify in production.

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build          # Vite builds client/ → dist/
EXPOSE 3000
CMD ["node", "dist-server/index.js"]
```

**docker-compose.yml** — Three services (down from four): `app` (Fastify), `postgres`, `neo4j`.

The `ai-service` container is removed entirely.

## Environment Variables

Same vars, simplified. `.env.example`:

```
# Database
DATABASE_URL=postgresql://alvorada_user:alvorada_password@localhost:5432/alvorada_db

# LLM
LLM_API_KEY=
LLM_MODEL=google/gemini-2.0-flash-001

# Neo4j (optional — activates graph path)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j-secret

# Tracing (optional)
LANGSMITH_API_KEY=
LANGCHAIN_TRACING_V2=false
LANGCHAIN_PROJECT=alvorada-property-research

# Server
PORT=3000
NODE_ENV=development
```

No more `AI_SERVICE_URL` — the AI logic is in-process.

## What Gets Deleted

All PHP/Laravel files:
- `app/` (Controllers, Models, Services, Requests, Providers)
- `bootstrap/`, `config/`, `routes/`
- `database/` (migrations, seeders, factories)
- `resources/views/` (Blade templates)
- `storage/`, `public/` (Laravel's public dir)
- `tests/` (PHPUnit)
- `vendor/`
- `composer.json`, `composer.lock`, `phpunit.xml`, `artisan`
- `ai-service/` directory (code moves into `src/`)

## Testing Strategy

- Vitest for backend unit/integration tests
- Existing Vue component structure supports adding Vitest component tests later
- Drizzle + SQLite in-memory for test database (mirrors the current PHPUnit approach)
