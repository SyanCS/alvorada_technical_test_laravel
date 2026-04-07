/**
 * Entry for LangGraph CLI / Studio: `npx @langchain/langgraph-cli dev`
 */
import { createLlm } from "../services/llm.js";
import { buildPropertySearchGraph } from "./graph.js";

const llm = createLlm();
export const graph = buildPropertySearchGraph(llm);
