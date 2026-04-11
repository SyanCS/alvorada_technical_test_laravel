import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { type RankingState, ScoredPropertySchema } from "../types.js";

const ResponseSchema = z.object({
  scored_properties: z.array(ScoredPropertySchema),
  answer: z.string(),
  follow_up_questions: z.array(z.string()).max(4),
});

const SYSTEM_PROMPT = `You are a commercial real estate advisor.
You will receive client requirements and a list of candidate properties ranked by how many of the client's preferences they match.
For each property, assign a score 0-10 (10 = perfect match), write a 1-2 sentence explanation, and list strengths and weaknesses.
Base scores on match_count relative to the total possible preferences, and factor in whether hard criteria are well-satisfied.
Set latitude and longitude to null — they will be filled in after your response.
Then write a concise executive summary (answer) and 2-4 follow-up questions for the client.`;

export function createGenerateResponseNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(ResponseSchema);

  return async (state: RankingState): Promise<Partial<RankingState>> => {
    if (state.error) {
      return {
        answer: `Search failed: ${state.error}`,
        followUpQuestions: ["Try rephrasing your requirements and retry."],
        scoredProperties: [],
      };
    }

    try {
      const candidates = (state.rankedCandidates?.candidates ?? [])
        .slice(0, state.resultLimit ?? 10)
        .map((c) => ({
          property_id: c.property.id,
          property_name: c.property.name,
          address: c.property.address,
          match_count: c.match_count,
          matched_fields: c.matched_fields,
          features: c.property.property_feature,
        }));

      console.log(`[generateResponse] candidates to score: ${candidates.length}`);

      const userPrompt = `Client requirements: "${state.requirements}"

Query explanation: ${state.rankingQuery?.explanation ?? "no criteria"}

Candidates (sorted by match count, best first):
${JSON.stringify(candidates, null, 2)}`;

      const out = await structured.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(userPrompt),
      ]);

      console.log(`[generateResponse] LLM returned ${out.scored_properties.length} scored, answer length: ${out.answer.length}`);

      // Reattach lat/lng from candidate data (LLM sets them to null)
      const scored = out.scored_properties.map((sp) => {
        const candidate = state.rankedCandidates?.candidates.find(
          (c) => c.property.id === sp.property_id
        );
        return {
          ...sp,
          latitude: candidate?.property.latitude ?? null,
          longitude: candidate?.property.longitude ?? null,
        };
      }) as typeof out.scored_properties;

      return {
        scoredProperties: scored,
        answer: out.answer,
        followUpQuestions: out.follow_up_questions,
      };
    } catch (e) {
      return {
        answer: `Could not generate summary: ${e instanceof Error ? e.message : String(e)}`,
        followUpQuestions: [],
        scoredProperties: [],
      };
    }
  };
}
