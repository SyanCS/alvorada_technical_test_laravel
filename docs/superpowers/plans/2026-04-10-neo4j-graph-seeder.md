# Neo4j Knowledge Graph Seeder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a seed script that populates Neo4j with ~43 concept nodes and dense, feature-aware relationships for all 275 Postgres properties, enabling the similarity graph to produce meaningful results.

**Architecture:** Single TypeScript script (`src/db/neo4jSeeder.ts`) that reads properties + features from Postgres, builds concept nodes and feature-driven relationships in Neo4j via batched Cypher queries. Follows the same bootstrap pattern as `src/db/seed.ts`.

**Tech Stack:** TypeScript, Neo4j driver (via existing `neo4jService.ts`), Drizzle ORM (via existing `src/db/index.ts`), tsx runner

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/db/neo4jSeeder.ts` | Main seed script: concept pools, assignment logic, Cypher batching |
| Modify | `package.json` | Add `neo4j:seed` npm script |

---

### Task 1: Concept Pools and Assignment Helpers

**Files:**
- Create: `src/db/neo4jSeeder.ts`

- [ ] **Step 1: Create `neo4jSeeder.ts` with imports, concept pools, and type definitions**

```typescript
import "../envBootstrap.js";
import { db, schema } from "./index.js";
import { getNeo4jDriver, closeNeo4jDriver } from "../services/neo4jService.js";
import neo4j from "neo4j-driver";

// ---------------------------------------------------------------------------
// Concept pools
// ---------------------------------------------------------------------------
const NEIGHBORHOODS = [
  "Downtown", "Midtown", "Uptown", "Waterfront",
  "Arts District", "Tech Corridor", "Historic Quarter", "Industrial Park",
];

const LANDMARKS = [
  { name: "Central Station", type: "transit" },
  { name: "Metro Hub", type: "transit" },
  { name: "City Park", type: "park" },
  { name: "Riverside Green", type: "park" },
  { name: "State University", type: "education" },
  { name: "Community College", type: "education" },
  { name: "Convention Center", type: "commercial" },
  { name: "Shopping Mall", type: "commercial" },
  { name: "General Hospital", type: "medical" },
  { name: "Medical Plaza", type: "medical" },
  { name: "City Hall", type: "civic" },
  { name: "Public Library", type: "civic" },
];

const AMENITIES = [
  "lobby", "security", "gym", "rooftop", "conference-rooms",
  "co-working", "bike-storage", "ev-charging", "loading-dock", "courtyard",
  "pool", "cafe", "daycare", "storage-units", "concierge",
];

const USE_TYPES = [
  "office", "retail", "restaurant", "warehouse",
  "medical", "residential", "mixed-use", "tech",
];

// ---------------------------------------------------------------------------
// Assignment helpers
// ---------------------------------------------------------------------------
interface PropertyRow {
  id: number;
  features: {
    nearSubway: boolean | null;
    needsRenovation: boolean | null;
    parkingAvailable: boolean | null;
    hasElevator: boolean | null;
    estimatedCapacityPeople: number | null;
    conditionRating: number | null;
    recommendedUse: string | null;
    amenities: string[] | null;
  } | null;
}

const SECONDARY_USE: Record<string, string> = {
  office: "mixed-use",
  warehouse: "retail",
  restaurant: "retail",
  tech: "office",
  medical: "office",
  retail: "mixed-use",
  residential: "mixed-use",
  "mixed-use": "office",
  studio: "mixed-use",
};

const NEIGHBORHOOD_AFFINITY: Record<string, string[]> = {
  office:      ["Downtown", "Midtown", "Tech Corridor"],
  tech:        ["Downtown", "Midtown", "Tech Corridor"],
  retail:      ["Midtown", "Arts District", "Uptown"],
  restaurant:  ["Midtown", "Arts District", "Uptown"],
  warehouse:   ["Industrial Park", "Waterfront"],
  medical:     ["Midtown", "Uptown"],
  residential: ["Uptown", "Historic Quarter", "Waterfront"],
  "mixed-use": ["Arts District", "Downtown", "Waterfront"],
  studio:      ["Arts District", "Downtown", "Waterfront"],
};

