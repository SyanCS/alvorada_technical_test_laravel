import { z } from "zod";

export const CypherQuerySchema = z.object({
  query: z.string().min(1),
  explanation: z.string().optional(),
});

export type CypherQueryOutput = z.infer<typeof CypherQuerySchema>;

export function getCypherGeneratorSystemPrompt(schemaSummary: string): string {
  return `You write read-only Neo4j Cypher for commercial property search.

${schemaSummary}

## Rules
1. READ ONLY: use MATCH / OPTIONAL MATCH / WHERE / WITH / RETURN / ORDER BY / LIMIT / SKIP only. Never CREATE, MERGE, DELETE, SET, REMOVE, CALL.
2. Always return property ids as \`laravel_id\` in the result — e.g. \`RETURN p.laravel_id AS laravel_id\` or \`RETURN DISTINCT p.laravel_id AS laravel_id\`.
3. Prefer matching \`Property\` nodes. You may traverse \`(n:Note)-[:ABOUT]->(p:Property)\` to find properties mentioned in notes (e.g. "subway", "parking").
4. Add LIMIT 80 at the end to cap results.
5. Use case-insensitive search with \`toLower()\` when matching text in notes or string fields.

## Example
MATCH (p:Property)
WHERE p.near_subway = true AND toLower(p.recommended_use) CONTAINS 'office'
RETURN p.laravel_id AS laravel_id
LIMIT 80`;
}

export function getCypherGeneratorUserPrompt(
  requirements: string,
  criteriaJson: string
): string {
  return `Client requirements (natural language):
"""${requirements}"""

Structured criteria (may be empty; JSON):
${criteriaJson}

Write a single Cypher query. Return JSON with key "query" (and optional "explanation").`;
}
