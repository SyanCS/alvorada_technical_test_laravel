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

function assignAmenities(row: PropertyRow): string[] {
  const featureAmenities = row.features?.amenities ?? [];
  // Match feature amenities against the Neo4j pool
  const matched = featureAmenities.filter((a) => AMENITIES.includes(a));

  if (matched.length >= 4) return matched.slice(0, 4);
  if (matched.length >= 2) {
    // Pad to 2-4 total
    const remaining = AMENITIES.filter((a) => !matched.includes(a));
    const extra = pick(remaining, Math.max(0, Math.floor(Math.random() * 2) + (2 - matched.length)));
    return [...matched, ...extra].slice(0, 4);
  }
  // Fewer than 2 matches: pad with random
  const remaining = AMENITIES.filter((a) => !matched.includes(a));
  const padCount = 2 + Math.floor(Math.random() * 3) - matched.length; // target 2-4
  return [...matched, ...pick(remaining, padCount)].slice(0, 4);
}

function assignNeighborhoods(row: PropertyRow): string[] {
  const use = row.features?.recommendedUse ?? "";
  const affinity = NEIGHBORHOOD_AFFINITY[use];
  if (affinity) return pickRange(affinity, 1, 2);
  return pickRange(NEIGHBORHOODS, 1, 2);
}

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

  // Cap at 2-3 total
  const target = 2 + Math.floor(Math.random() * 2); // 2 or 3
  if (assigned.length > target) assigned.length = target;
  while (assigned.length < target) {
    const available = LANDMARKS.filter((l) => !usedNames.has(l.name));
    if (available.length === 0) break;
    const chosen = available[Math.floor(Math.random() * available.length)];
    assigned.push(chosen);
    usedNames.add(chosen.name);
  }

  return assigned;
}

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
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Neo4j seed failed:", e);
  process.exit(1);
});
