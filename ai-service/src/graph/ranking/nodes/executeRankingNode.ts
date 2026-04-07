import { searchProperties } from "../../../services/laravelClient.js";
import { PropertyDataSchema, type RankingState } from "../types.js";

const RETRIEVAL_LIMIT = 200;

// Maps preference key → property_feature field name in Laravel response
const PREF_TO_FEATURE: Record<string, string> = {
  near_subway: "near_subway",
  parking_available: "parking_available",
  has_elevator: "has_elevator",
  needs_renovation: "needs_renovation",
};

export function createExecuteRankingNode() {
  return async (state: RankingState): Promise<Partial<RankingState>> => {
    try {
      const q = state.validatedQuery;
      const filters = q?.corrected_filters ?? state.rankingQuery?.filters ?? {};
      const preferences = q?.corrected_preferences ?? state.rankingQuery?.preferences ?? {};

      const { properties: raw } = await searchProperties(filters, RETRIEVAL_LIMIT);

      const candidates = raw.map((r) => {
        const parsed = PropertyDataSchema.safeParse(r);
        if (!parsed.success) return null;
        const property = parsed.data;
        const features = (property.property_feature ?? {}) as Record<string, unknown>;

        const matched_fields: string[] = [];

        for (const [prefKey, featureKey] of Object.entries(PREF_TO_FEATURE)) {
          if (preferences[prefKey] !== undefined && features[featureKey] === preferences[prefKey]) {
            matched_fields.push(prefKey);
          }
        }

        if (preferences["amenities"] && Array.isArray(features["amenities"])) {
          const wanted = preferences["amenities"] as string[];
          const has = (features["amenities"] as string[]).map((s) => s.toLowerCase());
          for (const w of wanted) {
            if (has.some((h) => h.includes(w.toLowerCase()))) {
              matched_fields.push(`amenity:${w}`);
            }
          }
        }

        return { property, match_count: matched_fields.length, matched_fields };
      }).filter((c): c is NonNullable<typeof c> => c !== null);

      candidates.sort((a, b) => b.match_count - a.match_count);

      return {
        rankedCandidates: {
          candidates,
          total_checked: raw.length,
        },
      };
    } catch (e) {
      return { error: `executeRanking: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
