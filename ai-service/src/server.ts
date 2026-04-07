import Fastify from "fastify";
import { createLlm } from "./services/llm.js";
import { buildPropertySearchGraph } from "./graph/graph.js";
import { config } from "./config.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  const llm = createLlm();
  const graph = buildPropertySearchGraph(llm);

  app.post<{
    Body: { requirements?: string; limit?: number };
  }>("/search", async (request, reply) => {
    const requirements = (request.body?.requirements ?? "").trim();
    const limit = Math.min(100, Math.max(1, Number(request.body?.limit ?? 10)));

    if (!requirements) {
      return reply.status(400).send({
        data: null,
        message: "requirements is required",
      });
    }

    try {
      const finalState = await graph.invoke({
        requirements,
        resultLimit: limit,
      });

      const scored = (finalState.scoredProperties ?? []) as Record<string, unknown>[];
      const total = finalState.totalPropertiesInDb ?? scored.length;

      return reply.send({
        data: {
          scored_properties: scored,
          total_properties: total,
          results_shown: scored.length,
          requirements,
          answer: finalState.answer ?? "",
          follow_up_questions: finalState.followUpQuestions ?? [],
          criteria: finalState.criteria ?? {},
        },
        message: "Properties scored successfully",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error(e);
      return reply.status(500).send({
        data: null,
        message: msg,
      });
    }
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}

export async function startServer() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });
}
