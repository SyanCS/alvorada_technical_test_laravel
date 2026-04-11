import { ChatOpenAI } from "@langchain/openai";
import { config } from "../config.js";

export function createLlm(temperature = 0.2): ChatOpenAI {
  if (!config.openRouterApiKey) {
    throw new Error("Set LLM_API_KEY or OPENROUTER_API_KEY for OpenRouter (not LangSmith)");
  }
  return new ChatOpenAI({
    apiKey: config.openRouterApiKey,
    modelName: config.model,
    temperature,
    maxTokens: 4096,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": config.httpReferer,
        "X-Title": config.xTitle,
      },
    },
  });
}
