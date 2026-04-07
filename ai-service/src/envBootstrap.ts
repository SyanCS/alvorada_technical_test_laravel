/**
 * LangChain / LangSmith tracing reads LANGCHAIN_API_KEY.
 * Allow a single LANGSMITH_API_KEY in .env (OpenRouter stays on LLM_API_KEY / OPENROUTER_API_KEY).
 */
if (!process.env.LANGCHAIN_API_KEY && process.env.LANGSMITH_API_KEY) {
  process.env.LANGCHAIN_API_KEY = process.env.LANGSMITH_API_KEY;
}
