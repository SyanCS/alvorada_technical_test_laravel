import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { extractFeaturesFromProperty, getFeatureSummary } from "../services/featureExtraction.js";
import type { RankingState } from "../graph/ranking/types.js";

const NODE_LABELS: Record<string, string> = {
  parseRequirements: "Parsing requirements",
  buildRankingQuery: "Building ranking query",
  validateQuery: "Validating query",
  executeRanking: "Ranking properties",
  generateResponse: "Generating scores & response",
};

export async function aiRoutes(app: FastifyInstance, deps: { rankingGraph: any; similarityGraph: any }) {
  const { rankingGraph, similarityGraph } = deps;

  // POST /api/ai/extract-features
  app.post<{ Body: { property_id?: number; force_refresh?: boolean } }>("/api/ai/extract-features", async (req, reply) => {
    try {
      const propertyId = Number(req.body?.property_id);
      if (!propertyId || isNaN(propertyId)) {
        return reply.status(422).send({ data: null, message: "property_id is required" });
      }
      const forceRefresh = Boolean(req.body?.force_refresh ?? false);

      const features = await extractFeaturesFromProperty(propertyId, forceRefresh);
      if (!features) {
        return reply.status(500).send({ data: null, message: "Feature extraction returned no result" });
      }

      return reply.send({
        data: {
          property_id: propertyId,
          features,
          summary: getFeatureSummary(features),
        },
        message: "Features extracted successfully",
      });
    } catch (e) {
      app.log.error(e);
      const msg = e instanceof Error ? e.message : "Feature extraction failed";
      const status = msg.includes("not found") ? 404 : 500;
      return reply.status(status).send({ data: null, message: msg });
    }
  });

  // POST /api/ai/score
  app.post<{ Body: { requirements?: string; limit?: number } }>("/api/ai/score", async (req, reply) => {
    const requirements = (req.body?.requirements ?? "").trim();
    const limit = Math.min(100, Math.max(1, Number(req.body?.limit ?? 10)));

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
      app.log.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({ data: null, message: msg });
    }
  });

  // POST /api/ai/score/stream — SSE
  app.post<{ Body: { requirements?: string; limit?: number } }>("/api/ai/score/stream", async (req, reply) => {
    const requirements = (req.body?.requirements ?? "").trim();
    const limit = Math.min(100, Math.max(1, Number(req.body?.limit ?? 10)));

    if (!requirements) {
      return reply.status(400).send({ data: null, message: "requirements is required" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const nodeNames = Object.keys(NODE_LABELS);
      send("nodes", nodeNames.map((id) => ({ id, label: NODE_LABELS[id] })));

      let finalState: RankingState | undefined;
      const stream = await rankingGraph.stream(
        { requirements, resultLimit: limit },
        { streamMode: "updates" },
      );

      for await (const chunk of stream) {
        for (const nodeName of Object.keys(chunk)) {
          send("node_complete", { node: nodeName });
          finalState = { ...finalState, ...chunk[nodeName] } as RankingState;
        }
      }

      if (finalState) {
        send("result", {
          scored_properties: finalState.scoredProperties ?? [],
          total_properties: finalState.rankedCandidates?.total_checked ?? 0,
          results_shown: (finalState.scoredProperties ?? []).length,
          requirements,
          answer: finalState.answer ?? "",
          follow_up_questions: finalState.followUpQuestions ?? [],
          criteria: finalState.criteria ?? {},
        });
      }

      send("done", {});
    } catch (e) {
      app.log.error(e);
      send("error", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      reply.raw.end();
    }
  });

  // POST /api/ai/similar
  app.post<{ Body: { property_id?: number; limit?: number } }>("/api/ai/similar", async (req, reply) => {
    const propertyId = Number(req.body?.property_id);
    const limit = Math.min(50, Math.max(1, Number(req.body?.limit ?? 10)));

    if (!propertyId || isNaN(propertyId)) {
      return reply.status(400).send({ data: null, message: "property_id is required" });
    }

    try {
      const state = await similarityGraph.invoke({ property_id: propertyId, limit });
      return reply.send({
        data: {
          similar_properties: state.similarProperties ?? [],
          summary: state.summary ?? "",
          source_property_id: propertyId,
        },
        message: state.error ? `Completed with error: ${state.error}` : "Similar properties found",
      });
    } catch (e) {
      app.log.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({ data: null, message: msg });
    }
  });

  // GET /api/properties/:id/features
  app.get<{ Params: { id: string } }>("/api/properties/:id/features", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      const features = await db.query.propertyFeatures.findFirst({
        where: eq(schema.propertyFeatures.propertyId, id),
      });

      if (!features) {
        return reply.send({
          data: { property_id: id, features: null, has_features: false },
          message: "No features found for this property",
        });
      }

      return reply.send({
        data: {
          property_id: id,
          features,
          summary: getFeatureSummary(features),
          has_features: true,
        },
        message: "Features retrieved successfully",
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to retrieve features" });
    }
  });
}
