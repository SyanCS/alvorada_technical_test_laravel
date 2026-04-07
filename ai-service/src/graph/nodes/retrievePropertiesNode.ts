import { fetchPropertiesCount, searchProperties } from "../../services/laravelClient.js";
import type { PropertySearchStateType } from "../graph.js";

export function createRetrievePropertiesNode(retrievalLimit: number) {
  return async (
    state: PropertySearchStateType
  ): Promise<Partial<PropertySearchStateType>> => {
    try {
      const totalPropertiesInDb = await fetchPropertiesCount();
      const criteria = state.criteria ?? {};
      const { properties, count } = await searchProperties(criteria, retrievalLimit);
      return {
        candidates: properties,
        totalPropertiesInDb,
        lastRetrieveCount: count,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { error: `retrieveProperties: ${msg}`, candidates: [] };
    }
  };
}
