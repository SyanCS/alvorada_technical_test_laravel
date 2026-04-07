/**
 * Sync Laravel properties + notes + features into Neo4j for Graph RAG.
 * Usage: npm run sync-graph  (requires .env with NEO4J_* and LARAVEL_API_URL)
 */
import "../src/envBootstrap.js";
import { isNeo4jConfigured } from "../src/config.js";
import { runWriteQuery } from "../src/services/neo4jService.js";

const LARAVEL = (process.env.LARAVEL_API_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
const NOTE_MAX = 8000;

type ApiProperty = {
  id: number;
  name?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: Array<{ id: number; property_id: number; note: string }>;
  property_feature?: Record<string, unknown>;
  propertyFeature?: Record<string, unknown>;
};

async function fetchAllProperties(): Promise<ApiProperty[]> {
  const url = `${LARAVEL}/properties`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Cannot reach Laravel at ${url} (${msg}).\n` +
        "Start the API first, e.g. from the project root: php artisan serve --host=127.0.0.1 --port=8000\n" +
        "Or set LARAVEL_API_URL in ai-service/.env to your API base URL (must include /api if routes are prefixed)."
    );
  }
  if (!res.ok) {
    const snippet = (await res.text()).slice(0, 800);
    throw new Error(`GET /properties failed: ${res.status}${snippet ? ` — ${snippet}` : ""}`);
  }
  const body = (await res.json()) as { data?: ApiProperty[] };
  const rows = body.data ?? [];
  return rows;
}

async function ensureConstraints(): Promise<void> {
  await runWriteQuery(`
    CREATE CONSTRAINT property_laravel_id IF NOT EXISTS
    FOR (p:Property) REQUIRE p.laravel_id IS UNIQUE
  `);
  await runWriteQuery(`
    CREATE CONSTRAINT note_laravel_id IF NOT EXISTS
    FOR (n:Note) REQUIRE n.laravel_id IS UNIQUE
  `);
}

function flattenFeatures(p: ApiProperty): Record<string, unknown> {
  const raw = p.property_feature ?? p.propertyFeature ?? {};
  return {
    near_subway: raw.near_subway ?? null,
    needs_renovation: raw.needs_renovation ?? null,
    parking_available: raw.parking_available ?? null,
    has_elevator: raw.has_elevator ?? null,
    estimated_capacity_people: raw.estimated_capacity_people ?? null,
    floor_level: raw.floor_level ?? null,
    condition_rating: raw.condition_rating ?? null,
    recommended_use: raw.recommended_use ?? null,
  };
}

async function syncProperty(p: ApiProperty): Promise<void> {
  const f = flattenFeatures(p);
  await runWriteQuery(
    `
    MERGE (prop:Property { laravel_id: $laravel_id })
    SET prop.name = $name,
        prop.address = $address,
        prop.latitude = $latitude,
        prop.longitude = $longitude,
        prop.near_subway = $near_subway,
        prop.needs_renovation = $needs_renovation,
        prop.parking_available = $parking_available,
        prop.has_elevator = $has_elevator,
        prop.estimated_capacity_people = $estimated_capacity_people,
        prop.floor_level = $floor_level,
        prop.condition_rating = $condition_rating,
        prop.recommended_use = $recommended_use
    `,
    {
      laravel_id: p.id,
      name: p.name ?? "",
      address: p.address ?? "",
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      near_subway: f.near_subway,
      needs_renovation: f.needs_renovation,
      parking_available: f.parking_available,
      has_elevator: f.has_elevator,
      estimated_capacity_people: f.estimated_capacity_people,
      floor_level: f.floor_level,
      condition_rating: f.condition_rating,
      recommended_use: f.recommended_use,
    }
  );

  const notes = p.notes ?? [];
  for (const note of notes) {
    const text = (note.note ?? "").slice(0, NOTE_MAX);
    await runWriteQuery(
      `
      MERGE (n:Note { laravel_id: $note_id })
      SET n.text = $text
      WITH n
      MATCH (prop:Property { laravel_id: $property_id })
      MERGE (n)-[:ABOUT]->(prop)
      `,
      {
        note_id: note.id,
        text,
        property_id: p.id,
      }
    );
  }
}

async function main(): Promise<void> {
  if (!isNeo4jConfigured()) {
    console.error("Set NEO4J_URI and NEO4J_PASSWORD in .env");
    process.exit(1);
  }
  console.log("Fetching properties from Laravel...");
  const properties = await fetchAllProperties();
  console.log(`Syncing ${properties.length} properties to Neo4j...`);
  await ensureConstraints();
  let n = 0;
  for (const p of properties) {
    await syncProperty(p);
    n += 1;
    if (n % 10 === 0) console.log(`  ... ${n}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
