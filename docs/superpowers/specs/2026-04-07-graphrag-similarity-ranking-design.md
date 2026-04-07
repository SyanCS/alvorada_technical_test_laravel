# GraphRAG Similarity + Deterministic Ranking — Design Spec

**Date:** 2026-04-07
**Status:** Approved

---

## Problem

The current AI service uses Text-to-Cypher on a flat-attribute Neo4j mirror of PostgreSQL. This provides no graph value — the Cypher queries are equivalent to SQL WHERE clauses. There is also no way for a user to find properties similar to one they are already viewing.

---

## Goals

1. **Ranking flow** — user describes what they want in natural language → deterministic match-count ranking → LLM-explained results
2. **GraphRAG similarity flow** — user is viewing a specific property → graph traversal over shared concept nodes → ranked similar properties with similarity score and explanation
3. **Entity extraction script** — batch job that extracts real-world concepts from notes and writes them as Neo4j concept nodes

---

## Architecture

Two separate LangGraph graphs, each with its own state annotation, Zod-validated node I/O, and API endpoint.

```
POST /search  { requirements: string, limit?: number }
  └─► Ranking Graph
        parseRequirements → buildRankingQuery → validateQuery → executeRanking → generateResponse

POST /similar  { property_id: number, limit?: number }
  └─► Similarity Graph
        fetchProperty → traverseGraph → scoreSimilarity → generateExplanation

npm run extract-entities  (replaces sync-graph)
  └─► Notes → LLM entity extraction → Neo4j concept nodes
```

### Neo4j Schema (replaces flat mirror)

```cypher
(Property { laravel_id, name, address, latitude, longitude,
            near_subway, needs_renovation, parking_available, has_elevator,
            estimated_capacity_people, floor_level, condition_rating, recommended_use })

(Property)-[:NEAR]→(Landmark     { name: string, type: "transit"|"retail"|"park"|"institution"|"other" })
(Property)-[:IN]→(Neighborhood   { name: string })
(Property)-[:HAS_AMENITY]→(Amenity { type: string })
(Property)-[:SUITED_FOR]→(UseType  { name: string })
```

Concept nodes are shared across properties — multiple properties can point to the same `Landmark` or `Neighborhood` node. This is what enables graph traversal for similarity.

---

## Ranking Graph

**Trigger:** `POST /search`

### Nodes

#### `parseRequirements`
- **Input:** `{ requirements: string }`
- **Output (Zod):**
```typescript
z.object({
  recommended_use:    z.string().optional(),
  min_capacity:       z.number().optional(),
  max_capacity:       z.number().optional(),
  min_condition:      z.number().min(1).max(5).optional(),
  near_subway:        z.boolean().optional(),
  parking_available:  z.boolean().optional(),
  has_elevator:       z.boolean().optional(),
  needs_renovation:   z.boolean().optional(),
  amenities:          z.array(z.string()).optional(),
})
```
- LLM call with structured output

#### `buildRankingQuery`
- **Input:** parsed criteria
- **Output (Zod):**
```typescript
z.object({
  filters:      z.record(z.unknown()),  // hard filters — must match
  preferences:  z.record(z.unknown()),  // soft matches — counted for rank
  explanation:  z.string(),
})
```
- **No LLM** — deterministic mapping: boolean criteria with explicit user value → hard filter; capacity/condition ranges → hard filter; amenities → soft preferences
- Deal-breaker logic: `recommended_use` and capacity are always hard filters

#### `validateQuery`
- **Input:** ranking query
- **Output (Zod):**
```typescript
z.object({
  valid:                  z.boolean(),
  corrected_filters:      z.record(z.unknown()).optional(),
  corrected_preferences:  z.record(z.unknown()).optional(),
  issues:                 z.array(z.string()).optional(),
})
```
- **No LLM** — Zod-based structural validation: checks field names exist in `property_features` schema, values are correct types, no empty query

