// ai-service/src/graph/ranking/nodes/validateQueryNode.ts
import type { RankingState } from "../types.js";

const BOOLEAN_FIELDS = new Set(["near_subway", "needs_renovation", "parking_available", "has_elevator"]);
const NUMBER_FIELDS = new Set(["min_capacity", "max_capacity", "min_condition"]);
const STRING_FIELDS = new Set(["recommended_use"]);
const KNOWN_FIELDS = new Set([...BOOLEAN_FIELDS, ...NUMBER_FIELDS, ...STRING_FIELDS, "amenities"]);

export function createValidateQueryNode() {
  return async (state: RankingState): Promise<Partial<RankingState>> => {
    const q = state.rankingQuery;
    if (!q) {
      return { validatedQuery: { valid: false, issues: ["no ranking query built"] } };
    }

    const issues: string[] = [];
    const corrected_filters = { ...q.filters };
    const corrected_preferences = { ...q.preferences };

    const allFields = { ...q.filters, ...q.preferences };
    for (const [k, v] of Object.entries(allFields)) {
      if (!KNOWN_FIELDS.has(k)) {
        issues.push(`unknown field: ${k} — removed`);
        delete corrected_filters[k];
        delete corrected_preferences[k];
        continue;
      }
      if (BOOLEAN_FIELDS.has(k) && typeof v !== "boolean") {
        issues.push(`${k} must be boolean, got ${typeof v}`);
      }
      if (NUMBER_FIELDS.has(k) && typeof v !== "number") {
        issues.push(`${k} must be number, got ${typeof v}`);
      }
      if (k === "min_condition" && typeof v === "number" && (v < 1 || v > 5)) {
        issues.push(`min_condition must be 1-5, got ${v}`);
        corrected_filters["min_condition"] = Math.max(1, Math.min(5, v));
      }
    }

    const hasFilters = Object.keys(corrected_filters).length > 0;
    const hasPrefs = Object.keys(corrected_preferences).length > 0;
    if (!hasFilters && !hasPrefs) {
      issues.push("query has no filters or preferences — will return all properties unranked");
    }

    return {
      validatedQuery: {
        valid: true, // we correct and continue rather than hard-fail
        corrected_filters,
        corrected_preferences,
        issues: issues.length > 0 ? issues : undefined,
      },
    };
  };
}
