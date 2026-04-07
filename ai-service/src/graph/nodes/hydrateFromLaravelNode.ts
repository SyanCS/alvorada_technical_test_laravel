import { fetchPropertiesByIds } from "../../services/laravelClient.js";
import type { PropertySearchStateType } from "../graph.js";

export function createHydrateFromLaravelNode() {
  return async (
    state: PropertySearchStateType
  ): Promise<Partial<PropertySearchStateType>> => {
    const ids = state.neo4jPropertyIds ?? [];
    if (ids.length === 0) {
      return { candidates: [], retrievalSource: "graph" };
    }

    try {
      const properties = await fetchPropertiesByIds(ids);
      return {
        candidates: properties,
        lastRetrieveCount: properties.length,
        retrievalSource: "graph",
        totalPropertiesInDb: state.totalPropertiesInDb,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        candidates: [],
        cypherExecutionError: `hydrateFromLaravel: ${msg}`,
        retrievalSource: "graph",
      };
    }
  };
}
