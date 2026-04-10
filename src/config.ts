export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://alvorada_user:alvorada_password@localhost:5432/alvorada_db",

  // LLM (OpenRouter)
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? process.env.LLM_API_KEY ?? "",
  model: process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001",
  httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? "https://alvorada-property-research.com",
  xTitle: process.env.OPENROUTER_X_TITLE ?? "Alvorada Property Research System",

  // Neo4j (optional)
  neo4jUri: (process.env.NEO4J_URI ?? "").trim(),
  neo4jUser: process.env.NEO4J_USER ?? "neo4j",
  neo4jPassword: process.env.NEO4J_PASSWORD ?? "",

  // Geolocation
  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org/search",
  nominatimReverseUrl: process.env.NOMINATIM_REVERSE_URL ?? "https://nominatim.openstreetmap.org/reverse",
  nominatimUserAgent: "AlvoradaPropertyResearch/2.0",
  nominatimTimeout: 10_000,
};

export function isNeo4jConfigured(): boolean {
  return Boolean(config.neo4jUri && config.neo4jPassword);
}
