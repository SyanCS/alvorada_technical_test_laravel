import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import {
  getParseSystemPrompt,
  getParseUserPrompt,
  ParsedCriteriaSchema,
} from "../../prompts/parseRequirements.js";
import type { PropertySearchStateType } from "../graph.js";

export function createParseRequirementsNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(ParsedCriteriaSchema);

  return async (
    state: PropertySearchStateType
  ): Promise<Partial<PropertySearchStateType>> => {
    try {
      const criteria = await structured.invoke([
        new SystemMessage(getParseSystemPrompt()),
        new HumanMessage(getParseUserPrompt(state.requirements)),
      ]);
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(criteria)) {
        if (v !== null && v !== undefined) cleaned[k] = v;
      }
      return { criteria: cleaned, error: undefined };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { error: `parseRequirements: ${msg}` };
    }
  };
}