function pick<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function pickRange<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  return pick(arr, n);
}
```

- [ ] **Step 2: Add the `assignUseTypes` function**

Below the helpers in `src/db/neo4jSeeder.ts`:

```typescript
function assignUseTypes(row: PropertyRow): string[] {
  const use = row.features?.recommendedUse;
  if (!use) return pick(USE_TYPES, 1 + Math.round(Math.random()));

  // Map "studio" to "mixed-use" since there's no studio UseType
  const primary = USE_TYPES.includes(use) ? use : "mixed-use";
  const result = [primary];

  // 50% chance of secondary
  if (Math.random() < 0.5 && SECONDARY_USE[use]) {
    const secondary = SECONDARY_USE[use];
    if (secondary !== primary) result.push(secondary);
  }
  return result;
}
```

- [ ] **Step 3: Add the `assignAmenities` function**

```typescript
function assignAmenities(row: PropertyRow): string[] {
  const featureAmenities = row.features?.amenities ?? [];
  // Match feature amenities against the Neo4j pool
  const matched = featureAmenities.filter((a) => AMENITIES.includes(a));

  if (matched.length >= 4) return matched.slice(0, 4);
  if (matched.length >= 2) {
    // Pad to 2-4 total
    const remaining = AMENITIES.filter((a) => !matched.includes(a));
    const extra = pick(remaining, Math.floor(Math.random() * 2) + (2 - matched.length));
    return [...matched, ...extra].slice(0, 4);
  }
  // Fewer than 2 matches: pad with random
  const remaining = AMENITIES.filter((a) => !matched.includes(a));
  const padCount = 2 + Math.floor(Math.random() * 3) - matched.length; // target 2-4
  return [...matched, ...pick(remaining, padCount)].slice(0, 4);
}
```

- [ ] **Step 4: Add the `assignNeighborhoods` function**

```typescript
function assignNeighborhoods(row: PropertyRow): string[] {
  const use = row.features?.recommendedUse ?? "";
  const affinity = NEIGHBORHOOD_AFFINITY[use];
  if (affinity) return pickRange(affinity, 1, 2);
  return pickRange(NEIGHBORHOODS, 1, 2);
}
```

- [ ] **Step 5: Add the `assignLandmarks` function**

```typescript
function assignLandmarks(row: PropertyRow): { name: string; type: string }[] {
  const f = row.features;
  const assigned: { name: string; type: string }[] = [];
  const usedNames = new Set<string>();

  function addCandidate(candidates: { name: string; type: string }[]) {
    const available = candidates.filter((c) => !usedNames.has(c.name));
    if (available.length > 0) {
      const chosen = available[Math.floor(Math.random() * available.length)];
      assigned.push(chosen);
      usedNames.add(chosen.name);
    }
  }

  if (f) {
    // Feature-driven picks
    if (f.nearSubway) {
      addCandidate(LANDMARKS.filter((l) => l.type === "transit"));
    }
    if (f.hasElevator && (f.estimatedCapacityPeople ?? 0) >= 200) {
      addCandidate(LANDMARKS.filter((l) => l.type === "commercial"));
    }
    if ((f.conditionRating ?? 0) >= 4) {
      addCandidate(LANDMARKS.filter((l) => l.type === "park"));
    }
    if (f.recommendedUse === "medical") {
      addCandidate(LANDMARKS.filter((l) => l.type === "medical"));
    }
  }

  // Fill to 2-3 total
  const target = 2 + Math.floor(Math.random() * 2); // 2 or 3
  while (assigned.length < target) {
    const available = LANDMARKS.filter((l) => !usedNames.has(l.name));
    if (available.length === 0) break;
    const chosen = available[Math.floor(Math.random() * available.length)];
    assigned.push(chosen);
    usedNames.add(chosen.name);
  }

  return assigned;
}
```

- [ ] **Step 6: Verify the file parses correctly**

Run: `npx tsc --noEmit src/db/neo4jSeeder.ts 2>&1 || echo "(partial file — will type-check after main function is added)"`

Expected: Warnings about unused functions are fine at this stage. No syntax errors.

- [ ] **Step 7: Commit**

```bash
git add src/db/neo4jSeeder.ts
git commit -m "feat: add concept pools and assignment helpers for Neo4j seeder"
```

---

### Task 2: Main Seed Function with Cypher Batching

**Files:**
- Modify: `src/db/neo4jSeeder.ts`

- [ ] **Step 1: Add the `main` function — Postgres fetch and Neo4j wipe**

Append to the bottom of `src/db/neo4jSeeder.ts`:

```typescript
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Neo4j Graph Seeder ===\n");

  // 1. Fetch all properties with features from Postgres
  console.log("Fetching properties from Postgres...");
  const rows = await db.query.properties.findMany({
    with: { propertyFeature: true },
  });
  console.log(`  Found ${rows.length} properties.\n`);

  const propertyRows: PropertyRow[] = rows.map((r) => ({
    id: r.id,
    features: r.propertyFeature
      ? {
          nearSubway: r.propertyFeature.nearSubway,
          needsRenovation: r.propertyFeature.needsRenovation,
          parkingAvailable: r.propertyFeature.parkingAvailable,
          hasElevator: r.propertyFeature.hasElevator,
          estimatedCapacityPeople: r.propertyFeature.estimatedCapacityPeople,
          conditionRating: r.propertyFeature.conditionRating,
          recommendedUse: r.propertyFeature.recommendedUse,
          amenities: r.propertyFeature.amenities as string[] | null,
        }
      : null,
  }));

  // 2. Connect to Neo4j and wipe
  const driver = getNeo4jDriver();
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });

  try {
    console.log("Wiping existing Neo4j data...");
    await session.run("MATCH (n) DETACH DELETE n");
    console.log("  Done.\n");
```

- [ ] **Step 2: Add constraint and index creation**

Continue inside the `try` block:

```typescript
    // 3. Create constraints and indexes
    console.log("Creating constraints and indexes...");
    const constraints = [
      "CREATE CONSTRAINT IF NOT EXISTS FOR (p:Property) REQUIRE p.laravel_id IS UNIQUE",
      "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Neighborhood) REQUIRE n.name IS UNIQUE",
      "CREATE CONSTRAINT IF NOT EXISTS FOR (l:Landmark) REQUIRE l.name IS UNIQUE",
      "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Amenity) REQUIRE a.type IS UNIQUE",
      "CREATE CONSTRAINT IF NOT EXISTS FOR (u:UseType) REQUIRE u.name IS UNIQUE",
    ];
    for (const c of constraints) {
      await session.run(c);
    }
    console.log("  Done.\n");
```

- [ ] **Step 3: Add concept node creation via UNWIND batching**

Continue inside the `try` block:

```typescript
    // 4. Create concept nodes
    console.log("Creating concept nodes...");

    await session.run(
      `UNWIND $items AS item CREATE (:Neighborhood { name: item })`,
      { items: NEIGHBORHOODS }
    );
    console.log(`  Neighborhoods: ${NEIGHBORHOODS.length}`);

    await session.run(
      `UNWIND $items AS item CREATE (:Landmark { name: item.name, type: item.type })`,
      { items: LANDMARKS }
    );
    console.log(`  Landmarks: ${LANDMARKS.length}`);

    await session.run(
      `UNWIND $items AS item CREATE (:Amenity { type: item })`,
      { items: AMENITIES }
    );
    console.log(`  Amenities: ${AMENITIES.length}`);

    await session.run(
      `UNWIND $items AS item CREATE (:UseType { name: item })`,
      { items: USE_TYPES }
    );
    console.log(`  Use types: ${USE_TYPES.length}`);
    console.log();
```

- [ ] **Step 4: Add property node creation and relationship batching**

Continue inside the `try` block:

```typescript
    // 5. Create Property nodes
    console.log("Creating property nodes...");
    await session.run(
      `UNWIND $items AS item CREATE (:Property { laravel_id: item })`,
      { items: propertyRows.map((r) => r.id) }
    );
    console.log(`  Property nodes: ${propertyRows.length}\n`);

    // 6. Build relationship data
    console.log("Computing feature-aware assignments...");
    const relNeighborhood: { pid: number; name: string }[] = [];
    const relLandmark: { pid: number; name: string }[] = [];
    const relAmenity: { pid: number; type: string }[] = [];
    const relUseType: { pid: number; name: string }[] = [];

    for (const row of propertyRows) {
      for (const n of assignNeighborhoods(row)) {
        relNeighborhood.push({ pid: row.id, name: n });
      }
      for (const l of assignLandmarks(row)) {
        relLandmark.push({ pid: row.id, name: l.name });
      }
      for (const a of assignAmenities(row)) {
        relAmenity.push({ pid: row.id, type: a });
      }
      for (const u of assignUseTypes(row)) {
        relUseType.push({ pid: row.id, name: u });
      }
    }
    console.log(`  Neighborhood edges: ${relNeighborhood.length}`);
    console.log(`  Landmark edges: ${relLandmark.length}`);
    console.log(`  Amenity edges: ${relAmenity.length}`);
    console.log(`  UseType edges: ${relUseType.length}`);
    console.log();

    // 7. Batch-create relationships
    console.log("Creating relationships...");

    await session.run(
      `UNWIND $rels AS rel
       MATCH (p:Property { laravel_id: rel.pid })
       MATCH (n:Neighborhood { name: rel.name })
       CREATE (p)-[:IN]->(n)`,
      { rels: relNeighborhood }
    );

    await session.run(
      `UNWIND $rels AS rel
       MATCH (p:Property { laravel_id: rel.pid })
       MATCH (l:Landmark { name: rel.name })
       CREATE (p)-[:NEAR]->(l)`,
      { rels: relLandmark }
    );

    await session.run(
      `UNWIND $rels AS rel
       MATCH (p:Property { laravel_id: rel.pid })
       MATCH (a:Amenity { type: rel.type })
       CREATE (p)-[:HAS_AMENITY]->(a)`,
      { rels: relAmenity }
    );

    await session.run(
      `UNWIND $rels AS rel
       MATCH (p:Property { laravel_id: rel.pid })
       MATCH (u:UseType { name: rel.name })
       CREATE (p)-[:SUITED_FOR]->(u)`,
      { rels: relUseType }
    );
    console.log("  Done.\n");
```

- [ ] **Step 5: Add summary stats and cleanup**

Continue inside the `try` block, then close the function:

```typescript
    // 8. Summary
    const totalEdges = relNeighborhood.length + relLandmark.length + relAmenity.length + relUseType.length;
    const avgEdges = (totalEdges / propertyRows.length).toFixed(1);
    console.log("=== Summary ===");
    console.log(`  Concept nodes: ${NEIGHBORHOODS.length + LANDMARKS.length + AMENITIES.length + USE_TYPES.length}`);
    console.log(`  Property nodes: ${propertyRows.length}`);
    console.log(`  Total relationships: ${totalEdges}`);
    console.log(`  Avg connections per property: ${avgEdges}`);
    console.log("\nNeo4j graph seeded successfully!");
  } finally {
    await session.close();
    await closeNeo4jDriver();
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Neo4j seed failed:", e);
  process.exit(1);
});
```

- [ ] **Step 6: Verify the complete file type-checks**

Run: `npx tsc --noEmit`

Expected: No errors related to `neo4jSeeder.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/db/neo4jSeeder.ts
git commit -m "feat: add main seed function with Cypher batching for Neo4j graph"
```

---

### Task 3: Add npm Script and Run the Seeder

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `neo4j:seed` script to `package.json`**

In the `"scripts"` section of `package.json`, add after `"db:seed"`:

```json
"neo4j:seed": "node --env-file .env --import tsx src/db/neo4jSeeder.ts"
```

- [ ] **Step 2: Verify the script is registered**

Run: `npm run --list | grep neo4j`

Expected: `neo4j:seed` appears in the output.

- [ ] **Step 3: Run the seeder against a live Neo4j instance**

Run: `npm run neo4j:seed`

Expected output (approximate):
```
=== Neo4j Graph Seeder ===

