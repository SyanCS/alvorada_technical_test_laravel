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
