import { z } from "zod";

export const SingleScoreSchema = z.object({
  score: z.number().min(0).max(10),
  explanation: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type SingleScore = z.infer<typeof SingleScoreSchema>;

export function getScoreSystemPrompt(): string {
  return `You are an expert commercial real estate broker assistant. Score how well ONE property matches the client's requirements (0-10).
Use structured features when present; otherwise score conservatively (4-6) with lower confidence.
Return JSON only with score, explanation (2-3 sentences), strengths, weaknesses, confidence.`;
}

export function getScoreUserPrompt(
  requirements: string,
  propertyJson: string
): string {
  return `CLIENT REQUIREMENTS:\n${requirements}\n\nPROPERTY (JSON):\n${propertyJson}\n\nScore this property.`;
}
