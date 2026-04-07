import { config } from "../config.js";

export type SearchCriteria = Record<string, unknown>;

export async function fetchPropertiesCount(): Promise<number> {
  const url = `${config.laravelApiUrl}/properties`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Laravel GET /properties failed: ${res.status}`);
  const body = (await res.json()) as { count?: number; data?: unknown[] };
  if (typeof body.count === "number") return body.count;
  if (Array.isArray(body.data)) return body.data.length;
  return 0;
}

export async function searchProperties(
  criteria: SearchCriteria,
  limit: number
): Promise<{ properties: unknown[]; count: number }> {
  const url = `${config.laravelApiUrl}/properties/search`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ criteria, limit }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Laravel POST /properties/search failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    data?: { properties?: unknown[]; count?: number };
  };
  const properties = json.data?.properties ?? [];
  const count = json.data?.count ?? properties.length;
  return { properties, count };
}

export async function fetchPropertiesByIds(ids: number[]): Promise<unknown[]> {
  if (ids.length === 0) return [];
  const url = `${config.laravelApiUrl}/properties/by-ids`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Laravel POST /properties/by-ids failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    data?: { properties?: unknown[] };
  };
  return json.data?.properties ?? [];
}
