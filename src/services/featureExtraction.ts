import { eq } from "drizzle-orm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { createLlm } from "./llm.js";

const FeatureSchema = z.object({
  near_subway: z.boolean().nullable(),
  needs_renovation: z.boolean().nullable(),
  parking_available: z.boolean().nullable(),
  has_elevator: z.boolean().nullable(),
  estimated_capacity_people: z.number().nullable(),
  floor_level: z.number().nullable(),
  condition_rating: z.number().min(1).max(5).nullable(),
  recommended_use: z.string().nullable(),
  amenities: z.array(z.string()).nullable(),
  confidence_score: z.number().min(0).max(1),
  summary: z.string(),
});

const SYSTEM_PROMPT = `You are an expert commercial real estate analyst. Analyze property research notes and extract structured features.

Rules:
- Only set a field if there is clear evidence in the notes
- Use null for missing or uncertain data
- Only set booleans when explicitly stated or strongly implied
- near_subway: within 5-10 min walk to subway/metro/transit
- condition_rating: 1=poor, 2=fair, 3=good/move-in ready, 4=very good, 5=excellent
- recommended_use: office, retail, warehouse, logistics, mixed, restaurant, medical, industrial, etc.
- amenities: list of features mentioned (kitchen, conference room, gym, security, etc.)
- confidence_score: 0.0-1.0 based on clarity of notes (detailed=0.8-1.0, vague=0.3-0.6, minimal=0.1-0.3)
- summary: concise 2-3 sentence overview`;

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

  const notesText = propertyNotes.map((n, i) => `Note ${i + 1}: ${n.note}`).join("\n");
  const userPrompt = `Property: ${property.name}\nAddress: ${property.address}\nTotal Notes: ${propertyNotes.length}\n\n${notesText}`;

  const llm = createLlm(0.3);
  const structured = llm.withStructuredOutput(FeatureSchema);

  const result = await structured.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(userPrompt),
  ]);

  // Map Zod-validated result to Drizzle insert shape
  const featureData: typeof schema.propertyFeatures.$inferInsert = {
    propertyId,
    nearSubway: result.near_subway,
    needsRenovation: result.needs_renovation,
    parkingAvailable: result.parking_available,
    hasElevator: result.has_elevator,
    estimatedCapacityPeople: result.estimated_capacity_people,
    floorLevel: result.floor_level,
    conditionRating: result.condition_rating,
    recommendedUse: result.recommended_use,
    amenities: result.amenities,
    confidenceScore: String(result.confidence_score),
    sourceNotesCount: propertyNotes.length,
    rawAiResponse: result,
    extractedAt: new Date(),
  };

  // Upsert
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
