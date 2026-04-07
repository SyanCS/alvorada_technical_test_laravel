import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { fetchSchemaSummary } from "../../services/neo4jService.js";
import {
  CypherCorrectionSchema,
  getCypherCorrectionSystemPrompt,
  getCypherCorrectionUserPrompt,
} from "../../prompts/graph/cypherCorrection.js";
import type { PropertySearchStateType } from "../graph.js";

export function createCypherCorrectionNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(CypherCorrectionSchema);

  return async (
    state: PropertySearchStateType
  ): Promise<Partial<PropertySearchStateType>> => {
    const prev = state.cypherQuery ?? "";
    const err =
      state.cypherValidationError ??
      state.cypherExecutionError ??
      "Unknown Cypher error";
    const attempts = (state.cypherCorrectionAttempts ?? 0) + 1;

    try {
      const schemaSummary = await fetchSchemaSummary();
      const system = getCypherCorrectionSystemPrompt(schemaSummary);
      const user = getCypherCorrectionUserPrompt(prev, err, state.requirements);

      const out = await structured.invoke([
        new SystemMessage(system),
        new HumanMessage(user),
      ]);

      return {
        cypherQuery: out.query.trim(),
        cypherCorrectionAttempts: attempts,
        cypherValidationError: undefined,
        cypherExecutionError: undefined,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        cypherCorrectionAttempts: attempts,
        cypherExecutionError: `cypherCorrection failed: ${msg}`,
        needsCypherCorrection: false,
      };
    }
  };
}
