import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

export const ConceptNodesSchema = z.object({
  landmarks: z.array(z.object({ name: z.string(), type: z.string() })),
  neighborhoods: z.array(z.object({ name: z.string() })),
  amenities: z.array(z.object({ type: z.string() })),
  use_types: z.array(z.object({ name: z.string() })),
});
export type ConceptNodes = z.infer<typeof ConceptNodesSchema>;

export const PropertyDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  property_feature: z.record(z.unknown()).nullable().optional(),
});
export type PropertyData = z.infer<typeof PropertyDataSchema>;

export const PropertyWithConceptsSchema = z.object({
  property: PropertyDataSchema,
  concept_nodes: ConceptNodesSchema,
});
export type PropertyWithConcepts = z.infer<typeof PropertyWithConceptsSchema>;

export const TraversalCandidateSchema = z.object({
  property_id: z.number(),
  shared_landmarks: z.array(z.string()),
  shared_neighborhoods: z.array(z.string()),
  shared_amenities: z.array(z.string()),
  shared_use_types: z.array(z.string()),
  raw_match_count: z.number(),
  weighted_score: z.number(),
});
export type TraversalCandidate = z.infer<typeof TraversalCandidateSchema>;

export const TraversalResultSchema = z.object({
  candidates: z.array(TraversalCandidateSchema),
});
export type TraversalResult = z.infer<typeof TraversalResultSchema>;

export const ScoredSimilaritySchema = z.object({
  property_id: z.number(),
  similarity_score: z.number().min(0).max(100),
  shared_concepts: z.array(z.string()),
});
export type ScoredSimilarity = z.infer<typeof ScoredSimilaritySchema>;

export const SimilarPropertySchema = z.object({
  property_id: z.number(),
  property_name: z.string(),
  address: z.string(),
  similarity_score: z.number(),
  explanation: z.string(),
  shared_concepts: z.array(z.string()),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});
export type SimilarProperty = z.infer<typeof SimilarPropertySchema>;

export const SimilarityAnnotation = Annotation.Root({
  property_id: Annotation<number>,
  limit: Annotation<number>,
  sourceProperty: Annotation<PropertyWithConcepts | undefined>,
  traversalResult: Annotation<TraversalResult | undefined>,
  scoredSimilarity: Annotation<ScoredSimilarity[] | undefined>,
  similarProperties: Annotation<SimilarProperty[] | undefined>,
  summary: Annotation<string | undefined>,
  error: Annotation<string | undefined>,
});

export type SimilarityState = typeof SimilarityAnnotation.State;
