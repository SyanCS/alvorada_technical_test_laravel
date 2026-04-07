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
