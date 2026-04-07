import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { config } from "../../../config.js";
import { type SimilarProperty, type SimilarityState } from "../types.js";

const ExplanationSchema = z.object({
  explanations: z.array(z.object({
    property_id: z.number(),
    explanation: z.string(),
  })),
  summary: z.string(),
});

const SYSTEM_PROMPT = `You are a commercial real estate advisor.
Given a source property and a list of similar properties (with their shared concepts),
write a 1-sentence explanation for why each similar property resembles the source.
Then write a 1-2 sentence summary describing the overall pattern of similarity.
Be specific — mention the actual shared concepts, not generic phrases.`;

export function createGenerateExplanationNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(ExplanationSchema);

  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    try {
      const scored = state.scoredSimilarity ?? [];
      const limit = state.limit ?? 10;
      const top = scored.slice(0, limit);

      if (top.length === 0) {
        return {
          similarProperties: [],
          summary: "No similar properties found in the knowledge graph. Run extract-entities to populate concept nodes.",
        };
      }

      // Hydrate full property data for top candidates
      const ids = top.map((s) => s.property_id);
      const res = await fetch(`${config.laravelApiUrl}/properties/by-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`/properties/by-ids failed: ${res.status}`);
      const body = (await res.json()) as { data?: { properties?: unknown[] } };
      const hydratedMap = new Map<number, Record<string, unknown>>();
      for (const p of body.data?.properties ?? []) {
        const prop = p as Record<string, unknown>;
        hydratedMap.set(Number(prop["id"]), prop);
      }

      // LLM call for explanations
      const sourceInfo = `${state.sourceProperty?.property.name ?? ""} at ${state.sourceProperty?.property.address ?? ""}`;
      const candidatesJson = JSON.stringify(
        top.map((s) => ({
          property_id: s.property_id,
          similarity_score: s.similarity_score,
          shared_concepts: s.shared_concepts,
        })),
        null, 2
      );

      const out = await structured.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(
          `Source property: ${sourceInfo}\n\nSimilar candidates:\n${candidatesJson}`
        ),
      ]);

      const explanationMap = new Map(out.explanations.map((e) => [e.property_id, e.explanation]));

      const similarProperties: SimilarProperty[] = top.map((s) => {
        const hydrated = hydratedMap.get(s.property_id) as Record<string, unknown> | undefined;
        return {
          property_id: s.property_id,
          property_name: String(hydrated?.["name"] ?? `Property ${s.property_id}`),
          address: String(hydrated?.["address"] ?? ""),
          similarity_score: s.similarity_score,
          explanation: explanationMap.get(s.property_id) ?? "",
          shared_concepts: s.shared_concepts,
          latitude: hydrated?.["latitude"] != null ? Number(hydrated["latitude"]) : null,
          longitude: hydrated?.["longitude"] != null ? Number(hydrated["longitude"]) : null,
        };
      });

      return { similarProperties, summary: out.summary };
    } catch (e) {
      return { error: `generateExplanation: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