#### `executeRanking`
- **Input:** validated query
- **Output (Zod):**
```typescript
z.object({
  candidates: z.array(z.object({
    property:       PropertyDataSchema,
    match_count:    z.number(),
    matched_fields: z.array(z.string()),
  })),
  total_checked: z.number(),
})
```
- **No LLM** — POST `/api/properties/search` with hard filters → count matched preference fields per result → sort descending by `match_count`

#### `generateResponse`
- **Input:** ranked candidates + original requirements
- **Output (Zod):**
```typescript
z.object({
  scored_properties: z.array(z.object({
    property_id:   z.number(),
    property_name: z.string(),
    address:       z.string(),
    score:         z.number().min(0).max(10),
    explanation:   z.string(),
    strengths:     z.array(z.string()),
    weaknesses:    z.array(z.string()),
    latitude:      z.number().optional(),
    longitude:     z.number().optional(),
  })),
  answer:              z.string(),
  follow_up_questions: z.array(z.string()),
})
```
- LLM call — translates match counts + criteria into human scores (0–10) with explanation per property

### Key difference from current flow
Ranking is **deterministic** — no LLM generates Cypher, no correction loop, no loosen-criteria retry. The LLM only handles `parseRequirements` and `generateResponse`. This eliminates the main failure mode of the current implementation.

---

## Similarity Graph

**Trigger:** `POST /similar`

### Nodes

#### `fetchProperty`
- **Input:** `{ property_id: number, limit: number }`
- **Output (Zod):**
```typescript
z.object({
  property: PropertyDataSchema,
  concept_nodes: z.object({
    landmarks:     z.array(z.object({ name: z.string(), type: z.string() })),
    neighborhoods: z.array(z.object({ name: z.string() })),
    amenities:     z.array(z.object({ type: z.string() })),
    use_types:     z.array(z.object({ name: z.string() })),
  }),
})
```
- GET `/api/properties/{id}` from Laravel + Neo4j MATCH to retrieve connected concept nodes

#### `traverseGraph`
- **Input:** property with concept nodes
- **Output (Zod):**
```typescript
z.object({
  candidates: z.array(z.object({
    property_id:          z.number(),
    shared_landmarks:     z.array(z.string()),
    shared_neighborhoods: z.array(z.string()),
    shared_amenities:     z.array(z.string()),
    shared_use_types:     z.array(z.string()),
    raw_match_count:      z.number(),
    weighted_score:       z.number(),
  })),
})
```
- **No LLM** — Cypher traversal: find all properties sharing ≥1 concept node with the source
- Weighted scoring: neighborhood = 4pts, landmark = 3pts, amenity = 2pts, use_type = 1pt
- Sort by `weighted_score`, take top `limit * 3` as candidates

#### `scoreSimilarity`
- **Input:** traversal result
- **Output (Zod):**
```typescript
z.object({
  scored: z.array(z.object({
    property_id:      z.number(),
    similarity_score: z.number().min(0).max(100),
    shared_concepts:  z.array(z.string()),
  })),
})
```
- **No LLM** — normalise `weighted_score` to 0–100 relative to the top candidate; flatten shared concept arrays into readable strings

#### `generateExplanation`
- **Input:** scored similarity + source property + limit
- **Output (Zod):**
```typescript
z.object({
  similar_properties: z.array(z.object({
    property_id:      z.number(),
    property_name:    z.string(),
    address:          z.string(),
    similarity_score: z.number(),
    explanation:      z.string(),
    shared_concepts:  z.array(z.string()),
    latitude:         z.number().optional(),
    longitude:        z.number().optional(),
  })),
  summary: z.string(),
})
```
- LLM call — generates natural-language explanation per property from `shared_concepts`; hydrates full property data from Laravel for the top `limit` results

---

## Entity Extraction Script

**Command:** `npm run extract-entities` (replaces `npm run sync-graph`)

### Flow

