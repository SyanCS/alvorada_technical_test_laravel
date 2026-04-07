import type { PropertySearchStateType } from "../graph.js";

/** Remove one restrictive filter per attempt (broadest search last). */
const LOOSEN_KEYS = [
  "recommended_use",
  "needs_renovation",
  "min_condition",
  "parking_required",
  "near_subway",
  "min_capacity",
  "max_capacity",
] as const;

export function createLoosenCriteriaNode() {
  return async (
    state: PropertySearchStateType
  ): Promise<Partial<PropertySearchStateType>> => {
    const attempt = state.loosenAttempts ?? 0;
    const criteria = { ...(state.criteria ?? {}) };
    const key = LOOSEN_KEYS[attempt];
    if (key) {
      delete criteria[key];
    }
    return {
      criteria,
      loosenAttempts: attempt + 1,
      candidates: [],
    };
  };
}
