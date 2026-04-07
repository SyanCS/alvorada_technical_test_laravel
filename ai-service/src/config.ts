export const config = {
  port: Number(process.env.PORT ?? 3001),
  openRouterApiKey:
    process.env.OPENROUTER_API_KEY ?? process.env.LLM_API_KEY ?? "",
  model: process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001",
  laravelApiUrl: (process.env.LARAVEL_API_URL ?? "http://localhost:8000/api").replace(/\/$/, ""),
  httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? "https://alvorada-property-research.com",
  xTitle: process.env.OPENROUTER_X_TITLE ?? "Alvorada Property Research System",
};
