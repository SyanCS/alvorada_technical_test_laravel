// ai-service/src/server.ts
import Fastify from "fastify";
import { createLlm } from "./services/llm.js";
import { buildRankingGraph } from "./graph/ranking/graph.js";
import { config } from "./config.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  const llm = createLlm();
  const rankingGraph = buildRankingGraph(llm);

  app.post<{
    Body: { requirements?: string; limit?: number };
  }>("/search", async (request, reply) => {
    const requirements = (request.body?.requirements ?? "").trim();
    const limit = Math.min(100, Math.max(1, Number(request.body?.limit ?? 10)));

    if (!requirements) {
      return reply.status(400).send({ data: null, message: "requirements is required" });
    }

    try {
      const state = await rankingGraph.invoke({ requirements, resultLimit: limit });
      return reply.send({
        data: {
          scored_properties: state.scoredProperties ?? [],
          total_properties: state.rankedCandidates?.total_checked ?? 0,
          results_shown: (state.scoredProperties ?? []).length,
          requirements,
          answer: state.answer ?? "",
          follow_up_questions: state.followUpQuestions ?? [],
          criteria: state.criteria ?? {},
        },
        message: "Properties ranked successfully",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error(e);
      return reply.status(500).send({ data: null, message: msg });
    }
  });

  // POST /similar — wired in Task 14
  app.post("/similar", async (_request, reply) => {
    return reply.status(501).send({ data: null, message: "similarity graph not yet implemented" });
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}

export async function startServer() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });
}
