export const config = {
  port: Number(process.env.PORT ?? 3001),
  openRouterApiKey:
    process.env.OPENROUTER_API_KEY ?? process.env.LLM_API_KEY ?? "",
  model: process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001",
  laravelApiUrl: (process.env.LARAVEL_API_URL ?? "http://localhost:8000/api").replace(/\/$/, ""),
  httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? "https://alvorada-property-research.com",
  xTitle: process.env.OPENROUTER_X_TITLE ?? "Alvorada Property Research System",

  /** Bolt URI, e.g. bolt://localhost:7687 — if unset, graph uses SQL retrieval only */
  neo4jUri: (process.env.NEO4J_URI ?? "").trim(),
  neo4jUser: process.env.NEO4J_USER ?? "neo4j",
  neo4jPassword: process.env.NEO4J_PASSWORD ?? "",
};

export function isNeo4jConfigured(): boolean {
  return Boolean(config.neo4jUri && config.neo4jPassword);
}
