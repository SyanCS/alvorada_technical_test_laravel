# Alvorada Property Research System

A full-stack commercial real estate research platform with AI-powered property ranking and GraphRAG-based similarity search.

---

## What It Does

The system lets you build a database of commercial properties, attach research notes to each one, and use AI to:

1. **Rank properties** against natural language requirements — *"office near subway with parking for 30 people"*
2. **Find similar properties** to one you're already looking at, using a knowledge graph built from your research notes
3. **Extract structured features** from unstructured notes — condition rating, amenities, use type, etc.

---

## Architecture

```
Browser (Vue 3 SPA)
    │
    ▼ REST API
Laravel 13 (PHP 8.3+)          ← main backend, PostgreSQL
    │
    ├── /api/properties         CRUD + geocoding (Nominatim)
    ├── /api/notes              Attach research notes
    ├── /api/ai/extract-features  → OpenRouter LLM → structured features
    ├── /api/ai/score           → proxies to AI Service /search
    └── /api/ai/similar         → proxies to AI Service /similar

AI Service (Node.js/TypeScript, Fastify)
    │
    ├── POST /search            LangGraph ranking graph
    └── POST /similar          LangGraph similarity graph

Databases
    ├── PostgreSQL 16 + PostGIS  properties, notes, features
    └── Neo4j 5 (Community)      knowledge graph for GraphRAG
```

---

## AI Features

### Property Ranking (`POST /search`)

When a user describes what they want, the system runs a 5-node LangGraph pipeline:

```
parseRequirements → buildRankingQuery → validateQuery → executeRanking → generateResponse
```

- **parseRequirements** — LLM extracts structured criteria (use type, capacity, condition, amenities, etc.)
- **buildRankingQuery** — splits criteria into hard filters (must match) and soft preferences (nice to have)
- **validateQuery** — validates field names and types without an LLM call
- **executeRanking** — queries PostgreSQL, counts soft-preference matches per property, sorts by match count
- **generateResponse** — single LLM call to score each property 0–10 with explanation, strengths, weaknesses

No Cypher generation. No correction loops. Ranking is deterministic; the LLM only touches the first and last nodes.

### GraphRAG Similarity (`POST /similar`)

When a user is viewing a property and wants to find similar ones, the system traverses a Neo4j knowledge graph:

```
fetchProperty → traverseGraph → scoreSimilarity → generateExplanation
```

- **fetchProperty** — loads the source property from PostgreSQL + its concept nodes from Neo4j
- **traverseGraph** — Cypher pattern traversal: finds all properties sharing concept nodes (landmarks, neighborhoods, amenities, use types) with weighted scoring (neighborhood=4pts, landmark=3pts, amenity=2pts, use type=1pt)
- **scoreSimilarity** — normalises weighted scores to 0–100 (no LLM)
- **generateExplanation** — single LLM call to write a 1-sentence "why similar" explanation per property + overall summary

### Feature Extraction

Notes are unstructured text. When you trigger extraction, an LLM reads all notes for a property and returns:

| Field | Type | Example |
|-------|------|---------|
| `near_subway` | boolean | true |
| `parking_available` | boolean | false |
| `has_elevator` | boolean | true |
| `needs_renovation` | boolean | false |
| `condition_rating` | 1–5 | 4 |
| `estimated_capacity_people` | number | 25 |
| `floor_level` | number | 3 |
| `recommended_use` | string | office |
| `amenities` | string[] | ["rooftop", "loading_dock"] |
| `confidence_score` | 0–1 | 0.87 |

### Building the Knowledge Graph

The GraphRAG similarity feature requires populating Neo4j with concept nodes extracted from your notes. Run this once (and re-run after adding new notes):

```bash
cd ai-service
npm run extract-entities
```

This reads every property's notes, runs one LLM call per property to extract entities (landmarks, neighborhoods, amenities, use types), and writes them as Neo4j nodes with relationships:

```
(Property)-[:NEAR]->(Landmark { name, type })
(Property)-[:IN]->(Neighborhood { name })
(Property)-[:HAS_AMENITY]->(Amenity { type })
(Property)-[:SUITED_FOR]->(UseType { name })
```

Shared concept nodes across properties are what enable the graph traversal. Two properties that share a `Neighborhood` node rank higher than two that only share an `Amenity`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Laravel 13, PHP 8.3+, Eloquent ORM |
| Frontend | Vue 3, Pinia, Vue Router, Tailwind CSS 4, Leaflet |
| AI Service | TypeScript, LangGraph, LangChain, Fastify, Zod |
| LLM | OpenRouter API (default: `google/gemini-2.0-flash-001`) |
| Primary DB | PostgreSQL 16 + PostGIS 3.4 |
| Graph DB | Neo4j 5 Community |
| Geocoding | Nominatim (OpenStreetMap) |

---

## Getting Started

### Prerequisites

