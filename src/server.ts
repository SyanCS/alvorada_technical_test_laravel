import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { config } from "./config.js";
import { createLlm } from "./services/llm.js";
import { buildRankingGraph } from "./graph/ranking/graph.js";
import { buildSimilarityGraph } from "./graph/similarity/graph.js";
import { propertyRoutes } from "./routes/properties.js";
import { noteRoutes } from "./routes/notes.js";
import { aiRoutes } from "./routes/ai.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const app = Fastify({ logger: true });

  // LangGraph graphs — lazy init so server starts without LLM_API_KEY
  let rankingGraph: ReturnType<typeof buildRankingGraph> | undefined;
  let similarityGraph: ReturnType<typeof buildSimilarityGraph> | undefined;

  function getGraphs() {
    if (!rankingGraph || !similarityGraph) {
      const llm = createLlm();
      rankingGraph = buildRankingGraph(llm);
      similarityGraph = buildSimilarityGraph(llm);
    }
    return { rankingGraph, similarityGraph };
  }

  // API routes
  await app.register(propertyRoutes);
  await app.register(noteRoutes);
  await app.register(aiRoutes, { getGraphs } as any);

  // Health check
  app.get("/api/health", async () => ({ ok: true }));

  // Serve built Vue SPA in production
  const distPath = join(__dirname, "..", "dist");
  if (existsSync(distPath)) {
    await app.register(fastifyStatic, {
      root: distPath,
      wildcard: false,
    });

    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith("/api/")) {
        return reply.status(404).send({ data: null, message: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}

export async function startServer() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });
}
