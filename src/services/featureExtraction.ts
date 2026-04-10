import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { extractStructuredData } from "./openrouter.js";
import { config } from "../config.js";

const SYSTEM_PROMPT = `## ROLE
You are an expert commercial real estate analyst with deep expertise in property evaluation, feature analysis, and market assessment. You specialize in extracting structured insights from unstructured property research notes.

## TASK
Analyze the provided property research notes and extract structured information about key property features, amenities, and characteristics. Your goal is to transform unstructured observations into standardized, actionable data that can be used for property scoring and comparison.

## OUTPUT FORMAT
Return a valid JSON object with the following structure (no additional text or markdown):

{
  "near_subway": boolean or null,
  "needs_renovation": boolean or null,
  "parking_available": boolean or null,
  "has_elevator": boolean or null,
  "estimated_capacity_people": integer or null,
  "floor_level": integer or null,
  "condition_rating": integer or null,
  "recommended_use": string or null,
  "amenities": array or null,
  "confidence_score": float,
  "summary": string
}

## CONSTRAINTS
1. Evidence-based extraction: Only set a field if there is clear, explicit evidence in the notes
2. Use null for missing data: If information is uncertain, ambiguous, or not mentioned, use null
3. Conservative boolean logic: Only set true/false when explicitly stated or strongly implied
4. No assumptions: Don't infer information that isn't present in the notes
5. JSON only: Return pure JSON without markdown formatting, explanations, or additional text
6. Reasonable ranges: Ensure numeric values are realistic (e.g., capacity 1-1000, floors 0-100, rating 1-5)`;

export async function extractFeaturesFromProperty(propertyId: number, forceRefresh = false) {
  const property = await db.query.properties.findFirst({
    where: eq(schema.properties.id, propertyId),
  });
  if (!property) throw new Error(`Property with ID ${propertyId} not found`);

  if (!forceRefresh) {
    const existing = await db.query.propertyFeatures.findFirst({
      where: eq(schema.propertyFeatures.propertyId, propertyId),
    });
    if (existing) return existing;
  }

  const propertyNotes = await db.query.notes.findMany({
    where: eq(schema.notes.propertyId, propertyId),
    orderBy: (n, { desc }) => [desc(n.createdAt)],
  });

  if (propertyNotes.length === 0) {
    throw new Error("No notes found for property. Add some notes before extracting features.");
  }

  if (!config.openRouterApiKey) {
    throw new Error("LLM API key is not configured. Please add LLM_API_KEY to your .env file.");
  }

  const notesText = propertyNotes.map((n, i) => `Note ${i + 1}: ${n.note}`).join("\n");
  const userPrompt = `Property Information:\n- Name: ${property.name}\n- Address: ${property.address}\n- Total Notes: ${propertyNotes.length}\n\nResearch Notes:\n${notesText}\n\nPlease analyze these notes and extract structured features in JSON format.`;

  const { data } = await extractStructuredData(SYSTEM_PROMPT, userPrompt, { temperature: 0.3, maxTokens: 800 });

  const parsed = Array.isArray(data) ? data[0] : data;

  const featureData = buildFeatureData(parsed, propertyId, propertyNotes.length);

  const existing = await db.query.propertyFeatures.findFirst({
    where: eq(schema.propertyFeatures.propertyId, propertyId),
  });

  if (existing) {
    await db.update(schema.propertyFeatures)
      .set({ ...featureData, updatedAt: new Date() })
      .where(eq(schema.propertyFeatures.propertyId, propertyId));
  } else {
    await db.insert(schema.propertyFeatures).values(featureData);
  }

  return db.query.propertyFeatures.findFirst({
    where: eq(schema.propertyFeatures.propertyId, propertyId),
  });
}

type FeatureInsert = typeof schema.propertyFeatures.$inferInsert;

function buildFeatureData(data: Record<string, unknown>, propertyId: number, notesCount: number): FeatureInsert {
  const result: FeatureInsert = {
    propertyId,
    sourceNotesCount: notesCount,
    extractedAt: new Date(),
    rawAiResponse: data,
  };

  if (typeof data.near_subway === "boolean") result.nearSubway = data.near_subway;
  if (typeof data.needs_renovation === "boolean") result.needsRenovation = data.needs_renovation;
  if (typeof data.parking_available === "boolean") result.parkingAvailable = data.parking_available;
  if (typeof data.has_elevator === "boolean") result.hasElevator = data.has_elevator;

  if (typeof data.estimated_capacity_people === "number") result.estimatedCapacityPeople = data.estimated_capacity_people;
  if (typeof data.floor_level === "number") result.floorLevel = data.floor_level;
  if (typeof data.condition_rating === "number") {
    const r = data.condition_rating as number;
    if (r >= 1 && r <= 5) result.conditionRating = r;
  }

  if (typeof data.recommended_use === "string") result.recommendedUse = data.recommended_use;
  if (Array.isArray(data.amenities)) result.amenities = data.amenities as string[];
  if (typeof data.confidence_score === "number") {
    result.confidenceScore = String(Math.min(1, Math.max(0, data.confidence_score)));
  }

  return result;
}

export function getFeatureSummary(feature: typeof schema.propertyFeatures.$inferSelect): string[] {
  const items: string[] = [];
  if (feature.nearSubway != null) items.push(feature.nearSubway ? "Near subway" : "Not near subway");
  if (feature.needsRenovation != null) items.push(feature.needsRenovation ? "Needs renovation" : "No renovation needed");
  if (feature.parkingAvailable != null) items.push(feature.parkingAvailable ? "Parking available" : "No parking");
  if (feature.hasElevator != null) items.push(feature.hasElevator ? "Has elevator" : "No elevator");
  if (feature.estimatedCapacityPeople != null) items.push(`Capacity: ${feature.estimatedCapacityPeople} people`);
  if (feature.recommendedUse != null) items.push(`Best for: ${feature.recommendedUse}`);
  if (feature.conditionRating != null) items.push(`Condition: ${feature.conditionRating}/5`);
  return items;
}
