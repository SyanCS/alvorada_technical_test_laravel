import { db, schema } from "../db/index.js";
import { extractStructuredData } from "./openrouter.js";
import { config } from "../config.js";

const SCORING_SYSTEM_PROMPT = `You are an expert commercial real estate broker assistant with deep knowledge of property evaluation and client-property matching. Your task is to score how well a property matches a client's requirements using both basic property information and AI-extracted structured features.

## SCORING SCALE
Provide a score from 0 to 10:
- 0-3: Poor match
- 4-5: Fair match
- 6-7: Good match
- 8-9: Excellent match
- 10: Perfect match

## OUTPUT FORMAT
Return a valid JSON object (no markdown, no additional text):
{
  "score": float (0.0 to 10.0),
  "explanation": string (2-3 sentences),
  "strengths": array of strings,
  "weaknesses": array of strings,
  "confidence": float (0.0 to 1.0)
}`;

type PropertyRow = typeof schema.properties.$inferSelect;
type FeatureRow = typeof schema.propertyFeatures.$inferSelect;

export async function scoreProperty(property: PropertyRow, features: FeatureRow | null, clientRequirements: string) {
  const userPrompt = buildScoringUserPrompt(property, features, clientRequirements);
  const { data } = await extractStructuredData(SCORING_SYSTEM_PROMPT, userPrompt, { temperature: 0.1, maxTokens: 800 });
  return parseScoreResponse(data, property, features);
}

function buildScoringUserPrompt(property: PropertyRow, features: FeatureRow | null, requirements: string): string {
  let info = `PROPERTY NAME: ${property.name}\nADDRESS: ${property.address}\n`;
  const extra = property.extraField as Record<string, unknown> | null;
  if (extra?.city) info += `CITY: ${extra.city}\n`;
  if (extra?.state) info += `STATE: ${extra.state}\n`;

  if (features) {
    info += "\nAI-EXTRACTED FEATURES:\n";
    info += `Near Subway: ${features.nearSubway == null ? "UNKNOWN" : features.nearSubway ? "YES" : "NO"}\n`;
    info += `Recommended Use: ${features.recommendedUse ?? "UNKNOWN"}\n`;
    info += `Capacity: ${features.estimatedCapacityPeople ?? "UNKNOWN"}\n`;
    info += `Condition: ${features.conditionRating != null ? `${features.conditionRating}/5` : "UNKNOWN"}\n`;
    info += `Needs Renovation: ${features.needsRenovation == null ? "UNKNOWN" : features.needsRenovation ? "YES" : "NO"}\n`;
    info += `Parking: ${features.parkingAvailable == null ? "UNKNOWN" : features.parkingAvailable ? "AVAILABLE" : "NOT AVAILABLE"}\n`;
    info += `Elevator: ${features.hasElevator == null ? "UNKNOWN" : features.hasElevator ? "YES" : "NO"}\n`;
    const amenities = features.amenities as string[] | null;
    info += `Amenities: ${amenities?.length ? amenities.join(", ") : "NONE LISTED"}\n`;
  } else {
    info += "\nNO EXTRACTED FEATURES AVAILABLE\n";
  }

  return `PROPERTY DETAILS:\n${info}\n\nCLIENT REQUIREMENTS:\n${requirements}\n\nAnalyze and score in JSON format.`;
}

function parseScoreResponse(data: Record<string, unknown>, property: PropertyRow, features: FeatureRow | null) {
  const score = Math.min(10, Math.max(0, Number(data.score ?? 5)));
  const confidence = Math.min(1, Math.max(0, Number(data.confidence ?? 0.7)));

  return {
    property_id: property.id,
    property_name: property.name,
    address: property.address,
    score: Math.round(score * 10) / 10,
    explanation: String(data.explanation ?? "No explanation provided"),
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
    confidence: Math.round(confidence * 100) / 100,
    latitude: Number(property.latitude),
    longitude: Number(property.longitude),
  };
}
