# Alvorada AI service (LangGraph + Neo4j Graph RAG)

## Setup

1. Copy `.env.example` to `.env` and set `LLM_API_KEY` (OpenRouter), `LARAVEL_API_URL`, and for Graph RAG: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`.
2. `npm install`
3. Start Neo4j (e.g. via repo root `docker compose up -d neo4j`).
4. **Sync the graph** after Laravel has data: `npm run sync-graph`
5. `npm start` — listens on `PORT` (default 3001). `POST /search` runs the scoring graph.

If `NEO4J_URI` / `NEO4J_PASSWORD` are unset, the service uses **SQL-only** retrieval (Laravel `/properties/search`) instead of LLM Cypher.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Fastify + LangGraph |
| `npm run sync-graph` | MERGE properties and notes from Laravel into Neo4j |
| `npm run typecheck` | TypeScript |

## LangGraph Studio

`langgraph.json` registers `property_search` from `src/graph/factory.ts`. Use `@langchain/langgraph-cli` to develop against the same graph.
