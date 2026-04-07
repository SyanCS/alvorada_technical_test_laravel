import neo4j from "neo4j-driver";

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (neo4j.isInt(v)) return (v as neo4j.Integer).toNumber();
  return null;
}

/** Normalize Neo4j driver rows to integer Laravel property ids. */
export function rowsToLaravelIds(rows: Record<string, unknown>[]): number[] {
  const out: number[] = [];
  for (const row of rows) {
    let v: unknown = row.laravel_id;
    if (v === undefined && row.p !== undefined && typeof row.p === "object") {
      const node = row.p as { properties?: Record<string, unknown> };
      v = node.properties?.laravel_id;
    }
    const n = toNumber(v);
    if (n !== null && n > 0) out.push(n);
  }
  return [...new Set(out)];
}
