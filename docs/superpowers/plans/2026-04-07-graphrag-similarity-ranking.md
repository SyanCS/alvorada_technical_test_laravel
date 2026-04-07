# GraphRAG Similarity + Deterministic Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Text-to-Cypher ranking flow with deterministic match-count ranking, and add a GraphRAG "find similar properties" feature powered by Neo4j concept-node traversal.

**Architecture:** Two independent LangGraph graphs (`rankingGraph`, `similarityGraph`) each with Zod-validated node I/O, wired into the Fastify server at `/search` and `/similar`. A new `extract-entities` script rebuilds the Neo4j knowledge graph (landmarks, neighborhoods, amenities, use types) from property notes via LLM.

**Tech Stack:** TypeScript, LangGraph, LangChain, Zod, Neo4j, Fastify, OpenRouter API, Laravel (PHP), Vue 3 + Pinia

---

## File Map

### Create
| File | Purpose |
|------|---------|
| `ai-service/src/graph/ranking/types.ts` | Zod schemas + LangGraph annotation for ranking graph |
| `ai-service/src/graph/ranking/nodes/parseRequirementsNode.ts` | NL → structured criteria (LLM) |
| `ai-service/src/graph/ranking/nodes/buildRankingQueryNode.ts` | Criteria → hard filters + soft preferences (no LLM) |
| `ai-service/src/graph/ranking/nodes/validateQueryNode.ts` | Validate field names and types (no LLM) |
| `ai-service/src/graph/ranking/nodes/executeRankingNode.ts` | Call Laravel search, count preference matches, sort (no LLM) |
| `ai-service/src/graph/ranking/nodes/generateResponseNode.ts` | Score + explain results (LLM) |
| `ai-service/src/graph/ranking/graph.ts` | Assemble ranking graph |
| `ai-service/src/graph/similarity/types.ts` | Zod schemas + LangGraph annotation for similarity graph |
| `ai-service/src/graph/similarity/nodes/fetchPropertyNode.ts` | Fetch property from Laravel + concept nodes from Neo4j |
| `ai-service/src/graph/similarity/nodes/traverseGraphNode.ts` | Cypher traversal for shared concept nodes (no LLM) |
| `ai-service/src/graph/similarity/nodes/scoreSimilarityNode.ts` | Normalise weighted scores to 0-100 (no LLM) |
| `ai-service/src/graph/similarity/nodes/generateExplanationNode.ts` | Generate explanation per property (LLM) |
| `ai-service/src/graph/similarity/graph.ts` | Assemble similarity graph |
| `ai-service/scripts/extract-entities.ts` | Batch entity extraction from notes → Neo4j |
| `tests/Feature/AISimilarTest.php` | Laravel feature test for POST /api/ai/similar |

### Modify
| File | Change |
|------|--------|
| `ai-service/src/server.ts` | Wire both graphs; add POST /similar |
| `ai-service/package.json` | Add `extract-entities` script; remove `sync-graph` |
| `app/Http/Controllers/Api/AIController.php` | Add `similar()` method |
| `routes/api.php` | Add `POST /ai/similar` |
| `resources/js/stores/propertyStore.js` | Add `findSimilar(id)` action |
| `resources/js/pages/PropertyShow.vue` | Add "Similar Properties" section |

### Delete (Task 17)
`ai-service/src/graph/graph.ts`, `src/graph/nodes/cypherGeneratorNode.ts`, `src/graph/nodes/cypherExecutorNode.ts`, `src/graph/nodes/cypherCorrectionNode.ts`, `src/graph/nodes/cypherUtils.ts`, `src/graph/nodes/loosenCriteriaNode.ts`, `src/graph/nodes/hydrateFromLaravelNode.ts`, `src/graph/nodes/retrievePropertiesNode.ts`, `src/graph/nodes/scoreCandidatesNode.ts`, `src/graph/nodes/parseRequirementsNode.ts`, `src/graph/nodes/generateResponseNode.ts`, `scripts/sync-graph.ts`

---

## Phase 1: Ranking Graph

### Task 1: Ranking graph types

**Files:**
- Create: `ai-service/src/graph/ranking/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// ai-service/src/graph/ranking/types.ts
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

export const ParsedCriteriaSchema = z.object({
  recommended_use: z.string().optional(),
  min_capacity: z.number().optional(),
  max_capacity: z.number().optional(),
  min_condition: z.number().min(1).max(5).optional(),
  near_subway: z.boolean().optional(),
  parking_available: z.boolean().optional(),
  has_elevator: z.boolean().optional(),
  needs_renovation: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
});
export type ParsedCriteria = z.infer<typeof ParsedCriteriaSchema>;

export const RankingQuerySchema = z.object({
  filters: z.record(z.unknown()),
  preferences: z.record(z.unknown()),
  explanation: z.string(),
});
export type RankingQuery = z.infer<typeof RankingQuerySchema>;

export const ValidatedQuerySchema = z.object({
  valid: z.boolean(),
  corrected_filters: z.record(z.unknown()).optional(),
  corrected_preferences: z.record(z.unknown()).optional(),
  issues: z.array(z.string()).optional(),
});
export type ValidatedQuery = z.infer<typeof ValidatedQuerySchema>;

export const PropertyDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  notes: z.array(z.object({ id: z.number(), note: z.string() })).optional(),
  property_feature: z.record(z.unknown()).nullable().optional(),
});
export type PropertyData = z.infer<typeof PropertyDataSchema>;

export const RankedCandidateSchema = z.object({
  property: PropertyDataSchema,
  match_count: z.number(),
  matched_fields: z.array(z.string()),
});

export const RankedCandidatesSchema = z.object({
  candidates: z.array(RankedCandidateSchema),
  total_checked: z.number(),
});
export type RankedCandidates = z.infer<typeof RankedCandidatesSchema>;

export const ScoredPropertySchema = z.object({
  property_id: z.number(),
  property_name: z.string(),
  address: z.string(),
  score: z.number().min(0).max(10),
  explanation: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});
export type ScoredProperty = z.infer<typeof ScoredPropertySchema>;

export const RankingAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  resultLimit: Annotation<number>,
  criteria: Annotation<ParsedCriteria | undefined>,
  rankingQuery: Annotation<RankingQuery | undefined>,
  validatedQuery: Annotation<ValidatedQuery | undefined>,
  rankedCandidates: Annotation<RankedCandidates | undefined>,
  scoredProperties: Annotation<ScoredProperty[] | undefined>,
  answer: Annotation<string | undefined>,
  followUpQuestions: Annotation<string[] | undefined>,
  error: Annotation<string | undefined>,
});

export type RankingState = typeof RankingAnnotation.State;
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```
Expected: no errors from this file (other files may still error — that's fine until they're updated).

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/ranking/types.ts
git commit -m "feat(ranking): add Zod schemas and LangGraph annotation for ranking graph"
```

---

### Task 2: parseRequirementsNode

**Files:**
- Create: `ai-service/src/graph/ranking/nodes/parseRequirementsNode.ts`

- [ ] **Step 1: Create the node**

```typescript
// ai-service/src/graph/ranking/nodes/parseRequirementsNode.ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { ParsedCriteriaSchema, type RankingState } from "../types.js";

