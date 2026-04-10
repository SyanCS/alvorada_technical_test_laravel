import { runReadQuery } from "../../../services/neo4jService.js";
import { TraversalResultSchema, type SimilarityState } from "../types.js";

// Scoring weights per relationship type
const WEIGHTS = { neighborhood: 4, landmark: 3, amenity: 2, use_type: 1 };

export function createTraverseGraphNode() {
  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    try {
      const id = state.property_id;
      const candidateLimit = (state.limit ?? 10) * 3;

      const rows = await runReadQuery(
        `MATCH (source:Property { laravel_id: $id })
         MATCH (other:Property)
         WHERE other.laravel_id <> $id
         WITH source, other,
           [(source)-[:IN]->(n:Neighborhood)<-[:IN]-(other) | n.name] AS shared_neighborhoods,
           [(source)-[:NEAR]->(l:Landmark)<-[:NEAR]-(other) | l.name] AS shared_landmarks,
           [(source)-[:HAS_AMENITY]->(a:Amenity)<-[:HAS_AMENITY]-(other) | a.type] AS shared_amenities,
           [(source)-[:SUITED_FOR]->(u:UseType)<-[:SUITED_FOR]-(other) | u.name] AS shared_use_types
         WHERE size(shared_neighborhoods) > 0
            OR size(shared_landmarks) > 0
            OR size(shared_amenities) > 0
            OR size(shared_use_types) > 0
         WITH other,
           shared_neighborhoods, shared_landmarks, shared_amenities, shared_use_types,
           (size(shared_neighborhoods) * ${WEIGHTS.neighborhood}
            + size(shared_landmarks) * ${WEIGHTS.landmark}
            + size(shared_amenities) * ${WEIGHTS.amenity}
            + size(shared_use_types) * ${WEIGHTS.use_type}) AS weighted_score
         ORDER BY weighted_score DESC
         LIMIT $limit
         RETURN other.laravel_id AS property_id,
                shared_neighborhoods, shared_landmarks, shared_amenities, shared_use_types,
                (size(shared_neighborhoods) + size(shared_landmarks) + size(shared_amenities) + size(shared_use_types)) AS raw_match_count,
                weighted_score`,
        { id, limit: candidateLimit }
      );

      const candidates = rows.map((r) => ({
        property_id: Number(r["property_id"]),
        shared_landmarks: (r["shared_landmarks"] as string[]) ?? [],
        shared_neighborhoods: (r["shared_neighborhoods"] as string[]) ?? [],
        shared_amenities: (r["shared_amenities"] as string[]) ?? [],
        shared_use_types: (r["shared_use_types"] as string[]) ?? [],
        raw_match_count: Number(r["raw_match_count"]),
        weighted_score: Number(r["weighted_score"]),
      }));

      return { traversalResult: TraversalResultSchema.parse({ candidates }) };
    } catch (e) {
      return { error: `traverseGraph: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
