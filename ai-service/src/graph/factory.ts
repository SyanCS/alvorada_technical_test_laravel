/**
 * Entry for LangGraph CLI / Studio: `npx @langchain/langgraph-cli dev`
 */
import "../envBootstrap.js";
import { createLlm } from "../services/llm.js";
import { buildRankingGraph } from "./ranking/graph.js";

const llm = createLlm();
export const graph = buildRankingGraph(llm);
