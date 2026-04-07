/**
 * Reject Cypher that could mutate data or invoke procedures (except safe read paths).
 */
const WRITE_OR_ADMIN =
  /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|CALL|LOAD\s+CSV|FOREACH|DROP|ALTER|GRANT|DENY|REVOKE|ASSIGN)\b/i;

export function assertReadOnlyCypher(cypher: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = cypher.trim();
  if (!trimmed) {
    return { ok: false, reason: "Empty query" };
  }

  const withoutLineComments = trimmed
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

  const parts = withoutLineComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return { ok: false, reason: "Multiple Cypher statements are not allowed" };
  }

  if (WRITE_OR_ADMIN.test(withoutLineComments)) {
    return { ok: false, reason: "Query must be read-only (no CREATE/MERGE/DELETE/SET/CALL/etc.)" };
  }

  if (!/\bMATCH\b/i.test(withoutLineComments) && !/\bOPTIONAL\s+MATCH\b/i.test(withoutLineComments)) {
    return { ok: false, reason: "Query must include MATCH or OPTIONAL MATCH" };
  }

  return { ok: true };
}
