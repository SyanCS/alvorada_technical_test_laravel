import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import { isNeo4jConfigured } from "../config.js";
import { createParseRequirementsNode } from "./nodes/parseRequirementsNode.js";
import { createRetrievePropertiesNode } from "./nodes/retrievePropertiesNode.js";
import { createLoosenCriteriaNode } from "./nodes/loosenCriteriaNode.js";
import { createScoreCandidatesNode } from "./nodes/scoreCandidatesNode.js";
import { createGenerateResponseNode } from "./nodes/generateResponseNode.js";
import { createCypherGeneratorNode } from "./nodes/cypherGeneratorNode.js";
import { createCypherExecutorNode } from "./nodes/cypherExecutorNode.js";
import { createCypherCorrectionNode } from "./nodes/cypherCorrectionNode.js";
import { createHydrateFromLaravelNode } from "./nodes/hydrateFromLaravelNode.js";

/** Max loosen rounds — must match keys in loosenCriteriaNode */
const MAX_LOOSEN = 7;

const RETRIEVAL_LIMIT = 80;

export const PropertySearchAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  resultLimit: Annotation<number>,
  criteria: Annotation<Record<string, unknown> | undefined>,
  candidates: Annotation<unknown[] | undefined>,
  scoredProperties: Annotation<unknown[] | undefined>,
  answer: Annotation<string | undefined>,
  followUpQuestions: Annotation<string[] | undefined>,
  loosenAttempts: Annotation<number | undefined>,
  error: Annotation<string | undefined>,
  totalPropertiesInDb: Annotation<number | undefined>,
  lastRetrieveCount: Annotation<number | undefined>,

  cypherQuery: Annotation<string | undefined>,
  cypherExplanation: Annotation<string | undefined>,
  neo4jPropertyIds: Annotation<number[] | undefined>,
  graphRows: Annotation<unknown[] | undefined>,
  needsCypherCorrection: Annotation<boolean | undefined>,
  cypherExecutionError: Annotation<string | undefined>,
  cypherValidationError: Annotation<string | undefined>,
  cypherCorrectionAttempts: Annotation<number | undefined>,
  retrievalSource: Annotation<"graph" | "sql" | undefined>,
});

export type PropertySearchStateType = typeof PropertySearchAnnotation.State;

function routeAfterParse(state: PropertySearchStateType): string {
  if (state.error?.startsWith("parseRequirements")) return "generateResponse";
  return "cypherGenerator";
}

function routeAfterCypherGenerator(state: PropertySearchStateType): string {
  if (state.error?.startsWith("cypherGenerator")) return "generateResponse";
  return "cypherExecutor";
}

function routeAfterCypherExecutor(state: PropertySearchStateType): string {
  if (state.needsCypherCorrection) return "cypherCorrection";
  if ((state.neo4jPropertyIds?.length ?? 0) > 0) return "hydrateFromLaravel";
  return "retrieveProperties";
}

function routeAfterHydrate(state: PropertySearchStateType): string {
  if ((state.candidates?.length ?? 0) > 0) return "scoreCandidates";
  return "retrieveProperties";
}

function routeAfterRetrieve(state: PropertySearchStateType): string {
  if (state.error?.startsWith("retrieve")) return "generateResponse";
  const n = state.candidates?.length ?? 0;
  if (n > 0) return "scoreCandidates";
  if ((state.loosenAttempts ?? 0) < MAX_LOOSEN) return "loosenCriteria";
  return "generateResponse";
}

function buildNeo4jGraph(llm: ChatOpenAI) {
  const parseRequirements = createParseRequirementsNode(llm);
  const cypherGenerator = createCypherGeneratorNode(llm);
  const cypherExecutor = createCypherExecutorNode();
  const cypherCorrection = createCypherCorrectionNode(llm);
  const hydrateFromLaravel = createHydrateFromLaravelNode();
  const retrieveProperties = createRetrievePropertiesNode(RETRIEVAL_LIMIT);
  const loosenCriteria = createLoosenCriteriaNode();
  const scoreCandidates = createScoreCandidatesNode(llm);
  const generateResponse = createGenerateResponseNode(llm);

  return new StateGraph(PropertySearchAnnotation)
    .addNode("parseRequirements", parseRequirements)
    .addNode("cypherGenerator", cypherGenerator)
    .addNode("cypherExecutor", cypherExecutor)
    .addNode("cypherCorrection", cypherCorrection)
    .addNode("hydrateFromLaravel", hydrateFromLaravel)
    .addNode("retrieveProperties", retrieveProperties)
    .addNode("loosenCriteria", loosenCriteria)
    .addNode("scoreCandidates", scoreCandidates)
    .addNode("generateResponse", generateResponse)
    .addEdge(START, "parseRequirements")
    .addConditionalEdges("parseRequirements", routeAfterParse)
    .addConditionalEdges("cypherGenerator", routeAfterCypherGenerator)
    .addConditionalEdges("cypherExecutor", routeAfterCypherExecutor)
    .addEdge("cypherCorrection", "cypherExecutor")
    .addConditionalEdges("hydrateFromLaravel", routeAfterHydrate)
    .addConditionalEdges("retrieveProperties", routeAfterRetrieve)
    .addEdge("loosenCriteria", "retrieveProperties")
    .addEdge("scoreCandidates", "generateResponse")
    .addEdge("generateResponse", END)
    .compile();
}

function buildSqlOnlyGraph(llm: ChatOpenAI) {
  const parseRequirements = createParseRequirementsNode(llm);
  const retrieveProperties = createRetrievePropertiesNode(RETRIEVAL_LIMIT);
  const loosenCriteria = createLoosenCriteriaNode();
  const scoreCandidates = createScoreCandidatesNode(llm);
  const generateResponse = createGenerateResponseNode(llm);

  return new StateGraph(PropertySearchAnnotation)
    .addNode("parseRequirements", parseRequirements)
    .addNode("retrieveProperties", retrieveProperties)
    .addNode("loosenCriteria", loosenCriteria)
    .addNode("scoreCandidates", scoreCandidates)
    .addNode("generateResponse", generateResponse)
    .addEdge(START, "parseRequirements")
    .addConditionalEdges("parseRequirements", (state: PropertySearchStateType) => {
      if (state.error?.startsWith("parseRequirements")) return "generateResponse";
      return "retrieveProperties";
    })
    .addConditionalEdges("retrieveProperties", routeAfterRetrieve)
    .addEdge("loosenCriteria", "retrieveProperties")
    .addEdge("scoreCandidates", "generateResponse")
    .addEdge("generateResponse", END)
    .compile();
}

export function buildPropertySearchGraph(llm: ChatOpenAI) {
  if (isNeo4jConfigured()) {
    return buildNeo4jGraph(llm);
  }
  return buildSqlOnlyGraph(llm);
}
