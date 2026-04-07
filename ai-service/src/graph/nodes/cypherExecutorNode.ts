import { assertReadOnlyCypher } from "../../services/cypherGuard.js";
import { runReadQuery } from "../../services/neo4jService.js";
import { rowsToLaravelIds } from "./cypherUtils.js";
import type { PropertySearchStateType } from "../graph.js";

const MAX_CORRECTION_ATTEMPTS = 2;

export function createCypherExecutorNode() {
  return async (
    state: PropertySearchStateType
  ): Promise<Partial<PropertySearchStateType>> => {
    const q = state.cypherQuery?.trim();
    const correctionAttempts = state.cypherCorrectionAttempts ?? 0;

    if (!q) {
      return {
        neo4jPropertyIds: [],
        needsCypherCorrection: false,
        graphRows: [],
        cypherExecutionError: "No Cypher query in state",
      };
    }

    const guard = assertReadOnlyCypher(q);
    if (!guard.ok) {
      const canCorrect = correctionAttempts < MAX_CORRECTION_ATTEMPTS;
      return {
        needsCypherCorrection: canCorrect,
        cypherValidationError: guard.reason,
        cypherExecutionError: guard.reason,
        neo4jPropertyIds: [],
        graphRows: [],
      };
    }

    try {
      const graphRows = await runReadQuery(q);
      const ids = rowsToLaravelIds(graphRows);
      return {
        graphRows,
        neo4jPropertyIds: ids,
        needsCypherCorrection: false,
        cypherExecutionError: undefined,
        cypherValidationError: undefined,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const canCorrect = correctionAttempts < MAX_CORRECTION_ATTEMPTS;
      return {
        needsCypherCorrection: canCorrect,
        cypherExecutionError: msg,
        neo4jPropertyIds: [],
        graphRows: [],
      };
    }
  };
}
