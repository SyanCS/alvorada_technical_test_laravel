import { z } from "zod";

export const AnalyticalResponseSchema = z.object({
  answer: z.string(),
  followUpQuestions: z.array(z.string()).max(5),
});

export type AnalyticalResponse = z.infer<typeof AnalyticalResponseSchema>;

export function getGenerateSystemPrompt(): string {
  return `You are a commercial real estate advisor. Summarize ranked property matches clearly for the client.
Be specific about scores and trade-offs. If there are no properties, explain why and suggest relaxing criteria.`;
}

export function getGenerateUserPrompt(
  requirements: string,
  scoredJson: string
): string {
  return `Client requirements:\n"""${requirements}"""\n\nRanked scored properties (JSON):\n${scoredJson}\n\nWrite a concise executive summary (answer) and 2-4 follow-up questions for the client.`;
}
