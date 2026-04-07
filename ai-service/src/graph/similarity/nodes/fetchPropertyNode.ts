import { config } from "../../../config.js";
import { runReadQuery } from "../../../services/neo4jService.js";
import { PropertyDataSchema, ConceptNodesSchema, type SimilarityState } from "../types.js";

export function createFetchPropertyNode() {
  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    try {
      // Fetch property data from Laravel
      const res = await fetch(`${config.laravelApiUrl}/properties/${state.property_id}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`GET /properties/${state.property_id} failed: ${res.status}`);
      const body = (await res.json()) as { data?: unknown };
      const property = PropertyDataSchema.parse(body.data);

      // Fetch concept nodes from Neo4j
      const rows = await runReadQuery(
        `MATCH (p:Property { laravel_id: $id })
         RETURN
           [(p)-[:NEAR]->(l:Landmark) | { name: l.name, type: l.type }] AS landmarks,
           [(p)-[:IN]->(n:Neighborhood) | { name: n.name }] AS neighborhoods,
           [(p)-[:HAS_AMENITY]->(a:Amenity) | { type: a.type }] AS amenities,
           [(p)-[:SUITED_FOR]->(u:UseType) | { name: u.name }] AS use_types`,
        { id: state.property_id }
      );

      const row = rows[0] ?? {};
      const concept_nodes = ConceptNodesSchema.parse({
        landmarks: row["landmarks"] ?? [],
        neighborhoods: row["neighborhoods"] ?? [],
        amenities: row["amenities"] ?? [],
        use_types: row["use_types"] ?? [],
      });

      return { sourceProperty: { property, concept_nodes } };
    } catch (e) {
      return { error: `fetchProperty: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
