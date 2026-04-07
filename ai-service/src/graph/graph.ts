import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import { createParseRequirementsNode } from "./nodes/parseRequirementsNode.js";
import { createRetrievePropertiesNode } from "./nodes/retrievePropertiesNode.js";
import { createLoosenCriteriaNode } from "./nodes/loosenCriteriaNode.js";
import { createScoreCandidatesNode } from "./nodes/scoreCandidatesNode.js";
import { createGenerateResponseNode } from "./nodes/generateResponseNode.js";

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
});

export type PropertySearchStateType = typeof PropertySearchAnnotation.State;

export function buildPropertySearchGraph(llm: ChatOpenAI) {
  const parseRequirements = createParseRequirementsNode(llm);
  const retrieveProperties = createRetrievePropertiesNode(RETRIEVAL_LIMIT);
  const loosenCriteria = createLoosenCriteriaNode();
  const scoreCandidates = createScoreCandidatesNode(llm);
  const generateResponse = createGenerateResponseNode(llm);

  const workflow = new StateGraph(PropertySearchAnnotation)
    .addNode("parseRequirements", parseRequirements)
    .addNode("retrieveProperties", retrieveProperties)
    .addNode("loosenCriteria", loosenCriteria)
    .addNode("scoreCandidates", scoreCandidates)
    .addNode("generateResponse", generateResponse)
    .addEdge(START, "parseRequirements")
    .addConditionalEdges("parseRequirements", (state: PropertySearchStateType) => {
      if (state.error) return "generateResponse";
      return "retrieveProperties";
    })
    .addConditionalEdges("retrieveProperties", (state: PropertySearchStateType) => {
      if (state.error?.startsWith("retrieve")) return "generateResponse";
      const n = state.candidates?.length ?? 0;
      if (n > 0) return "scoreCandidates";
      if ((state.loosenAttempts ?? 0) < MAX_LOOSEN) return "loosenCriteria";
      return "generateResponse";
    })
    .addEdge("loosenCriteria", "retrieveProperties")
    .addEdge("scoreCandidates", "generateResponse")
    .addEdge("generateResponse", END);

  return workflow.compile();
}
