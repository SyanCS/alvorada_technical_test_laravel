if (!process.env.LANGCHAIN_API_KEY && process.env.LANGSMITH_API_KEY) {
  process.env.LANGCHAIN_API_KEY = process.env.LANGSMITH_API_KEY;
}
