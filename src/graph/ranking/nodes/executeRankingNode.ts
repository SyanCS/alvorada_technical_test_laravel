import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db, schema } from "../../../db/index.js";
import { PropertyDataSchema, type RankingState } from "../types.js";

const RETRIEVAL_LIMIT = 200;

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

      const conditions = [];
      if (filters.recommended_use) {
        conditions.push(sql`LOWER(${schema.propertyFeatures.recommendedUse}) LIKE ${`%${String(filters.recommended_use).toLowerCase()}%`}`);
      }
      if (filters.min_capacity) {
        conditions.push(gte(schema.propertyFeatures.estimatedCapacityPeople, Number(filters.min_capacity)));
      }
      if (filters.max_capacity) {
        conditions.push(lte(schema.propertyFeatures.estimatedCapacityPeople, Number(filters.max_capacity)));
      }
      if (filters.min_condition) {
        conditions.push(gte(schema.propertyFeatures.conditionRating, Number(filters.min_condition)));
      }
      if (filters.needs_renovation != null) {
        conditions.push(eq(schema.propertyFeatures.needsRenovation, Boolean(filters.needs_renovation)));
      }
      if (filters.near_subway != null) {
        conditions.push(eq(schema.propertyFeatures.nearSubway, Boolean(filters.near_subway)));
      }
      if (filters.parking_required != null) {
        conditions.push(eq(schema.propertyFeatures.parkingAvailable, Boolean(filters.parking_required)));
      }

      let query = db
        .select()
        .from(schema.properties)
        .innerJoin(schema.propertyFeatures, eq(schema.properties.id, schema.propertyFeatures.propertyId))
        .orderBy(desc(schema.properties.createdAt))
        .limit(RETRIEVAL_LIMIT);

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const rows = await query;

      const raw = rows.map((r) => ({
        ...r.properties,
        property_feature: r.property_features,
      }));

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
        rankedCandidates: { candidates, total_checked: raw.length },
      };
    } catch (e) {
      return { error: `executeRanking: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
