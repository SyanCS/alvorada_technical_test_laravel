import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import {
  getScoreSystemPrompt,
  getScoreUserPrompt,
  SingleScoreSchema,
} from "../../prompts/scoreCandidate.js";
import type { PropertySearchStateType } from "../graph.js";

function normalizeProperty(raw: unknown): Record<string, unknown> {
  const p = raw as Record<string, unknown>;
  const features =
    (p.property_feature as Record<string, unknown> | undefined) ??
    (p.propertyFeature as Record<string, unknown> | undefined);
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    features: features ?? null,
  };
}

export function createScoreCandidatesNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(SingleScoreSchema);

  return async (
    state: PropertySearchStateType
  ): Promise<Partial<PropertySearchStateType>> => {
    const reqs = state.requirements;
    const candidates = state.candidates ?? [];
    const limit = state.resultLimit ?? 10;

    try {
      const scored = await Promise.all(
        candidates.map(async (raw) => {
          const prop = normalizeProperty(raw);
          const propertyJson = JSON.stringify(prop, null, 2);
          const score = await structured.invoke([
            new SystemMessage(getScoreSystemPrompt()),
            new HumanMessage(getScoreUserPrompt(reqs, propertyJson)),
          ]);
          return {
            property_id: prop.id,
            property_name: prop.name,
            address: prop.address,
            score: Math.round(score.score * 10) / 10,
            explanation: score.explanation,
            strengths: score.strengths,
            weaknesses: score.weaknesses,
            confidence: Math.round(score.confidence * 100) / 100,
            latitude: prop.latitude,
            longitude: prop.longitude,
          };
        })
      );

      scored.sort((a, b) => (b.score as number) - (a.score as number));
      const sliced = scored.slice(0, limit);

      return { scoredProperties: sliced };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { error: `scoreCandidates: ${msg}`, scoredProperties: [] };
    }
  };
}
