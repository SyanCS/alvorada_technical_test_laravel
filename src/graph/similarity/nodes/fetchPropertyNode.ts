import { eq } from "drizzle-orm";
import { db, schema } from "../../../db/index.js";
import { runReadQuery } from "../../../services/neo4jService.js";
import { PropertyDataSchema, ConceptNodesSchema, type SimilarityState } from "../types.js";

export function createFetchPropertyNode() {
  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    try {
      const row = await db.query.properties.findFirst({
        where: eq(schema.properties.id, state.property_id),
        with: { propertyFeature: true },
      });
      if (!row) throw new Error(`Property ${state.property_id} not found`);

      const property = PropertyDataSchema.parse({
        id: row.id,
        name: row.name,
        address: row.address,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        property_feature: row.propertyFeature,
      });

      const rows = await runReadQuery(
        `MATCH (p:Property { property_id: $id })
         RETURN
           [(p)-[:NEAR]->(l:Landmark) | { name: l.name, type: l.type }] AS landmarks,
           [(p)-[:IN]->(n:Neighborhood) | { name: n.name }] AS neighborhoods,
           [(p)-[:HAS_AMENITY]->(a:Amenity) | { type: a.type }] AS amenities,
           [(p)-[:SUITED_FOR]->(u:UseType) | { name: u.name }] AS use_types`,
        { id: state.property_id }
      );

      const neo4jRow = rows[0] ?? {};
      const concept_nodes = ConceptNodesSchema.parse({
        landmarks: neo4jRow["landmarks"] ?? [],
        neighborhoods: neo4jRow["neighborhoods"] ?? [],
        amenities: neo4jRow["amenities"] ?? [],
        use_types: neo4jRow["use_types"] ?? [],
      });

      return { sourceProperty: { property, concept_nodes } };
    } catch (e) {
      return { error: `fetchProperty: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
