import { z } from "zod";

export const CypherCorrectionSchema = z.object({
  query: z.string().min(1),
});

export function getCypherCorrectionSystemPrompt(schemaSummary: string): string {
  return `You fix read-only Neo4j Cypher queries that failed validation or execution.

${schemaSummary}

Rules: same as generation — MATCH/OPTIONAL MATCH only, RETURN p.laravel_id AS laravel_id, LIMIT 80, no CREATE/MERGE/DELETE/SET/CALL.`;
}

export function getCypherCorrectionUserPrompt(
  failedQuery: string,
  errorMessage: string,
  requirements: string
): string {
  return `The following Cypher failed.

Error:
${errorMessage}

Failed query:
${failedQuery}

Original requirements:
"""${requirements}"""

Return a corrected single query as JSON { "query": "..." }.`;
}