Fetching properties from Postgres...
  Found 275 properties.

Wiping existing Neo4j data...
  Done.

Creating constraints and indexes...
  Done.

Creating concept nodes...
  Neighborhoods: 8
  Landmarks: 12
  Amenities: 15
  Use types: 8

Creating property nodes...
  Property nodes: 275

Computing feature-aware assignments...
  Neighborhood edges: ~400-500
  Landmark edges: ~600-800
  Amenity edges: ~700-900
  UseType edges: ~350-450

Creating relationships...
  Done.

=== Summary ===
  Concept nodes: 43
  Property nodes: 275
  Total relationships: ~2000-2600
  Avg connections per property: ~7.5-9.5

Neo4j graph seeded successfully!
```

- [ ] **Step 4: Verify graph data in Neo4j**

Run: `node --env-file .env -e "
const neo4j = require('neo4j-driver');
const d = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD));
const s = d.session();
s.run('MATCH (n) RETURN labels(n)[0] AS label, count(*) AS cnt ORDER BY label').then(r => {
  r.records.forEach(rec => console.log(rec.get('label'), rec.get('cnt').toNumber()));
  return s.run('MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS cnt ORDER BY type');
}).then(r => {
  r.records.forEach(rec => console.log(rec.get('type'), rec.get('cnt').toNumber()));
  s.close(); d.close();
}).catch(console.error);
"`

Expected: Counts for each label (Amenity: 15, Landmark: 12, Neighborhood: 8, Property: 275, UseType: 8) and each relationship type (HAS_AMENITY, IN, NEAR, SUITED_FOR) with totals matching the summary.

- [ ] **Step 5: Verify the similarity graph works end-to-end**

Start the dev server and hit the similarity endpoint:

Run: `curl -s -X POST http://localhost:3000/api/ai/similar -H 'Content-Type: application/json' -d '{"property_id": 1, "limit": 5}' | head -c 500`

Expected: JSON response with `similarProperties` array containing scored results with `shared_concepts`.

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "feat: add neo4j:seed npm script for populating knowledge graph"
```

---

### Task 4: Verify Idempotency

**Files:** (none — verification only)

- [ ] **Step 1: Run the seeder a second time**

Run: `npm run neo4j:seed`

Expected: Same output as first run. No duplicate node errors (constraints prevent duplicates, but we wipe first anyway).

- [ ] **Step 2: Verify node counts are unchanged**

Run the same Neo4j count query from Task 3 Step 4.

Expected: Same counts as before (275 properties, 43 concept nodes). No doubling.

- [ ] **Step 3: Commit (no changes expected — just verification)**

No commit needed unless fixes were required.
