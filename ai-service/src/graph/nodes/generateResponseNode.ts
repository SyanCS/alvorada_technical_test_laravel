import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import {
  AnalyticalResponseSchema,
  getGenerateSystemPrompt,
  getGenerateUserPrompt,
} from "../../prompts/generateResponse.js";
import type { PropertySearchStateType } from "../graph.js";

export function createGenerateResponseNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(AnalyticalResponseSchema);

  return async (
    state: PropertySearchStateType
  ): Promise<Partial<PropertySearchStateType>> => {
    try {
      if (state.error?.startsWith("parseRequirements")) {
        return {
          answer: `Could not parse requirements: ${state.error}`,
          followUpQuestions: ["Try rephrasing your client requirements in clearer terms."],
        };
      }
      if (state.error?.startsWith("retrieve")) {
        return {
          answer: `Search failed: ${state.error}. Check that Laravel API is reachable at the configured LARAVEL_API_URL.`,
          followUpQuestions: [],
        };
      }
      if (state.error?.startsWith("scoreCandidates")) {
        return {
          answer: `Scoring step failed: ${state.error}`,
          followUpQuestions: ["Retry with fewer properties or check LLM_API_KEY / OPENROUTER_API_KEY for OpenRouter."],
        };
      }
      if (state.error?.startsWith("cypherGenerator")) {
        return {
          answer: `Could not build graph query: ${state.error}`,
          followUpQuestions: ["Check OPENROUTER_API_KEY and try again."],
        };
      }
      const scored = state.scoredProperties ?? [];
      const userPrompt = getGenerateUserPrompt(
        state.requirements,
        JSON.stringify(scored, null, 2)
      );
      const out = await structured.invoke([
        new SystemMessage(getGenerateSystemPrompt()),
        new HumanMessage(userPrompt),
      ]);
      return {
        answer: out.answer,
        followUpQuestions: out.followUpQuestions ?? [],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        answer: `Could not generate summary: ${msg}`,
        followUpQuestions: [],
      };
    }
  };
}
