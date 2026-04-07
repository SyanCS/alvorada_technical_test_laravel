// ai-service/scripts/extract-entities.ts
/**
 * Batch entity extraction from property notes → Neo4j concept nodes.
 * Usage: npm run extract-entities
 * Requires: NEO4J_URI, NEO4J_PASSWORD, LARAVEL_API_URL, LLM_API_KEY in ai-service/.env
 */
import "../src/envBootstrap.js";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { isNeo4jConfigured, config } from "../src/config.js";
import { runWriteQuery } from "../src/services/neo4jService.js";

const ExtractedEntitiesSchema = z.object({
  landmarks: z.array(z.object({
    name: z.string(),
    type: z.enum(["transit", "retail", "park", "institution", "other"]),
  })),
  neighborhoods: z.array(z.object({ name: z.string() })),
  amenities: z.array(z.object({ type: z.string() })),
  use_types: z.array(z.object({ name: z.string() })),
});

type ApiProperty = {
  id: number;
  name?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: Array<{ id: number; note: string }>;
  property_feature?: Record<string, unknown>;
};

async function fetchAllProperties(): Promise<ApiProperty[]> {
  const url = `${config.laravelApiUrl}/properties`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /properties failed: ${res.status}. Is Laravel running at ${url}?`);
  const body = (await res.json()) as { data?: ApiProperty[] };
  return body.data ?? [];
}

async function ensureConstraints(): Promise<void> {
  const constraints = [
    `CREATE CONSTRAINT property_laravel_id IF NOT EXISTS FOR (p:Property) REQUIRE p.laravel_id IS UNIQUE`,
    `CREATE CONSTRAINT neighborhood_name IF NOT EXISTS FOR (n:Neighborhood) REQUIRE n.name IS UNIQUE`,
    `CREATE CONSTRAINT amenity_type IF NOT EXISTS FOR (a:Amenity) REQUIRE a.type IS UNIQUE`,
    `CREATE CONSTRAINT use_type_name IF NOT EXISTS FOR (u:UseType) REQUIRE u.name IS UNIQUE`,
  ];
  for (const c of constraints) {
    await runWriteQuery(c);
  }
}

async function syncPropertyNode(p: ApiProperty): Promise<void> {
  const f = p.property_feature ?? {};
  await runWriteQuery(
    `MERGE (prop:Property { laravel_id: $id })
     SET prop.name = $name, prop.address = $address,
         prop.latitude = $latitude, prop.longitude = $longitude,
         prop.near_subway = $near_subway, prop.needs_renovation = $needs_renovation,
         prop.parking_available = $parking_available, prop.has_elevator = $has_elevator,
         prop.estimated_capacity_people = $estimated_capacity_people,
         prop.condition_rating = $condition_rating,
         prop.recommended_use = $recommended_use`,
    {
      id: p.id, name: p.name ?? "", address: p.address ?? "",
      latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      near_subway: f["near_subway"] ?? null, needs_renovation: f["needs_renovation"] ?? null,
      parking_available: f["parking_available"] ?? null, has_elevator: f["has_elevator"] ?? null,
      estimated_capacity_people: f["estimated_capacity_people"] ?? null,
      condition_rating: f["condition_rating"] ?? null,
      recommended_use: f["recommended_use"] ?? null,
    }
  );
}

async function extractAndWriteEntities(
  llm: ChatOpenAI,
  p: ApiProperty
): Promise<void> {
  const notes = p.notes ?? [];
  if (notes.length === 0) return;

  const noteText = notes.map((n) => n.note).join("\n---\n").slice(0, 6000);

  const structured = llm.withStructuredOutput(ExtractedEntitiesSchema);
  const entities = await structured.invoke([
    new SystemMessage(
      `Extract real-world entities mentioned in commercial property research notes.
Return landmarks (transit stations, retail centres, parks, institutions), neighbourhoods,
physical amenities (rooftop, loading_dock, freight_elevator, etc.), and likely business use types.
Only include entities that are clearly mentioned. Normalise names to title case.`
    ),
    new HumanMessage(`Property: ${p.name ?? p.address}\n\nNotes:\n${noteText}`),
  ]);

  for (const l of entities.landmarks) {
    await runWriteQuery(
      `MERGE (l:Landmark { name: $name, type: $type })
       WITH l MATCH (p:Property { laravel_id: $id }) MERGE (p)-[:NEAR]->(l)`,
      { name: l.name, type: l.type, id: p.id }
    );
  }
  for (const n of entities.neighborhoods) {
    await runWriteQuery(
      `MERGE (n:Neighborhood { name: $name })
       WITH n MATCH (p:Property { laravel_id: $id }) MERGE (p)-[:IN]->(n)`,
      { name: n.name, id: p.id }
    );
  }
  for (const a of entities.amenities) {
    await runWriteQuery(
      `MERGE (a:Amenity { type: $type })
       WITH a MATCH (p:Property { laravel_id: $id }) MERGE (p)-[:HAS_AMENITY]->(a)`,
      { type: a.type, id: p.id }
    );
  }
  for (const u of entities.use_types) {
    await runWriteQuery(
      `MERGE (u:UseType { name: $name })
       WITH u MATCH (p:Property { laravel_id: $id }) MERGE (p)-[:SUITED_FOR]->(u)`,
      { name: u.name, id: p.id }
    );
  }
}

async function main(): Promise<void> {
  if (!isNeo4jConfigured()) {
    console.error("Set NEO4J_URI and NEO4J_PASSWORD in ai-service/.env");
    process.exit(1);
  }
  if (!config.openRouterApiKey) {
    console.error("Set LLM_API_KEY or OPENROUTER_API_KEY in ai-service/.env");
    process.exit(1);
  }

  const llm = new ChatOpenAI({
    apiKey: config.openRouterApiKey,
    modelName: config.model,
    temperature: 0,
    maxTokens: 800,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": config.httpReferer, "X-Title": config.xTitle },
    },
  });

  console.log("Fetching properties from Laravel...");
  const properties = await fetchAllProperties();
  console.log(`Found ${properties.length} properties. Ensuring Neo4j constraints...`);
  await ensureConstraints();

  let synced = 0, extracted = 0, skipped = 0;

  for (const p of properties) {
    await syncPropertyNode(p);
    if ((p.notes ?? []).length > 0) {
      await extractAndWriteEntities(llm, p);
      extracted++;
    } else {
      skipped++;
    }
    synced++;
    if (synced % 10 === 0) {
      console.log(`  ${synced}/${properties.length} — extracted: ${extracted}, skipped (no notes): ${skipped}`);
    }
  }

  console.log(`Done. Synced: ${synced}, entity-extracted: ${extracted}, no-notes: ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
