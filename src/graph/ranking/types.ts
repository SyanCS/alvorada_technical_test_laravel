// ai-service/src/graph/ranking/types.ts
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

export const ParsedCriteriaSchema = z.object({
  recommended_use: z.string().optional(),
  min_capacity: z.number().optional(),
  max_capacity: z.number().optional(),
  min_condition: z.number().min(1).max(5).optional(),
  near_subway: z.boolean().optional(),
  parking_available: z.boolean().optional(),
  has_elevator: z.boolean().optional(),
  needs_renovation: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
});
export type ParsedCriteria = z.infer<typeof ParsedCriteriaSchema>;

export const RankingQuerySchema = z.object({
  filters: z.record(z.unknown()),
  preferences: z.record(z.unknown()),
  explanation: z.string(),
});
export type RankingQuery = z.infer<typeof RankingQuerySchema>;

export const ValidatedQuerySchema = z.object({
  valid: z.boolean(),
  corrected_filters: z.record(z.unknown()).optional(),
  corrected_preferences: z.record(z.unknown()).optional(),
  issues: z.array(z.string()).optional(),
});
export type ValidatedQuery = z.infer<typeof ValidatedQuerySchema>;

export const PropertyDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  notes: z.array(z.object({ id: z.number(), note: z.string() })).optional(),
  property_feature: z.record(z.unknown()).nullable().optional(),
});
export type PropertyData = z.infer<typeof PropertyDataSchema>;

export const RankedCandidateSchema = z.object({
  property: PropertyDataSchema,
  match_count: z.number(),
  matched_fields: z.array(z.string()),
});
export type RankedCandidate = z.infer<typeof RankedCandidateSchema>;

export const RankedCandidatesSchema = z.object({
  candidates: z.array(RankedCandidateSchema),
  total_checked: z.number(),
});
export type RankedCandidates = z.infer<typeof RankedCandidatesSchema>;

export const ScoredPropertySchema = z.object({
  property_id: z.number(),
  property_name: z.string(),
  address: z.string(),
  score: z.number().min(0).max(10),
  explanation: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});
export type ScoredProperty = z.infer<typeof ScoredPropertySchema>;

export const RankingAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  resultLimit: Annotation<number>,
  criteria: Annotation<ParsedCriteria | undefined>,
  rankingQuery: Annotation<RankingQuery | undefined>,
  validatedQuery: Annotation<ValidatedQuery | undefined>,
  rankedCandidates: Annotation<RankedCandidates | undefined>,
  scoredProperties: Annotation<ScoredProperty[] | undefined>,
  answer: Annotation<string | undefined>,
  followUpQuestions: Annotation<string[] | undefined>,
  error: Annotation<string | undefined>,
});

export type RankingState = typeof RankingAnnotation.State;
