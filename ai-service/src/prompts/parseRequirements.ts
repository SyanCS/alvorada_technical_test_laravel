import { z } from "zod";

/** Criteria aligned with Laravel SearchPropertiesRequest + AI parsing */
export const ParsedCriteriaSchema = z.object({
  recommended_use: z.string().nullable().optional(),
  near_subway: z.boolean().nullable().optional(),
  parking_required: z.boolean().nullable().optional(),
  min_capacity: z.number().nullable().optional(),
  max_capacity: z.number().nullable().optional(),
  min_condition: z.number().min(1).max(5).nullable().optional(),
  needs_renovation: z.boolean().nullable().optional(),
});

export type ParsedCriteria = z.infer<typeof ParsedCriteriaSchema>;

export function getParseSystemPrompt(): string {
  return `You are an expert commercial real estate analyst. Extract structured search filters from the client's free-text requirements.

Rules:
- Only set a field when there is clear evidence in the text; otherwise use null.
- recommended_use: one of office, retail, warehouse, logistics, mixed, restaurant, medical, industrial, or similar short label.
- near_subway: true if they want transit/subway/metro access.
- parking_required: true if parking is required.
- min_capacity / max_capacity: headcount when mentioned.
- min_condition: minimum condition 1-5 if they ask for "move-in ready" use 3+, "excellent" use 4+.
- needs_renovation: true only if they explicitly want a fixer-upper or are OK with renovation; false if they need move-in ready.

Return structured data only.`;
}

export function getParseUserPrompt(requirements: string): string {
  return `Client requirements:\n"""${requirements}"""\n\nExtract filters as JSON matching the schema.`;
}
