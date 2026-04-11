# Neo4j Knowledge Graph Seeder

## Overview

A one-time seed script that populates the Neo4j knowledge graph with synthetic, feature-aware data so the LangGraph similarity graph has meaningful data to traverse. The script reads all 275 properties and their extracted features from PostgreSQL and creates concept nodes and relationships in Neo4j.

## Neo4j Graph Schema

### Node Labels

| Label | Properties | Example |
|-------|-----------|---------|
| `:Property` | `laravel_id: int` | `{ laravel_id: 42 }` |
| `:Landmark` | `name: string, type: string` | `{ name: "Central Station", type: "transit" }` |
| `:Neighborhood` | `name: string` | `{ name: "Midtown" }` |
| `:Amenity` | `type: string` | `{ type: "gym" }` |
| `:UseType` | `name: string` | `{ name: "office" }` |

### Relationship Types

| Pattern | Meaning |
|---------|---------|
| `(:Property)-[:NEAR]->(:Landmark)` | Property is near this landmark |
| `(:Property)-[:IN]->(:Neighborhood)` | Property is in this neighborhood |
| `(:Property)-[:HAS_AMENITY]->(:Amenity)` | Property has this amenity |
| `(:Property)-[:SUITED_FOR]->(:UseType)` | Property is suited for this use |

These match the Cypher patterns in `fetchPropertyNode.ts` and `traverseGraphNode.ts` exactly.

## Concept Pools (~43 total)

### Neighborhoods (8)

Downtown, Midtown, Uptown, Waterfront, Arts District, Tech Corridor, Historic Quarter, Industrial Park

### Landmarks (12)

| Name | Type |
|------|------|
| Central Station | transit |
| Metro Hub | transit |
| City Park | park |
| Riverside Green | park |
| State University | education |
| Community College | education |
| Convention Center | commercial |
| Shopping Mall | commercial |
| General Hospital | medical |
| Medical Plaza | medical |
| City Hall | civic |
| Public Library | civic |

### Amenities (15)

lobby, security, gym, rooftop, conference-rooms, co-working, bike-storage, ev-charging, loading-dock, courtyard, pool, cafe, daycare, storage-units, concierge

Overlaps intentionally with Postgres `property_features.amenities` values from the seeder (lobby, security, gym, rooftop, conference-rooms, co-working, bike-storage, ev-charging, loading-dock, courtyard) so feature-aware assignment works naturally.

### Use Types (8)

office, retail, restaurant, warehouse, medical, residential, mixed-use, tech

## Feature-Aware Assignment Logic

Each property gets 6-10 concept connections. Properties with `property_features` data get semantically coherent assignments. Properties without features get fully random assignments at the same density.

### Use Types (1-2 per property)

- **Primary:** Direct map from `property_features.recommendedUse` to the matching `:UseType` node.
- **Secondary:** 50% chance of a related use type:
  - office → mixed-use
  - warehouse → retail
  - restaurant → retail
  - tech → office
  - medical → office
  - retail → mixed-use
  - residential → mixed-use
  - mixed-use → office
  - studio → mixed-use (studio maps to mixed-use as primary since there's no studio use type)

### Amenities (2-4 per property)

1. Start with amenities from `property_features.amenities` that exist in the Neo4j amenity pool (direct string match).
2. If fewer than 2 matches, pad with random picks from the pool (excluding already-assigned).
3. Cap at 4.

### Neighborhoods (1-2 per property)

Assigned based on `recommendedUse` affinity:

| recommendedUse | Affinity neighborhoods |
|---------------|----------------------|
| office, tech | Downtown, Midtown, Tech Corridor |
| retail, restaurant | Midtown, Arts District, Uptown |
| warehouse | Industrial Park, Waterfront |
| medical | Midtown, Uptown |
| residential | Uptown, Historic Quarter, Waterfront |
| mixed-use, studio | Arts District, Downtown, Waterfront |

Pick 1-2 from the affinity set randomly.

### Landmarks (2-3 per property)

Feature-driven picks (checked in order, first matches applied):

| Condition | Landmark candidates |
|-----------|-------------------|
| `nearSubway: true` | Central Station, Metro Hub (pick 1) |
| `hasElevator: true` AND `estimatedCapacityPeople >= 200` | Convention Center, Shopping Mall (pick 1) |
| `conditionRating >= 4` | City Park, Riverside Green (pick 1) |
| `recommendedUse: "medical"` | General Hospital, Medical Plaza (pick 1) |

Fill remaining slots (up to 2-3 total) with random picks from the full landmark pool, excluding already-assigned.

### Fallback (no features)

Properties without a `property_features` row get:
- 1-2 random neighborhoods
- 2-3 random landmarks
- 2-4 random amenities
- 1-2 random use types

## Seed Script Design

### File

`src/db/neo4jSeeder.ts`

### Script Flow

1. Import `envBootstrap.js` (same pattern as existing `seed.ts`).
2. Connect to PostgreSQL via Drizzle — fetch all properties with their features (join `properties` + `property_features`).
3. Connect to Neo4j via `getNeo4jDriver()`.
4. **Wipe:** `MATCH (n) DETACH DELETE n` — clear all existing data.
5. **Create constraints and indexes:**
   - Unique constraint on `Property.laravel_id`
   - Unique constraint on `Landmark.name`
   - Unique constraint on `Neighborhood.name`
   - Unique constraint on `Amenity.type`
   - Unique constraint on `UseType.name`
6. **Create concept nodes:** Batch `UNWIND` + `CREATE` per label (one Cypher call per concept type).
7. **Create property nodes:** Batch `UNWIND` + `CREATE` for all 275 `:Property` nodes.
8. **Create relationships:** For each property, compute assignments via feature-aware logic, then batch all relationships per type via `UNWIND` + `MATCH` + `CREATE`.
9. **Log summary:** Nodes created per label, total relationships, average connections per property.
10. Close Neo4j driver and exit.

### npm Script

```json
"neo4j:seed": "tsx src/db/neo4jSeeder.ts"
```

### Performance

All node creation and relationship creation uses `UNWIND` batching — single Cypher call per label/relationship type. No per-property round trips for node creation.

### Idempotency

Re-running wipes everything and rebuilds from scratch via `MATCH (n) DETACH DELETE n`.

## Dependencies

- Existing `neo4jService.ts` (`getNeo4jDriver`, `runWriteQuery`, `runReadQuery`, `closeNeo4jDriver`)
- Existing Drizzle DB client (`src/db/index.ts`)
- Requires `NEO4J_URI` and `NEO4J_PASSWORD` env vars set
- Requires PostgreSQL running with seeded property data (`npm run db:seed`)