```
1. Fetch all properties + notes from GET /api/properties
2. For each property with ≥1 note:
     a. Concatenate all note texts
     b. LLM call → extract entities (one call per property, not per note)
     c. Validate output with Zod
     d. Write to Neo4j with MERGE (idempotent — safe to re-run)
3. Properties with no notes: write Property node only, skip concept extraction
4. Log: total synced, entities created, properties skipped
```

### Extraction Zod Schema

```typescript
const ExtractedEntitiesSchema = z.object({
  landmarks: z.array(z.object({
    name: z.string(),
    type: z.enum(["transit", "retail", "park", "institution", "other"]),
  })),
  neighborhoods: z.array(z.object({ name: z.string() })),
  amenities:     z.array(z.object({ type: z.string() })),
  use_types:     z.array(z.object({ name: z.string() })),
})
```

### Neo4j Write Pattern

```cypher
MERGE (p:Property { laravel_id: $id })
SET p.name = $name, p.address = $address, ...flat features...

MERGE (l:Landmark { name: $name, type: $type })
MERGE (p)-[:NEAR]->(l)

MERGE (n:Neighborhood { name: $name })
MERGE (p)-[:IN]->(n)

MERGE (a:Amenity { type: $type })
MERGE (p)-[:HAS_AMENITY]->(a)

MERGE (u:UseType { name: $name })
MERGE (p)-[:SUITED_FOR]->(u)
```

---

## API Changes

### AI Service (new/changed endpoints)

| Method | Path | Change |
|--------|------|--------|
| POST | `/search` | Replaced — now uses ranking graph |
| POST | `/similar` | New — similarity graph |
| GET | `/health` | Unchanged |

### Laravel (one new action)

```
POST /api/ai/similar
  Body:    { property_id: number, limit?: number }
  Action:  AIController@similar
  Logic:   proxy to ai-service POST /similar, return response as-is
```

### Frontend (minimal)

- New Pinia action in `propertyStore`: `findSimilar(propertyId)`
- New UI section in `PropertyShow.vue`: "Similar Properties" with score + explanation list
- One new API call in `resources/js/api/index.js`

---

## Notes

**`PropertyDataSchema`** refers to the existing shape returned by `GET /api/properties/{id}`:
```typescript
z.object({
  id: z.number(), name: z.string(), address: z.string(),
  latitude: z.number().nullable(), longitude: z.number().nullable(),
  notes: z.array(z.object({ id: z.number(), note: z.string() })).optional(),
  property_feature: z.record(z.unknown()).nullable().optional(),
})
```

---

## Files to Change

### AI Service
- `src/graph/graph.ts` — replace with two graph builders
- `src/graph/nodes/` — replace all existing nodes; add `fetchPropertyNode`, `traverseGraphNode`, `scoreSimilarityNode`, `generateExplanationNode`, `buildRankingQueryNode`, `validateQueryNode`, `executeRankingNode`
- `src/server.ts` — add `POST /similar` route
- `scripts/extract-entities.ts` — replaces `scripts/sync-graph.ts`
- `package.json` — rename `sync-graph` script to `extract-entities`

### Laravel
- `app/Http/Controllers/Api/AIController.php` — add `similar()` method
- `routes/api.php` — add `POST /ai/similar`

### Frontend
- `resources/js/stores/propertyStore.js` — add `findSimilar` action
- `resources/js/pages/PropertyShow.vue` — add similar properties section
- `resources/js/api/index.js` — add similar endpoint call

---

## What is Removed

- `buildNeo4jGraph()` / `buildSqlOnlyGraph()` — replaced by ranking graph
- `cypherGeneratorNode`, `cypherExecutorNode`, `cypherCorrectionNode` — eliminated (no more Text-to-Cypher for ranking)
- `loosenCriteriaNode` — eliminated (deterministic ranking doesn't need retry loops)
- `hydrateFromLaravelNode` — merged into `fetchProperty` node in similarity graph
- `scripts/sync-graph.ts` — replaced by `extract-entities.ts`
