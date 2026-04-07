import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { fetchSchemaSummary } from "../../services/neo4jService.js";
import {
  CypherQuerySchema,
  getCypherGeneratorSystemPrompt,
  getCypherGeneratorUserPrompt,
} from "../../prompts/graph/cypherGenerator.js";
import type { PropertySearchStateType } from "../graph.js";

export function createCypherGeneratorNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(CypherQuerySchema);

  return async (
    state: PropertySearchStateType
  ): Promise<Partial<PropertySearchStateType>> => {
    try {
      const schemaSummary = await fetchSchemaSummary();
      const system = getCypherGeneratorSystemPrompt(schemaSummary);
      const criteriaJson = JSON.stringify(state.criteria ?? {}, null, 2);
      const user = getCypherGeneratorUserPrompt(state.requirements, criteriaJson);

      const out = await structured.invoke([
        new SystemMessage(system),
        new HumanMessage(user),
      ]);

      return {
        cypherQuery: out.query.trim(),
        cypherExplanation: out.explanation,
        cypherCorrectionAttempts: 0,
        needsCypherCorrection: false,
        cypherExecutionError: undefined,
        cypherValidationError: undefined,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        error: `cypherGenerator: ${msg}`,
        needsCypherCorrection: false,
      };
    }
  };
}