const SYSTEM_PROMPT = `You are a real-estate search assistant. Extract structured search criteria from the user's requirements.
Return only fields that are explicitly or clearly implied. Omit fields that are not mentioned.
For recommended_use, normalise to one of: office, retail, warehouse, coworking, mixed, residential.
For boolean fields, only set them if the user clearly requires that feature (true) or clearly rejects it (false).`;

export function createParseRequirementsNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(ParsedCriteriaSchema);

  return async (state: RankingState): Promise<Partial<RankingState>> => {
    try {
      const criteria = await structured.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(`Client requirements: ${state.requirements}`),
      ]);
      const cleaned: Partial<typeof criteria> = {};
      for (const [k, v] of Object.entries(criteria)) {
        if (v !== null && v !== undefined) {
          (cleaned as Record<string, unknown>)[k] = v;
        }
      }
      return { criteria: cleaned as typeof criteria, error: undefined };
    } catch (e) {
      return { error: `parseRequirements: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/ranking/nodes/parseRequirementsNode.ts
git commit -m "feat(ranking): add parseRequirementsNode with LLM structured output"
```

---

### Task 3: buildRankingQueryNode

**Files:**
- Create: `ai-service/src/graph/ranking/nodes/buildRankingQueryNode.ts`

- [ ] **Step 1: Create the node**

```typescript
// ai-service/src/graph/ranking/nodes/buildRankingQueryNode.ts
import type { RankingState } from "../types.js";

// Hard filters → sent to Laravel as search criteria (must match)
const HARD_FILTER_KEYS = ["recommended_use", "min_capacity", "max_capacity", "min_condition"] as const;

// Soft preferences → counted locally after retrieval (nice to have)
const PREFERENCE_KEYS = ["near_subway", "parking_available", "has_elevator", "needs_renovation"] as const;

export function createBuildRankingQueryNode() {
  return async (state: RankingState): Promise<Partial<RankingState>> => {
    const c = state.criteria ?? {};
    const filters: Record<string, unknown> = {};
    const preferences: Record<string, unknown> = {};

    for (const key of HARD_FILTER_KEYS) {
      if (c[key] !== undefined) filters[key] = c[key];
    }
    for (const key of PREFERENCE_KEYS) {
      if (c[key] !== undefined) preferences[key] = c[key];
    }
    if (c.amenities && c.amenities.length > 0) {
      preferences["amenities"] = c.amenities;
    }

    const parts: string[] = [];
    if (filters["recommended_use"]) parts.push(`use: ${filters["recommended_use"]}`);
    if (filters["min_capacity"]) parts.push(`min capacity: ${filters["min_capacity"]}`);
    if (filters["min_condition"]) parts.push(`min condition: ${filters["min_condition"]}/5`);
    if (Object.keys(preferences).length > 0) {
      parts.push(`preferences: ${Object.keys(preferences).join(", ")}`);
    }

    return {
      rankingQuery: {
        filters,
        preferences,
        explanation: parts.length > 0 ? parts.join("; ") : "no specific criteria",
      },
    };
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/ranking/nodes/buildRankingQueryNode.ts
git commit -m "feat(ranking): add buildRankingQueryNode - deterministic hard/soft query split"
```

---

### Task 4: validateQueryNode

**Files:**
- Create: `ai-service/src/graph/ranking/nodes/validateQueryNode.ts`

- [ ] **Step 1: Create the node**

```typescript
// ai-service/src/graph/ranking/nodes/validateQueryNode.ts
import type { RankingState } from "../types.js";

const BOOLEAN_FIELDS = new Set(["near_subway", "needs_renovation", "parking_available", "has_elevator"]);
const NUMBER_FIELDS = new Set(["min_capacity", "max_capacity", "min_condition"]);
const STRING_FIELDS = new Set(["recommended_use"]);
const KNOWN_FIELDS = new Set([...BOOLEAN_FIELDS, ...NUMBER_FIELDS, ...STRING_FIELDS, "amenities"]);

export function createValidateQueryNode() {
  return async (state: RankingState): Promise<Partial<RankingState>> => {
    const q = state.rankingQuery;
    if (!q) {
      return { validatedQuery: { valid: false, issues: ["no ranking query built"] } };
    }

    const issues: string[] = [];
    const corrected_filters = { ...q.filters };
    const corrected_preferences = { ...q.preferences };

    const allFields = { ...q.filters, ...q.preferences };
    for (const [k, v] of Object.entries(allFields)) {
      if (!KNOWN_FIELDS.has(k)) {
        issues.push(`unknown field: ${k} — removed`);
        delete corrected_filters[k];
        delete corrected_preferences[k];
        continue;
      }
      if (BOOLEAN_FIELDS.has(k) && typeof v !== "boolean") {
        issues.push(`${k} must be boolean, got ${typeof v}`);
      }
      if (NUMBER_FIELDS.has(k) && typeof v !== "number") {
        issues.push(`${k} must be number, got ${typeof v}`);
      }
      if (k === "min_condition" && typeof v === "number" && (v < 1 || v > 5)) {
        issues.push(`min_condition must be 1-5, got ${v}`);
        corrected_filters["min_condition"] = Math.max(1, Math.min(5, v));
      }
    }

    const hasFilters = Object.keys(corrected_filters).length > 0;
    const hasPrefs = Object.keys(corrected_preferences).length > 0;
    if (!hasFilters && !hasPrefs) {
      issues.push("query has no filters or preferences — will return all properties unranked");
    }

    return {
      validatedQuery: {
        valid: true, // we correct and continue rather than hard-fail
        corrected_filters,
        corrected_preferences,
        issues: issues.length > 0 ? issues : undefined,
      },
    };
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/ranking/nodes/validateQueryNode.ts
git commit -m "feat(ranking): add validateQueryNode - structural validation without LLM"
```

---

### Task 5: executeRankingNode

**Files:**
- Create: `ai-service/src/graph/ranking/nodes/executeRankingNode.ts`

- [ ] **Step 1: Create the node**

```typescript
// ai-service/src/graph/ranking/nodes/executeRankingNode.ts
import { searchProperties } from "../../../services/laravelClient.js";
import { PropertyDataSchema, type RankingState } from "../types.js";

const RETRIEVAL_LIMIT = 200;

// Maps preference key → property_feature field name in Laravel response
const PREF_TO_FEATURE: Record<string, string> = {
  near_subway: "near_subway",
  parking_available: "parking_available",
  has_elevator: "has_elevator",
  needs_renovation: "needs_renovation",
};

export function createExecuteRankingNode() {
  return async (state: RankingState): Promise<Partial<RankingState>> => {
    try {
      const q = state.validatedQuery;
      const filters = q?.corrected_filters ?? state.rankingQuery?.filters ?? {};
      const preferences = q?.corrected_preferences ?? state.rankingQuery?.preferences ?? {};

      const { properties: raw } = await searchProperties(filters, RETRIEVAL_LIMIT);

      const candidates = raw.map((r) => {
        const parsed = PropertyDataSchema.safeParse(r);
        if (!parsed.success) return null;
        const property = parsed.data;
        const features = (property.property_feature ?? {}) as Record<string, unknown>;

        const matched_fields: string[] = [];

        for (const [prefKey, featureKey] of Object.entries(PREF_TO_FEATURE)) {
          if (preferences[prefKey] !== undefined && features[featureKey] === preferences[prefKey]) {
            matched_fields.push(prefKey);
          }
        }

        if (preferences["amenities"] && Array.isArray(features["amenities"])) {
          const wanted = preferences["amenities"] as string[];
          const has = (features["amenities"] as string[]).map((s) => s.toLowerCase());
          for (const w of wanted) {
            if (has.some((h) => h.includes(w.toLowerCase()))) {
              matched_fields.push(`amenity:${w}`);
            }
          }
        }

        return { property, match_count: matched_fields.length, matched_fields };
      }).filter((c): c is NonNullable<typeof c> => c !== null);

      candidates.sort((a, b) => b.match_count - a.match_count);

      return {
        rankedCandidates: {
          candidates,
          total_checked: raw.length,
        },
      };
    } catch (e) {
      return { error: `executeRanking: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/ranking/nodes/executeRankingNode.ts
git commit -m "feat(ranking): add executeRankingNode - match-count ranking without LLM"
```

---

### Task 6: generateResponseNode (ranking)

**Files:**
- Create: `ai-service/src/graph/ranking/nodes/generateResponseNode.ts`

- [ ] **Step 1: Create the node**

```typescript
// ai-service/src/graph/ranking/nodes/generateResponseNode.ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { type RankingState, ScoredPropertySchema } from "../types.js";

const ResponseSchema = z.object({
  scored_properties: z.array(ScoredPropertySchema),
  answer: z.string(),
  follow_up_questions: z.array(z.string()).max(4),
});

const SYSTEM_PROMPT = `You are a commercial real estate advisor.
You will receive client requirements and a list of candidate properties ranked by how many of the client's preferences they match.
For each property, assign a score 0-10 (10 = perfect match), write a 1-2 sentence explanation, and list strengths and weaknesses.
Base scores on match_count relative to the total possible preferences, and factor in whether hard criteria are well-satisfied.
Then write a concise executive summary (answer) and 2-4 follow-up questions for the client.`;

export function createGenerateResponseNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(ResponseSchema);

  return async (state: RankingState): Promise<Partial<RankingState>> => {
    if (state.error) {
      return {
        answer: `Search failed: ${state.error}`,
        followUpQuestions: ["Try rephrasing your requirements and retry."],
        scoredProperties: [],
      };
    }

    try {
      const candidates = (state.rankedCandidates?.candidates ?? [])
        .slice(0, state.resultLimit ?? 10)
        .map((c) => ({
          property_id: c.property.id,
          property_name: c.property.name,
          address: c.property.address,
          match_count: c.match_count,
          matched_fields: c.matched_fields,
          features: c.property.property_feature,
        }));

      const userPrompt = `Client requirements: "${state.requirements}"

Query explanation: ${state.rankingQuery?.explanation ?? "no criteria"}

Candidates (sorted by match count, best first):
${JSON.stringify(candidates, null, 2)}`;

      const out = await structured.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(userPrompt),
      ]);

      // Reattach lat/lng from candidate data
      const scored = out.scored_properties.map((sp) => {
        const candidate = state.rankedCandidates?.candidates.find(
          (c) => c.property.id === sp.property_id
        );
        return {
          ...sp,
          latitude: candidate?.property.latitude ?? null,
          longitude: candidate?.property.longitude ?? null,
        };
      });

      return {
        scoredProperties: scored,
        answer: out.answer,
        followUpQuestions: out.follow_up_questions,
      };
    } catch (e) {
      return {
        answer: `Could not generate summary: ${e instanceof Error ? e.message : String(e)}`,
        followUpQuestions: [],
        scoredProperties: [],
      };
    }
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/ranking/nodes/generateResponseNode.ts
git commit -m "feat(ranking): add generateResponseNode - single LLM call for scoring and summary"
```

---

### Task 7: Assemble ranking graph + update server.ts

**Files:**
- Create: `ai-service/src/graph/ranking/graph.ts`
- Modify: `ai-service/src/server.ts`

- [ ] **Step 1: Create rankingGraph.ts**

```typescript
// ai-service/src/graph/ranking/graph.ts
import { END, START, StateGraph } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import { RankingAnnotation, type RankingState } from "./types.js";
import { createParseRequirementsNode } from "./nodes/parseRequirementsNode.js";
import { createBuildRankingQueryNode } from "./nodes/buildRankingQueryNode.js";
import { createValidateQueryNode } from "./nodes/validateQueryNode.js";
import { createExecuteRankingNode } from "./nodes/executeRankingNode.js";
import { createGenerateResponseNode } from "./nodes/generateResponseNode.js";

function routeAfterParse(state: RankingState): string {
  if (state.error) return "generateResponse";
  return "buildRankingQuery";
}

function routeAfterExecute(state: RankingState): string {
  if (state.error) return "generateResponse";
  return "generateResponse";
}

export function buildRankingGraph(llm: ChatOpenAI) {
  return new StateGraph(RankingAnnotation)
    .addNode("parseRequirements", createParseRequirementsNode(llm))
    .addNode("buildRankingQuery", createBuildRankingQueryNode())
    .addNode("validateQuery", createValidateQueryNode())
    .addNode("executeRanking", createExecuteRankingNode())
    .addNode("generateResponse", createGenerateResponseNode(llm))
    .addEdge(START, "parseRequirements")
    .addConditionalEdges("parseRequirements", routeAfterParse)
    .addEdge("buildRankingQuery", "validateQuery")
    .addEdge("validateQuery", "executeRanking")
    .addConditionalEdges("executeRanking", routeAfterExecute)
    .addEdge("generateResponse", END)
    .compile();
}
```

- [ ] **Step 2: Update server.ts to use ranking graph and add /similar stub**

Replace the entire contents of `ai-service/src/server.ts`:

```typescript
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
```

- [ ] **Step 3: Type-check**

```bash
cd ai-service && npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Smoke-test (requires Laravel running)**

```bash
cd ai-service && npm run dev
# In another terminal:
curl -s -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -d '{"requirements":"office near subway with parking","limit":5}' | jq .
```
Expected: JSON with `scored_properties`, `answer`, `criteria`.

- [ ] **Step 5: Commit**

```bash
git add ai-service/src/graph/ranking/ ai-service/src/server.ts
git commit -m "feat(ranking): wire ranking graph to /search endpoint"
```

---

## Phase 2: GraphRAG Similarity Graph

### Task 8: Similarity graph types

**Files:**
- Create: `ai-service/src/graph/similarity/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// ai-service/src/graph/similarity/types.ts
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

export const ConceptNodesSchema = z.object({
  landmarks: z.array(z.object({ name: z.string(), type: z.string() })),
  neighborhoods: z.array(z.object({ name: z.string() })),
  amenities: z.array(z.object({ type: z.string() })),
  use_types: z.array(z.object({ name: z.string() })),
});
export type ConceptNodes = z.infer<typeof ConceptNodesSchema>;

export const PropertyDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  property_feature: z.record(z.unknown()).nullable().optional(),
});
export type PropertyData = z.infer<typeof PropertyDataSchema>;

export const PropertyWithConceptsSchema = z.object({
  property: PropertyDataSchema,
  concept_nodes: ConceptNodesSchema,
});
export type PropertyWithConcepts = z.infer<typeof PropertyWithConceptsSchema>;

export const TraversalCandidateSchema = z.object({
  property_id: z.number(),
  shared_landmarks: z.array(z.string()),
  shared_neighborhoods: z.array(z.string()),
  shared_amenities: z.array(z.string()),
  shared_use_types: z.array(z.string()),
  raw_match_count: z.number(),
  weighted_score: z.number(),
});

export const TraversalResultSchema = z.object({
  candidates: z.array(TraversalCandidateSchema),
});
export type TraversalResult = z.infer<typeof TraversalResultSchema>;

export const ScoredSimilaritySchema = z.object({
  property_id: z.number(),
  similarity_score: z.number().min(0).max(100),
  shared_concepts: z.array(z.string()),
});

export const SimilarPropertySchema = z.object({
  property_id: z.number(),
  property_name: z.string(),
  address: z.string(),
  similarity_score: z.number(),
  explanation: z.string(),
  shared_concepts: z.array(z.string()),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export const SimilarityAnnotation = Annotation.Root({
  property_id: Annotation<number>,
  limit: Annotation<number>,
  sourceProperty: Annotation<PropertyWithConcepts | undefined>,
  traversalResult: Annotation<TraversalResult | undefined>,
  scoredSimilarity: Annotation<z.infer<typeof ScoredSimilaritySchema>[] | undefined>,
  similarProperties: Annotation<z.infer<typeof SimilarPropertySchema>[] | undefined>,
  summary: Annotation<string | undefined>,
  error: Annotation<string | undefined>,
});

export type SimilarityState = typeof SimilarityAnnotation.State;
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/similarity/types.ts
git commit -m "feat(similarity): add Zod schemas and LangGraph annotation for similarity graph"
```

---

### Task 9: Entity extraction script

**Files:**
- Create: `ai-service/scripts/extract-entities.ts`
- Modify: `ai-service/package.json`

- [ ] **Step 1: Create extract-entities.ts**

```typescript
// ai-service/scripts/extract-entities.ts
/**
 * Batch entity extraction from property notes → Neo4j concept nodes.
 * Usage: npm run extract-entities
 * Requires: NEO4J_URI, NEO4J_PASSWORD, LARAVEL_API_URL, LLM_API_KEY in ai-service/.env
 */
import "../src/envBootstrap.js";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { isNeo4jConfigured, config } from "../src/config.js";
import { runWriteQuery } from "../src/services/neo4jService.js";

const ExtractedEntitiesSchema = z.object({
  landmarks: z.array(z.object({
    name: z.string(),
    type: z.enum(["transit", "retail", "park", "institution", "other"]),
  })),
  neighborhoods: z.array(z.object({ name: z.string() })),
  amenities: z.array(z.object({ type: z.string() })),
  use_types: z.array(z.object({ name: z.string() })),
});

type ApiProperty = {
  id: number;
  name?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: Array<{ id: number; note: string }>;
  property_feature?: Record<string, unknown>;
};

async function fetchAllProperties(): Promise<ApiProperty[]> {
  const url = `${config.laravelApiUrl}/properties`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /properties failed: ${res.status}. Is Laravel running at ${url}?`);
  const body = (await res.json()) as { data?: ApiProperty[] };
  return body.data ?? [];
}

