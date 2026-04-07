import { type ScoredSimilarity, type SimilarityState } from "../types.js";

export function createScoreSimilarityNode() {
  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    const candidates = state.traversalResult?.candidates ?? [];
    if (candidates.length === 0) {
      return { scoredSimilarity: [] };
    }

    const maxScore = candidates[0].weighted_score; // already sorted DESC from Cypher

    const scored: ScoredSimilarity[] = candidates.map((c) => {
      const similarity_score = maxScore > 0
        ? Math.round((c.weighted_score / maxScore) * 100)
        : 0;

      const shared_concepts: string[] = [
        ...c.shared_neighborhoods.map((n) => `neighborhood: ${n}`),
        ...c.shared_landmarks.map((l) => `near: ${l}`),
        ...c.shared_amenities.map((a) => `amenity: ${a}`),
        ...c.shared_use_types.map((u) => `use type: ${u}`),
      ];

      return { property_id: c.property_id, similarity_score, shared_concepts };
    });

    return { scoredSimilarity: scored };
  };
}
