import neo4j, { type Driver } from "neo4j-driver";
import { config, isNeo4jConfigured } from "../config.js";

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (!isNeo4jConfigured()) {
    throw new Error("Neo4j is not configured (NEO4J_URI + NEO4J_PASSWORD)");
  }
  if (!driver) {
    driver = neo4j.driver(
      config.neo4jUri,
      neo4j.auth.basic(config.neo4jUser, config.neo4jPassword),
      { maxConnectionLifetime: 60 * 60 * 1000 }
    );
  }
  return driver;
}

export async function closeNeo4jDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

export async function runReadQuery(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, unknown>[]> {
  const d = getNeo4jDriver();
  const session = d.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

/** Internal metadata for prompts (read-only catalog calls). */
export async function fetchSchemaSummary(): Promise<string> {
  try {
    const labels = await runReadQuery("CALL db.labels() YIELD label RETURN collect(label) AS labels");
    const rels = await runReadQuery(
      "CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS types"
    );
    const l = (labels[0]?.labels as string[]) ?? [];
    const t = (rels[0]?.types as string[]) ?? [];
    return `Labels: ${l.join(", ") || "(none)"}\nRelationship types: ${t.join(", ") || "(none)"}`;
  } catch {
    return "Labels: Property, Note\nRelationship types: ABOUT";
  }
}

export async function runWriteQuery(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<void> {
  const d = getNeo4jDriver();
  const session = d.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    await session.run(cypher, params);
  } finally {
    await session.close();
  }
}