async function ensureConstraints(): Promise<void> {
  const constraints = [
    `CREATE CONSTRAINT property_laravel_id IF NOT EXISTS FOR (p:Property) REQUIRE p.laravel_id IS UNIQUE`,
    `CREATE CONSTRAINT landmark_name_type IF NOT EXISTS FOR (l:Landmark) REQUIRE (l.name, l.type) IS NODE KEY`,
    `CREATE CONSTRAINT neighborhood_name IF NOT EXISTS FOR (n:Neighborhood) REQUIRE n.name IS UNIQUE`,
    `CREATE CONSTRAINT amenity_type IF NOT EXISTS FOR (a:Amenity) REQUIRE a.type IS UNIQUE`,
    `CREATE CONSTRAINT use_type_name IF NOT EXISTS FOR (u:UseType) REQUIRE u.name IS UNIQUE`,
  ];
  for (const c of constraints) {
    await runWriteQuery(c);
  }
}

async function syncPropertyNode(p: ApiProperty): Promise<void> {
  const f = p.property_feature ?? {};
  await runWriteQuery(
    `MERGE (prop:Property { laravel_id: $id })
     SET prop.name = $name, prop.address = $address,
         prop.latitude = $latitude, prop.longitude = $longitude,
         prop.near_subway = $near_subway, prop.needs_renovation = $needs_renovation,
         prop.parking_available = $parking_available, prop.has_elevator = $has_elevator,
         prop.estimated_capacity_people = $estimated_capacity_people,
         prop.condition_rating = $condition_rating,
         prop.recommended_use = $recommended_use`,
    {
      id: p.id, name: p.name ?? "", address: p.address ?? "",
      latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      near_subway: f["near_subway"] ?? null, needs_renovation: f["needs_renovation"] ?? null,
      parking_available: f["parking_available"] ?? null, has_elevator: f["has_elevator"] ?? null,
      estimated_capacity_people: f["estimated_capacity_people"] ?? null,
      condition_rating: f["condition_rating"] ?? null,
      recommended_use: f["recommended_use"] ?? null,
    }
  );
}

