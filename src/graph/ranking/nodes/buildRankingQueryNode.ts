// ai-service/src/graph/ranking/nodes/buildRankingQueryNode.ts
import type { RankingState } from "../types.js";

// Hard filters → search criteria (must match)
const HARD_FILTER_KEYS = ["recommended_use", "min_capacity", "max_capacity", "min_condition"] as const;

// Soft preferences → counted locally after retrieval (nice to have)
const PREFERENCE_KEYS = ["near_subway", "parking_available", "has_elevator", "needs_renovation"] as const;

export function createBuildRankingQueryNode() {
  return async (state: RankingState): Promise<Partial<RankingState>> => {
    const c = state.criteria ?? {};
    const filters: Record<string, unknown> = {};
    const preferences: Record<string, unknown> = {};

    for (const key of HARD_FILTER_KEYS) {
      if (c[key] !== undefined) filters[key] = c[key];
    }
    for (const key of PREFERENCE_KEYS) {
      if (c[key] !== undefined) preferences[key] = c[key];
    }
    if (c.amenities && c.amenities.length > 0) {
      preferences["amenities"] = c.amenities;
    }

    const parts: string[] = [];
    if (filters["recommended_use"]) parts.push(`use: ${filters["recommended_use"]}`);
    if (filters["min_capacity"]) parts.push(`min capacity: ${filters["min_capacity"]}`);
    if (filters["max_capacity"]) parts.push(`max capacity: ${filters["max_capacity"]}`);
    if (filters["min_condition"]) parts.push(`min condition: ${filters["min_condition"]}/5`);
    if (Object.keys(preferences).length > 0) {
      parts.push(`preferences: ${Object.keys(preferences).join(", ")}`);
    }

    console.log(`[buildRankingQuery] filters:`, JSON.stringify(filters));
    console.log(`[buildRankingQuery] preferences:`, JSON.stringify(preferences));

    return {
      rankingQuery: {
        filters,
        preferences,
        explanation: parts.length > 0 ? parts.join("; ") : "no specific criteria",
      },
    };
  };
}
