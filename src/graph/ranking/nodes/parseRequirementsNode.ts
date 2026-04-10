import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { ParsedCriteriaSchema, type RankingState } from "../types.js";

const SYSTEM_PROMPT = `You are a real-estate search assistant. Extract structured search criteria from the user's requirements.
Return only fields that are explicitly or clearly implied. Omit fields that are not mentioned.
For recommended_use, normalise to one of: office, retail, warehouse, coworking, mixed, residential.
For boolean fields, only set them if the user clearly requires that feature (true) or clearly rejects it (false).`;

export function createParseRequirementsNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(ParsedCriteriaSchema);

  return async (state: RankingState): Promise<Partial<RankingState>> => {
    try {
      const criteria = await structured.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(`Client requirements: ${state.requirements}`),
      ]);
      const cleaned: Partial<typeof criteria> = {};
      for (const [k, v] of Object.entries(criteria)) {
        if (v !== null && v !== undefined) {
          (cleaned as Record<string, unknown>)[k] = v;
        }
      }
      return { criteria: cleaned as typeof criteria, error: undefined };
    } catch (e) {
      return { error: `parseRequirements: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