async function extractAndWriteEntities(
  llm: ChatOpenAI,
  p: ApiProperty
): Promise<void> {
  const notes = p.notes ?? [];
  if (notes.length === 0) return;

  const noteText = notes.map((n) => n.note).join("\n---\n").slice(0, 6000);

  const structured = llm.withStructuredOutput(ExtractedEntitiesSchema);
  const entities = await structured.invoke([
    new SystemMessage(
      `Extract real-world entities mentioned in commercial property research notes.
Return landmarks (transit stations, retail centres, parks, institutions), neighbourhoods, 
physical amenities (rooftop, loading_dock, freight_elevator, etc.), and likely business use types.
Only include entities that are clearly mentioned. Normalise names to title case.`
    ),
    new HumanMessage(`Property: ${p.name ?? p.address}\n\nNotes:\n${noteText}`),
  ]);

  // Write landmark nodes
  for (const l of entities.landmarks) {
    await runWriteQuery(
      `MERGE (l:Landmark { name: $name, type: $type })
       WITH l MATCH (p:Property { laravel_id: $id }) MERGE (p)-[:NEAR]->(l)`,
      { name: l.name, type: l.type, id: p.id }
    );
  }
  // Write neighborhood nodes
  for (const n of entities.neighborhoods) {
    await runWriteQuery(
      `MERGE (n:Neighborhood { name: $name })
       WITH n MATCH (p:Property { laravel_id: $id }) MERGE (p)-[:IN]->(n)`,
      { name: n.name, id: p.id }
    );
  }
  // Write amenity nodes
  for (const a of entities.amenities) {
    await runWriteQuery(
      `MERGE (a:Amenity { type: $type })
       WITH a MATCH (p:Property { laravel_id: $id }) MERGE (p)-[:HAS_AMENITY]->(a)`,
      { type: a.type, id: p.id }
    );
  }
  // Write use type nodes
  for (const u of entities.use_types) {
    await runWriteQuery(
      `MERGE (u:UseType { name: $name })
       WITH u MATCH (p:Property { laravel_id: $id }) MERGE (p)-[:SUITED_FOR]->(u)`,
      { name: u.name, id: p.id }
    );
  }
}

