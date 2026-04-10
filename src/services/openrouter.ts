import { config } from "../config.js";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(messages: ChatMessage[], options: { temperature?: number; maxTokens?: number; responseFormat?: "json" } = {}): Promise<Record<string, unknown>> {
  if (!config.openRouterApiKey) {
    throw new Error("OpenRouter API key not configured. Set LLM_API_KEY in .env.");
  }

  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1000,
  };

  if (options.responseFormat === "json") {
    payload.response_format = { type: "json_object" };
  }

  return makeRequestWithRetry(payload);
}

export async function extractStructuredData(systemPrompt: string, userPrompt: string, options: { temperature?: number; maxTokens?: number } = {}): Promise<{ data: Record<string, unknown>; rawResponse: string }> {
  const response = await chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { ...options, responseFormat: "json" },
  );

  const text = extractTextFromResponse(response);
  const data = JSON.parse(text);

  return { data, rawResponse: text };
}

function extractTextFromResponse(response: Record<string, unknown>): string {
  const choices = response.choices as { message: { content: string } }[] | undefined;
  if (!choices?.[0]?.message?.content) {
    throw new Error("Unexpected API response format: " + JSON.stringify(response));
  }
  return choices[0].message.content;
}

async function makeRequestWithRetry(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  let lastError: Error | undefined;
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openRouterApiKey}`,
          "HTTP-Referer": config.httpReferer,
          "X-Title": config.xTitle,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (data.error) {
        const errObj = data.error as Record<string, unknown>;
        throw new Error("API error: " + (errObj.message ?? JSON.stringify(errObj)));
      }

      return data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const msg = lastError.message;

      if (msg.includes("invalid_api_key") || msg.includes("authentication") || msg.includes("401")) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2 ** (attempt - 1) * 1000));
      }
    }
  }

  throw new Error(`API request failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message ?? "Unknown"}`);
}