- Docker + Docker Compose
- An [OpenRouter](https://openrouter.ai) API key

### 1. Environment setup

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
LLM_API_KEY=your_openrouter_key_here
```

Everything else works out of the box with Docker defaults.

### 2. Start the stack

```bash
docker compose up
```

This starts four services:

| Service | URL | Purpose |
|---------|-----|---------|
| Laravel app | http://localhost:8000 | Main app + API |
| AI service | http://localhost:3001 | LangGraph ranking + similarity |
| PostgreSQL | localhost:5432 | Primary database |
| Neo4j | http://localhost:7474 | Graph database (browser UI) |

### 3. Seed the database

```bash
docker compose exec app php artisan migrate --seed
```

This creates the schema and seeds 275 US commercial properties with notes and pre-extracted features.

### 4. Build the knowledge graph (for similarity search)

```bash
# Copy the AI service env first
cp ai-service/.env.example ai-service/.env
# Set LLM_API_KEY and Neo4j vars in ai-service/.env, then:
cd ai-service && npm run extract-entities
```

This populates Neo4j with concept nodes from the seeded property notes. Required for "Find Similar" to return results.

### 5. Open the app

Visit http://localhost:8000

---

## Local Development (without Docker)

### Laravel

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
composer dev   # starts artisan serve + queue + vite concurrently
```

### AI Service

```bash
cd ai-service
npm install
cp .env.example .env   # set LLM_API_KEY, LARAVEL_API_URL, NEO4J_*
npm run dev            # watch mode
```

---

## API Reference

### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties` | List all properties with notes + features |
| POST | `/api/properties` | Create property (geocoded automatically) |
| GET | `/api/properties/{id}` | Single property |
| POST | `/api/properties/search` | Filter by criteria |
| POST | `/api/properties/by-ids` | Batch fetch by IDs |

### Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes?property_id=X` | List notes for a property |
| POST | `/api/notes` | Add a note |

### AI

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/ai/extract-features` | `{ property_id, force_refresh? }` | Extract structured features from notes |
| POST | `/api/ai/score` | `{ requirements, limit? }` | Rank properties by requirements |
| POST | `/api/ai/similar` | `{ property_id, limit? }` | Find similar properties (GraphRAG) |
| GET | `/api/properties/{id}/features` | — | Get extracted features |

### AI Service (direct)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/search` | `{ requirements, limit? }` | Ranking graph |
| POST | `/similar` | `{ property_id, limit? }` | Similarity graph |
| GET | `/health` | — | Health check |

---

## Environment Variables

### Laravel (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_KEY` | Yes | — | Laravel app key (`php artisan key:generate`) |
| `LLM_API_KEY` | Yes | — | OpenRouter API key |
| `LLM_MODEL` | No | `google/gemini-2.0-flash-001` | LLM model |
| `AI_SERVICE_URL` | No | `http://localhost:3001` | AI service base URL |
| `DB_HOST` | No | `127.0.0.1` | PostgreSQL host |
| `NEO4J_PASSWORD` | No | `neo4j-secret` | Neo4j password |

### AI Service (`ai-service/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_KEY` | Yes | OpenRouter API key |
| `LARAVEL_API_URL` | Yes | e.g. `http://localhost:8000/api` |
| `NEO4J_URI` | No | e.g. `bolt://localhost:7687` — enables GraphRAG |
| `NEO4J_PASSWORD` | No | Neo4j password |
| `LLM_MODEL` | No | Override default model |
| `LANGSMITH_API_KEY` | No | LangSmith tracing |

If `NEO4J_URI` is not set, the AI service operates without the knowledge graph (similarity search will return empty results).

---

## Commands

### Laravel

```bash
composer dev              # Start all dev servers concurrently
composer test             # Run PHP test suite
php artisan test          # Run tests
php artisan migrate       # Run migrations
php artisan db:seed       # Seed 275 properties
vendor/bin/pint           # Format PHP code
```

### AI Service

```bash
npm run dev               # Watch mode (tsx --watch)
npm run start             # Production
npm run typecheck         # TypeScript type check
npm run extract-entities  # Build Neo4j knowledge graph from property notes
```

### Docker

```bash
docker compose up -d      # Start all services in background
docker compose down       # Stop all services
docker compose logs -f app        # Follow Laravel logs
docker compose logs -f ai-service # Follow AI service logs
```

---

## Testing

```bash
# Laravel (PHPUnit)
php artisan test
php artisan test tests/Feature/AISimilarTest.php   # single file
php artisan test --filter=test_similar             # single method
php artisan test --parallel

# AI Service (TypeScript)
cd ai-service && npm run typecheck
```

Tests use SQLite in-memory — no running database required for PHP tests.

---

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | PropertiesIndex | List all properties with search |
| `/properties/create` | PropertyCreate | Add a new property |
| `/properties/:id` | PropertyShow | Property detail, notes, features, similar properties |
| `/map` | MapView | Leaflet map of all properties |
| `/scoring` | ScoringView | AI ranking interface |

---

## Database Schema

```
properties
  id, name, address (unique), latitude, longitude
  extra_field (JSON)  ← Nominatim enrichment: city, state, osm_type, etc.

notes
  id, property_id → properties, note (text)

property_features           ← AI-extracted, one per property
  property_id (unique FK)
  near_subway, needs_renovation, parking_available, has_elevator (boolean)
  estimated_capacity_people, floor_level, condition_rating 1-5 (numeric)
  recommended_use (string)
  amenities (JSON array)
  confidence_score (0.0–1.0), raw_ai_response (JSON), extracted_at
```

---

## Neo4j Graph Schema

```
(Property { laravel_id, name, address, latitude, longitude,
            near_subway, needs_renovation, parking_available, has_elevator,
            estimated_capacity_people, condition_rating, recommended_use })

(Property)-[:NEAR]→(Landmark     { name, type })
(Property)-[:IN]→(Neighborhood   { name })
(Property)-[:HAS_AMENITY]→(Amenity { type })
(Property)-[:SUITED_FOR]→(UseType  { name })
```

Concept nodes are shared across properties. A single `Neighborhood { name: "SoMa" }` node connects all properties whose notes mention that neighbourhood. Graph traversal finds properties through these shared nodes.
