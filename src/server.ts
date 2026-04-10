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

  // LangGraph graphs
  const llm = createLlm();
  const rankingGraph = buildRankingGraph(llm);
  const similarityGraph = buildSimilarityGraph(llm);

  // API routes
  await app.register(propertyRoutes);
  await app.register(noteRoutes);
  await app.register(aiRoutes, { rankingGraph, similarityGraph } as any);

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