async function main(): Promise<void> {
  if (!isNeo4jConfigured()) {
    console.error("Set NEO4J_URI and NEO4J_PASSWORD in ai-service/.env");
    process.exit(1);
  }
  if (!config.openRouterApiKey) {
    console.error("Set LLM_API_KEY or OPENROUTER_API_KEY in ai-service/.env");
    process.exit(1);
  }

  const llm = new ChatOpenAI({
    apiKey: config.openRouterApiKey,
    modelName: config.model,
    temperature: 0,
    maxTokens: 800,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": config.httpReferer, "X-Title": config.xTitle },
    },
  });

  console.log("Fetching properties from Laravel...");
  const properties = await fetchAllProperties();
  console.log(`Found ${properties.length} properties. Ensuring Neo4j constraints...`);
  await ensureConstraints();

  let synced = 0, extracted = 0, skipped = 0;

  for (const p of properties) {
    await syncPropertyNode(p);
    if ((p.notes ?? []).length > 0) {
      await extractAndWriteEntities(llm, p);
      extracted++;
    } else {
      skipped++;
    }
    synced++;
    if (synced % 10 === 0) {
      console.log(`  ${synced}/${properties.length} — extracted: ${extracted}, skipped (no notes): ${skipped}`);
    }
  }

  console.log(`Done. Synced: ${synced}, entity-extracted: ${extracted}, no-notes: ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Update package.json scripts**

In `ai-service/package.json`, replace the `scripts` block:

```json
"scripts": {
  "start": "node --import tsx src/index.ts",
  "dev": "node --watch --import tsx src/index.ts",
  "typecheck": "tsc --noEmit",
  "extract-entities": "node --import tsx --env-file .env scripts/extract-entities.ts"
},
```

- [ ] **Step 3: Type-check**

```bash
cd ai-service && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add ai-service/scripts/extract-entities.ts ai-service/package.json
git commit -m "feat(similarity): add extract-entities script for Neo4j concept node population"
```

---

### Task 10: fetchPropertyNode

**Files:**
- Create: `ai-service/src/graph/similarity/nodes/fetchPropertyNode.ts`

- [ ] **Step 1: Create the node**

```typescript
// ai-service/src/graph/similarity/nodes/fetchPropertyNode.ts
import { config } from "../../../config.js";
import { runReadQuery } from "../../../services/neo4jService.js";
import { PropertyDataSchema, ConceptNodesSchema, type SimilarityState } from "../types.js";

export function createFetchPropertyNode() {
  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    try {
      // Fetch property data from Laravel
      const res = await fetch(`${config.laravelApiUrl}/properties/${state.property_id}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`GET /properties/${state.property_id} failed: ${res.status}`);
      const body = (await res.json()) as { data?: unknown };
      const property = PropertyDataSchema.parse(body.data);

      // Fetch concept nodes from Neo4j
      const rows = await runReadQuery(
        `MATCH (p:Property { laravel_id: $id })
         RETURN
           [(p)-[:NEAR]->(l:Landmark) | { name: l.name, type: l.type }] AS landmarks,
           [(p)-[:IN]->(n:Neighborhood) | { name: n.name }] AS neighborhoods,
           [(p)-[:HAS_AMENITY]->(a:Amenity) | { type: a.type }] AS amenities,
           [(p)-[:SUITED_FOR]->(u:UseType) | { name: u.name }] AS use_types`,
        { id: state.property_id }
      );

      const row = rows[0] ?? {};
      const concept_nodes = ConceptNodesSchema.parse({
        landmarks: row["landmarks"] ?? [],
        neighborhoods: row["neighborhoods"] ?? [],
        amenities: row["amenities"] ?? [],
        use_types: row["use_types"] ?? [],
      });

      return { sourceProperty: { property, concept_nodes } };
    } catch (e) {
      return { error: `fetchProperty: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/similarity/nodes/fetchPropertyNode.ts
git commit -m "feat(similarity): add fetchPropertyNode - loads property + concept nodes"
```

---

### Task 11: traverseGraphNode

**Files:**
- Create: `ai-service/src/graph/similarity/nodes/traverseGraphNode.ts`

- [ ] **Step 1: Create the node**

```typescript
// ai-service/src/graph/similarity/nodes/traverseGraphNode.ts
import { runReadQuery } from "../../../services/neo4jService.js";
import { TraversalResultSchema, type SimilarityState } from "../types.js";

// Scoring weights per relationship type
const WEIGHTS = { neighborhood: 4, landmark: 3, amenity: 2, use_type: 1 };

export function createTraverseGraphNode() {
  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    try {
      const id = state.property_id;
      const candidateLimit = (state.limit ?? 10) * 3;

      const rows = await runReadQuery(
        `MATCH (source:Property { laravel_id: $id })
         MATCH (other:Property)
         WHERE other.laravel_id <> $id
         WITH source, other,
           [(source)-[:IN]->(n:Neighborhood)<-[:IN]-(other) | n.name] AS shared_neighborhoods,
           [(source)-[:NEAR]->(l:Landmark)<-[:NEAR]-(other) | l.name] AS shared_landmarks,
           [(source)-[:HAS_AMENITY]->(a:Amenity)<-[:HAS_AMENITY]-(other) | a.type] AS shared_amenities,
           [(source)-[:SUITED_FOR]->(u:UseType)<-[:SUITED_FOR]-(other) | u.name] AS shared_use_types
         WHERE size(shared_neighborhoods) > 0
            OR size(shared_landmarks) > 0
            OR size(shared_amenities) > 0
            OR size(shared_use_types) > 0
         WITH other,
           shared_neighborhoods, shared_landmarks, shared_amenities, shared_use_types,
           (size(shared_neighborhoods) * ${WEIGHTS.neighborhood}
            + size(shared_landmarks) * ${WEIGHTS.landmark}
            + size(shared_amenities) * ${WEIGHTS.amenity}
            + size(shared_use_types) * ${WEIGHTS.use_type}) AS weighted_score
         ORDER BY weighted_score DESC
         LIMIT $limit
         RETURN other.laravel_id AS property_id,
                shared_neighborhoods, shared_landmarks, shared_amenities, shared_use_types,
                (size(shared_neighborhoods) + size(shared_landmarks) + size(shared_amenities) + size(shared_use_types)) AS raw_match_count,
                weighted_score`,
        { id, limit: candidateLimit }
      );

      const candidates = rows.map((r) => ({
        property_id: Number(r["property_id"]),
        shared_landmarks: (r["shared_landmarks"] as string[]) ?? [],
        shared_neighborhoods: (r["shared_neighborhoods"] as string[]) ?? [],
        shared_amenities: (r["shared_amenities"] as string[]) ?? [],
        shared_use_types: (r["shared_use_types"] as string[]) ?? [],
        raw_match_count: Number(r["raw_match_count"]),
        weighted_score: Number(r["weighted_score"]),
      }));

      return { traversalResult: TraversalResultSchema.parse({ candidates }) };
    } catch (e) {
      return { error: `traverseGraph: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/similarity/nodes/traverseGraphNode.ts
git commit -m "feat(similarity): add traverseGraphNode - weighted concept-node Cypher traversal"
```

---

### Task 12: scoreSimilarityNode

**Files:**
- Create: `ai-service/src/graph/similarity/nodes/scoreSimilarityNode.ts`

- [ ] **Step 1: Create the node**

```typescript
// ai-service/src/graph/similarity/nodes/scoreSimilarityNode.ts
import { ScoredSimilaritySchema, type SimilarityState } from "../types.js";
import { z } from "zod";

export function createScoreSimilarityNode() {
  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    const candidates = state.traversalResult?.candidates ?? [];
    if (candidates.length === 0) {
      return { scoredSimilarity: [] };
    }

    const maxScore = candidates[0].weighted_score; // already sorted DESC

    const scored: z.infer<typeof ScoredSimilaritySchema>[] = candidates.map((c) => {
      const similarity_score = maxScore > 0
        ? Math.round((c.weighted_score / maxScore) * 100)
        : 0;

      const shared_concepts: string[] = [
        ...c.shared_neighborhoods.map((n) => `neighborhood: ${n}`),
        ...c.shared_landmarks.map((l) => `near: ${l}`),
        ...c.shared_amenities.map((a) => `amenity: ${a}`),
        ...c.shared_use_types.map((u) => `use type: ${u}`),
      ];

      return { property_id: c.property_id, similarity_score, shared_concepts };
    });

    return { scoredSimilarity: scored };
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/similarity/nodes/scoreSimilarityNode.ts
git commit -m "feat(similarity): add scoreSimilarityNode - normalise weighted scores to 0-100"
```

---

### Task 13: generateExplanationNode

**Files:**
- Create: `ai-service/src/graph/similarity/nodes/generateExplanationNode.ts`

- [ ] **Step 1: Create the node**

```typescript
// ai-service/src/graph/similarity/nodes/generateExplanationNode.ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { config } from "../../../config.js";
import { SimilarPropertySchema, type SimilarityState } from "../types.js";

const ExplanationSchema = z.object({
  explanations: z.array(z.object({
    property_id: z.number(),
    explanation: z.string(),
  })),
  summary: z.string(),
});

const SYSTEM_PROMPT = `You are a commercial real estate advisor.
Given a source property and a list of similar properties (with their shared concepts),
write a 1-sentence explanation for why each similar property resembles the source.
Then write a 1-2 sentence summary describing the overall pattern of similarity.
Be specific — mention the actual shared concepts, not generic phrases.`;

export function createGenerateExplanationNode(llm: ChatOpenAI) {
  const structured = llm.withStructuredOutput(ExplanationSchema);

  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    try {
      const scored = state.scoredSimilarity ?? [];
      const limit = state.limit ?? 10;
      const top = scored.slice(0, limit);

      if (top.length === 0) {
        return {
          similarProperties: [],
          summary: "No similar properties found in the knowledge graph. Run extract-entities to populate concept nodes.",
        };
      }

      // Hydrate full property data for top candidates
      const ids = top.map((s) => s.property_id);
      const res = await fetch(`${config.laravelApiUrl}/properties/by-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`/properties/by-ids failed: ${res.status}`);
      const body = (await res.json()) as { data?: { properties?: unknown[] } };
      const hydratedMap = new Map<number, Record<string, unknown>>();
      for (const p of body.data?.properties ?? []) {
        const prop = p as Record<string, unknown>;
        hydratedMap.set(Number(prop["id"]), prop);
      }

      // LLM call for explanations
      const sourceInfo = `${state.sourceProperty?.property.name ?? ""} at ${state.sourceProperty?.property.address ?? ""}`;
      const candidatesJson = JSON.stringify(
        top.map((s) => ({ property_id: s.property_id, similarity_score: s.similarity_score, shared_concepts: s.shared_concepts })),
        null, 2
      );

      const out = await structured.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(
          `Source property: ${sourceInfo}\n\nSimilar candidates:\n${candidatesJson}`
        ),
      ]);

      const explanationMap = new Map(out.explanations.map((e) => [e.property_id, e.explanation]));

      const similarProperties: z.infer<typeof SimilarPropertySchema>[] = top.map((s) => {
        const hydrated = hydratedMap.get(s.property_id) as Record<string, unknown> | undefined;
        return {
          property_id: s.property_id,
          property_name: String(hydrated?.["name"] ?? `Property ${s.property_id}`),
          address: String(hydrated?.["address"] ?? ""),
          similarity_score: s.similarity_score,
          explanation: explanationMap.get(s.property_id) ?? "",
          shared_concepts: s.shared_concepts,
          latitude: hydrated?.["latitude"] != null ? Number(hydrated["latitude"]) : null,
          longitude: hydrated?.["longitude"] != null ? Number(hydrated["longitude"]) : null,
        };
      });

      return { similarProperties, summary: out.summary };
    } catch (e) {
      return { error: `generateExplanation: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd ai-service && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/src/graph/similarity/nodes/generateExplanationNode.ts
git commit -m "feat(similarity): add generateExplanationNode - LLM explanation per similar property"
```

---

### Task 14: Assemble similarity graph + wire /similar in server.ts

**Files:**
- Create: `ai-service/src/graph/similarity/graph.ts`
- Modify: `ai-service/src/server.ts`

- [ ] **Step 1: Create similarityGraph.ts**

```typescript
// ai-service/src/graph/similarity/graph.ts
import { END, START, StateGraph } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import { SimilarityAnnotation, type SimilarityState } from "./types.js";
import { createFetchPropertyNode } from "./nodes/fetchPropertyNode.js";
import { createTraverseGraphNode } from "./nodes/traverseGraphNode.js";
import { createScoreSimilarityNode } from "./nodes/scoreSimilarityNode.js";
import { createGenerateExplanationNode } from "./nodes/generateExplanationNode.js";

function routeAfterFetch(state: SimilarityState): string {
  if (state.error) return "generateExplanation";
  return "traverseGraph";
}

function routeAfterTraverse(state: SimilarityState): string {
  if (state.error) return "generateExplanation";
  return "scoreSimilarity";
}

export function buildSimilarityGraph(llm: ChatOpenAI) {
  return new StateGraph(SimilarityAnnotation)
    .addNode("fetchProperty", createFetchPropertyNode())
    .addNode("traverseGraph", createTraverseGraphNode())
    .addNode("scoreSimilarity", createScoreSimilarityNode())
    .addNode("generateExplanation", createGenerateExplanationNode(llm))
    .addEdge(START, "fetchProperty")
    .addConditionalEdges("fetchProperty", routeAfterFetch)
    .addConditionalEdges("traverseGraph", routeAfterTraverse)
    .addEdge("scoreSimilarity", "generateExplanation")
    .addEdge("generateExplanation", END)
    .compile();
}
```

- [ ] **Step 2: Update server.ts to wire the similarity graph**

Replace `ai-service/src/server.ts`:

```typescript
// ai-service/src/server.ts
import Fastify from "fastify";
import { createLlm } from "./services/llm.js";
import { buildRankingGraph } from "./graph/ranking/graph.js";
import { buildSimilarityGraph } from "./graph/similarity/graph.js";
import { config } from "./config.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  const llm = createLlm();
  const rankingGraph = buildRankingGraph(llm);
  const similarityGraph = buildSimilarityGraph(llm);

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

  app.post<{
    Body: { property_id?: number; limit?: number };
  }>("/similar", async (request, reply) => {
    const property_id = Number(request.body?.property_id);
    const limit = Math.min(50, Math.max(1, Number(request.body?.limit ?? 10)));

    if (!property_id || isNaN(property_id)) {
      return reply.status(400).send({ data: null, message: "property_id is required" });
    }

    try {
      const state = await similarityGraph.invoke({ property_id, limit });
      return reply.send({
        data: {
          similar_properties: state.similarProperties ?? [],
          summary: state.summary ?? "",
          source_property_id: property_id,
        },
        message: state.error
          ? `Completed with error: ${state.error}`
          : "Similar properties found",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error(e);
      return reply.status(500).send({ data: null, message: msg });
    }
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}

export async function startServer() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });
}
```

- [ ] **Step 3: Type-check**

```bash
cd ai-service && npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Smoke-test /similar (requires Neo4j with data from extract-entities)**

```bash
curl -s -X POST http://localhost:3001/similar \
  -H "Content-Type: application/json" \
  -d '{"property_id":1,"limit":5}' | jq .
```
Expected: `{ data: { similar_properties: [...], summary: "..." } }`

- [ ] **Step 5: Commit**

```bash
git add ai-service/src/graph/similarity/ ai-service/src/server.ts
git commit -m "feat(similarity): wire similarity graph to /similar endpoint"
```

---

## Phase 3: Laravel + Frontend

### Task 15: Laravel AIController.similar() + route + feature test

**Files:**
- Modify: `app/Http/Controllers/Api/AIController.php`
- Modify: `routes/api.php`
- Create: `tests/Feature/AISimilarTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/AISimilarTest.php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AISimilarTest extends TestCase
{
    public function test_similar_proxies_to_ai_service_and_returns_data(): void
    {
        Http::fake([
            '*/similar' => Http::response([
                'data' => [
                    'similar_properties' => [
                        ['property_id' => 2, 'property_name' => 'Test Property', 'similarity_score' => 85],
                    ],
                    'summary' => 'Found 1 similar property.',
                    'source_property_id' => 1,
                ],
                'message' => 'Similar properties found',
            ], 200),
        ]);

        $response = $this->postJson('/api/ai/similar', [
            'property_id' => 1,
            'limit' => 5,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.source_property_id', 1)
            ->assertJsonPath('data.summary', 'Found 1 similar property.')
            ->assertJsonCount(1, 'data.similar_properties');
    }

    public function test_similar_returns_400_when_property_id_missing(): void
    {
        $response = $this->postJson('/api/ai/similar', []);

        $response->assertStatus(422);
    }

    public function test_similar_returns_503_when_ai_service_unreachable(): void
    {
        Http::fake([
            '*/similar' => Http::response([], 500),
        ]);

        $response = $this->postJson('/api/ai/similar', [
            'property_id' => 1,
        ]);

        $response->assertStatus(503)
            ->assertJsonPath('data', null);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
php artisan test tests/Feature/AISimilarTest.php
```
Expected: FAIL — `similar` route does not exist.

- [ ] **Step 3: Add the route**

In `routes/api.php`, add after the existing AI routes:

```php
Route::post('/ai/similar', [AIController::class, 'similar']);
```

- [ ] **Step 4: Add similar() to AIController**

In `app/Http/Controllers/Api/AIController.php`, add after the `scoreProperties` method:

```php
/**
 * Find properties similar to a given property via GraphRAG.
 * POST /api/ai/similar
 * Body: { "property_id": 1, "limit": 10 }
 */
public function similar(Request $request): JsonResponse
{
    $request->validate([
        'property_id' => 'required|integer|min:1',
        'limit' => 'nullable|integer|min:1|max:50',
    ]);

    $propertyId = (int) $request->property_id;
    $limit = $request->limit ? (int) $request->limit : 10;

    $serviceUrl = config('ai.service_url');
    if (empty($serviceUrl)) {
        return response()->json([
            'data' => null,
            'message' => 'AI service URL not configured. Set AI_SERVICE_URL in .env.',
        ], 503);
    }

    try {
        $url = rtrim((string) $serviceUrl, '/') . '/similar';
        $response = Http::timeout(60)
            ->acceptJson()
            ->asJson()
            ->post($url, [
                'property_id' => $propertyId,
                'limit' => $limit,
            ]);

        if ($response->successful()) {
            return response()->json($response->json());
        }

        Log::warning('AI service /similar failed', [
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        return response()->json([
            'data' => null,
            'message' => 'AI service returned an error: ' . $response->status(),
        ], 503);
    } catch (Exception $e) {
        Log::error('AI similar error: ' . $e->getMessage());
        return response()->json([
            'data' => null,
            'message' => 'AI service unreachable: ' . $e->getMessage(),
        ], 503);
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
php artisan test tests/Feature/AISimilarTest.php
```
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/AIController.php routes/api.php tests/Feature/AISimilarTest.php
git commit -m "feat(laravel): add POST /api/ai/similar endpoint with proxy to AI service"
```

---

### Task 16: Frontend — store action + PropertyShow.vue similar section

**Files:**
- Modify: `resources/js/stores/propertyStore.js`
- Modify: `resources/js/pages/PropertyShow.vue`

- [ ] **Step 1: Add findSimilar action to propertyStore**

In `resources/js/stores/propertyStore.js`, add the following action before the `return` statement:

```javascript
const similarProperties = ref([]);
const loadingSimilar = ref(false);

async function findSimilar(propertyId, limit = 5) {
    loadingSimilar.value = true;
    similarProperties.value = [];
    try {
        const { data } = await api.post('/ai/similar', { property_id: propertyId, limit });
        similarProperties.value = data.data?.similar_properties ?? [];
        return data.data;
    } catch (err) {
        error.value = err.response?.data?.message || err.message;
        throw err;
    } finally {
        loadingSimilar.value = false;
    }
}
```

And expose them in the return:

```javascript
return {
    properties,
    currentProperty,
    loading,
    loadingOne,
    error,
    propertyCount,
    similarProperties,
    loadingSimilar,
    fetchProperties,
    fetchProperty,
    createProperty,
    addNote,
    fetchNotes,
    extractFeatures,
    fetchFeatures,
    findSimilar,
};
```

- [ ] **Step 2: Add "Similar Properties" section to PropertyShow.vue**

Read `resources/js/pages/PropertyShow.vue` first, then add the following section before the closing `</template>` or at the bottom of the main content area.

Add this template block inside the page's main container, after the features/notes sections:

```html
<!-- Similar Properties -->
<div class="mt-8">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Similar Properties</h2>
    <button
      @click="loadSimilar"
      :disabled="store.loadingSimilar"
      class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {{ store.loadingSimilar ? 'Finding...' : 'Find Similar' }}
    </button>
  </div>

  <p v-if="similarSummary" class="mb-4 text-sm text-gray-600 dark:text-gray-400 italic">
    {{ similarSummary }}
  </p>

  <div v-if="store.similarProperties.length > 0" class="space-y-3">
    <div
      v-for="prop in store.similarProperties"
      :key="prop.property_id"
      class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 transition-colors"
    >
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <router-link
            :to="`/properties/${prop.property_id}`"
            class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
          >
            {{ prop.property_name }}
          </router-link>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ prop.address }}</p>
          <p class="text-sm text-gray-700 dark:text-gray-300 mt-2">{{ prop.explanation }}</p>
          <div v-if="prop.shared_concepts.length" class="flex flex-wrap gap-1 mt-2">
            <span
              v-for="concept in prop.shared_concepts"
              :key="concept"
              class="px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full"
            >
              {{ concept }}
            </span>
          </div>
        </div>
        <div class="ml-4 flex-shrink-0 text-center">
          <div class="text-2xl font-bold" :class="scoreColor(prop.similarity_score)">
            {{ prop.similarity_score }}%
          </div>
          <div class="text-xs text-gray-400">similar</div>
        </div>
      </div>
    </div>
  </div>

  <p
    v-else-if="!store.loadingSimilar && similarSearched"
    class="text-sm text-gray-500 dark:text-gray-400"
  >
    No similar properties found. Try running <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">npm run extract-entities</code> in the ai-service to populate the knowledge graph.
  </p>
</div>
```

Add the following to the component's `<script setup>` (or `setup()`) alongside existing refs and methods:

```javascript
const similarSummary = ref('');
const similarSearched = ref(false);

async function loadSimilar() {
  try {
    const result = await store.findSimilar(property.value.id, 5);
    similarSummary.value = result?.summary ?? '';
    similarSearched.value = true;
  } catch {
    similarSearched.value = true;
  }
}

function scoreColor(score) {
  if (score >= 75) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-500 dark:text-gray-400';
}
```

- [ ] **Step 3: Build and check for errors**

```bash
npm run build
```
Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add resources/js/stores/propertyStore.js resources/js/pages/PropertyShow.vue
git commit -m "feat(frontend): add findSimilar action and Similar Properties section to PropertyShow"
```

---

## Phase 4: Cleanup

### Task 17: Delete old AI service files

**Files to delete:**
- `ai-service/src/graph/graph.ts`
- `ai-service/src/graph/nodes/parseRequirementsNode.ts`
- `ai-service/src/graph/nodes/generateResponseNode.ts`
- `ai-service/src/graph/nodes/retrievePropertiesNode.ts`
- `ai-service/src/graph/nodes/scoreCandidatesNode.ts`
- `ai-service/src/graph/nodes/loosenCriteriaNode.ts`
- `ai-service/src/graph/nodes/hydrateFromLaravelNode.ts`
- `ai-service/src/graph/nodes/cypherGeneratorNode.ts`
- `ai-service/src/graph/nodes/cypherExecutorNode.ts`
- `ai-service/src/graph/nodes/cypherCorrectionNode.ts`
- `ai-service/src/graph/nodes/cypherUtils.ts`
- `ai-service/scripts/sync-graph.ts`

- [ ] **Step 1: Delete old files**

```bash
cd ai-service
rm src/graph/graph.ts \
   src/graph/nodes/parseRequirementsNode.ts \
   src/graph/nodes/generateResponseNode.ts \
   src/graph/nodes/retrievePropertiesNode.ts \
   src/graph/nodes/scoreCandidatesNode.ts \
   src/graph/nodes/loosenCriteriaNode.ts \
   src/graph/nodes/hydrateFromLaravelNode.ts \
   src/graph/nodes/cypherGeneratorNode.ts \
   src/graph/nodes/cypherExecutorNode.ts \
   src/graph/nodes/cypherCorrectionNode.ts \
   src/graph/nodes/cypherUtils.ts \
   scripts/sync-graph.ts
```

- [ ] **Step 2: Check for any remaining imports of deleted files**

```bash
cd ai-service && grep -r "from.*graph/graph\|from.*nodes/cypher\|from.*nodes/loosen\|from.*nodes/hydrate\|from.*nodes/retrieve\|from.*nodes/scoreCandidates\|from.*nodes/parseRequirements\|from.*nodes/generateResponse\|sync-graph" src/ scripts/ 2>/dev/null
```
Expected: no output.

- [ ] **Step 3: Type-check the full project**

```bash
cd ai-service && npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ai-service && git add -A
git commit -m "chore: remove old Text-to-Cypher nodes and sync-graph script"
```

---

## Final Verification

- [ ] Run full Laravel test suite: `php artisan test`
- [ ] Type-check AI service: `cd ai-service && npm run typecheck`
- [ ] Build frontend: `npm run build`
- [ ] Smoke-test ranking: `curl -X POST http://localhost:3001/search -H "Content-Type: application/json" -d '{"requirements":"office with parking","limit":3}' | jq .`
- [ ] Smoke-test similarity (after running `npm run extract-entities`): `curl -X POST http://localhost:3001/similar -H "Content-Type: application/json" -d '{"property_id":1,"limit":3}' | jq .`
- [ ] Smoke-test Laravel proxy: `curl -X POST http://localhost:8000/api/ai/similar -H "Content-Type: application/json" -d '{"property_id":1,"limit":3}' | jq .`
