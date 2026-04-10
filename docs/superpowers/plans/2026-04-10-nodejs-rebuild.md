# Node.js Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Laravel backend and AI service into a single Fastify + Drizzle + LangGraph server, keeping the Vue 3 SPA.

**Architecture:** Fastify serves both API routes and the built Vue SPA on one port (:3000). Drizzle ORM replaces Eloquent for Postgres. The existing LangGraph graphs stay in-process. The `laravelClient.ts` HTTP calls become direct Drizzle queries.

**Tech Stack:** Fastify 5, Drizzle ORM, PostgreSQL 16, LangGraph, Vue 3, Vite, Tailwind CSS 4, TypeScript

---

## File Structure

| File | Responsibility |
|---|---|
| `src/index.ts` | Entry point — env bootstrap + start server |
| `src/config.ts` | All env vars (DB, LLM, Neo4j, server) |
| `src/server.ts` | Fastify app — register routes, static serving, CORS |
| `src/db/schema.ts` | Drizzle table definitions (properties, notes, property_features) |
| `src/db/index.ts` | Drizzle client + node-postgres pool |
| `src/db/seed.ts` | Property seeder (275 US properties) |
| `src/routes/properties.ts` | CRUD + search + by-ids routes |
| `src/routes/notes.ts` | List + create notes |
| `src/routes/ai.ts` | extract-features, score, score/stream, similar, get-features |
| `src/services/geolocation.ts` | Nominatim geocoding |
| `src/services/openrouter.ts` | OpenRouter LLM client with retries |
| `src/services/featureExtraction.ts` | Notes → structured features via LLM |
| `src/services/propertyScoring.ts` | LLM-based property scoring (fallback) |
| `src/services/llm.ts` | Existing — ChatOpenAI factory |
| `src/services/neo4jService.ts` | Existing — Neo4j driver + query helpers |
| `src/graph/**` | Existing LangGraph code (ranking + similarity) |
| `client/**` | Vue SPA (moved from resources/js/) |
| `public/index.html` | SPA HTML entry point |
| `client/css/app.css` | Tailwind CSS (moved from resources/css/) |
| `vite.config.ts` | Standalone Vite config (no laravel-vite-plugin) |
| `drizzle.config.ts` | Drizzle Kit config |
| `package.json` | Unified dependencies |
| `tsconfig.json` | TypeScript config |
| `Dockerfile` | Node.js production image |
| `docker-compose.yml` | 3 services (app, postgres, neo4j) |
| `.env.example` | All env vars documented |

---

## Task 1: Project Scaffolding — package.json, tsconfig, env

**Files:**
- Create: `package.json` (replace existing)
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `src/config.ts`
- Create: `src/envBootstrap.ts`

This task sets up the Node.js project foundation. All subsequent tasks depend on this.

- [ ] **Step 1: Create the unified package.json**

```json
{
  "name": "alvorada",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -n api,vite -c blue,green \"node --watch --import tsx src/index.ts\" \"vite\"",
    "dev:api": "node --watch --import tsx src/index.ts",
    "dev:vite": "vite",
    "build": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "start": "node --import tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "node --import tsx src/db/migrate.ts",
    "db:seed": "node --import tsx src/db/seed.ts"
  },
  "dependencies": {
    "@langchain/core": "^0.3.72",
    "@langchain/langgraph": "^0.2.74",
    "@langchain/openai": "^0.3.17",
    "@fastify/static": "^8.1.0",
    "drizzle-orm": "^0.44.0",
    "fastify": "^5.7.4",
    "neo4j-driver": "^5.28.3",
    "pg": "^8.16.0",
    "tsx": "^4.19.2",
    "zod": "^3.24.1",
    "@types/leaflet": "^1.9.21",
    "@vitejs/plugin-vue": "^6.0.5",
    "@vueuse/core": "^14.2.1",
    "axios": ">=1.11.0 <=1.14.0",
    "leaflet": "^1.9.4",
    "pinia": "^3.0.4",
    "vue": "^3.5.32",
    "vue-router": "^4.6.4"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.2",
    "@types/node": "^22.10.0",
    "@types/pg": "^8.15.2",
    "concurrently": "^9.0.1",
    "drizzle-kit": "^0.31.0",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.7.2",
    "vite": "^8.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://alvorada_user:alvorada_password@localhost:5432/alvorada_db

# LLM (OpenRouter)
LLM_API_KEY=
LLM_MODEL=google/gemini-2.0-flash-001

# Neo4j (optional — enables graph similarity path)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j-secret

# Tracing (optional — LangSmith)
LANGSMITH_API_KEY=
LANGCHAIN_TRACING_V2=false
LANGCHAIN_PROJECT=alvorada-property-research

# Server
PORT=3000
NODE_ENV=development
```

- [ ] **Step 4: Create src/envBootstrap.ts**

Copy from existing `ai-service/src/envBootstrap.ts` — same LangSmith alias logic:

```typescript
if (!process.env.LANGCHAIN_API_KEY && process.env.LANGSMITH_API_KEY) {
  process.env.LANGCHAIN_API_KEY = process.env.LANGSMITH_API_KEY;
}
```

- [ ] **Step 5: Create src/config.ts**

Extend the existing AI service config with database URL:

```typescript
export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://alvorada_user:alvorada_password@localhost:5432/alvorada_db",

  // LLM (OpenRouter)
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? process.env.LLM_API_KEY ?? "",
  model: process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001",
  httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? "https://alvorada-property-research.com",
  xTitle: process.env.OPENROUTER_X_TITLE ?? "Alvorada Property Research System",

  // Neo4j (optional)
  neo4jUri: (process.env.NEO4J_URI ?? "").trim(),
  neo4jUser: process.env.NEO4J_USER ?? "neo4j",
  neo4jPassword: process.env.NEO4J_PASSWORD ?? "",

  // Geolocation
  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org/search",
  nominatimReverseUrl: process.env.NOMINATIM_REVERSE_URL ?? "https://nominatim.openstreetmap.org/reverse",
  nominatimUserAgent: "AlvoradaPropertyResearch/2.0",
  nominatimTimeout: 10_000,
};

export function isNeo4jConfigured(): boolean {
  return Boolean(config.neo4jUri && config.neo4jPassword);
}
```

- [ ] **Step 6: Install dependencies**

```bash
rm -rf node_modules package-lock.json
npm install
```

- [ ] **Step 7: Verify typecheck passes**

```bash
npx tsc --noEmit
```

Expected: passes (only config + envBootstrap files so far)

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json .env.example src/config.ts src/envBootstrap.ts
git commit -m "feat: scaffold Node.js project with unified package.json and config"
```

---

## Task 2: Drizzle Schema + Database Layer

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `drizzle.config.ts`
- Create: `src/db/migrate.ts`

- [ ] **Step 1: Create drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://alvorada_user:alvorada_password@localhost:5432/alvorada_db",
  },
});
```

- [ ] **Step 2: Create src/db/schema.ts**

```typescript
import { pgTable, serial, varchar, text, decimal, json, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  address: varchar("address", { length: 255 }).unique().notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  extraField: json("extra_field"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertyFeatures = pgTable("property_features", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }).unique().notNull(),
  nearSubway: boolean("near_subway"),
  needsRenovation: boolean("needs_renovation"),
  parkingAvailable: boolean("parking_available"),
  hasElevator: boolean("has_elevator"),
  estimatedCapacityPeople: integer("estimated_capacity_people"),
  floorLevel: integer("floor_level"),
  conditionRating: integer("condition_rating"),
  recommendedUse: varchar("recommended_use", { length: 100 }),
  amenities: json("amenities").$type<string[]>(),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  sourceNotesCount: integer("source_notes_count"),
  rawAiResponse: json("raw_ai_response"),
  extractedAt: timestamp("extracted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for query builder convenience
export const propertiesRelations = relations(properties, ({ many, one }) => ({
  notes: many(notes),
  propertyFeature: one(propertyFeatures, {
    fields: [properties.id],
    references: [propertyFeatures.propertyId],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  property: one(properties, {
    fields: [notes.propertyId],
    references: [properties.id],
  }),
}));

export const propertyFeaturesRelations = relations(propertyFeatures, ({ one }) => ({
  property: one(properties, {
    fields: [propertyFeatures.propertyId],
    references: [properties.id],
  }),
}));
```

- [ ] **Step 3: Create src/db/index.ts**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const db = drizzle(pool, { schema });

export { schema };
```

- [ ] **Step 4: Create src/db/migrate.ts**

```typescript
import "../envBootstrap.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { config } from "../config.js";

async function main() {
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const db = drizzle(pool);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: Generate the initial migration**

```bash
npx drizzle-kit generate
```

Expected: creates SQL file in `drizzle/` directory.

- [ ] **Step 6: Commit**

```bash
git add src/db/ drizzle.config.ts drizzle/
git commit -m "feat: add Drizzle schema and migration for properties, notes, property_features"
```

---

## Task 3: Services — Geolocation + OpenRouter + Feature Extraction + Scoring

**Files:**
- Create: `src/services/geolocation.ts`
- Create: `src/services/openrouter.ts`
- Create: `src/services/featureExtraction.ts`
- Create: `src/services/propertyScoring.ts`
- Move: `ai-service/src/services/llm.ts` → `src/services/llm.ts`
- Move: `ai-service/src/services/neo4jService.ts` → `src/services/neo4jService.ts`

These services are direct ports of the PHP equivalents using `fetch` instead of Laravel's Http facade.

- [ ] **Step 1: Move existing AI service files**

```bash
cp ai-service/src/services/llm.ts src/services/llm.ts
cp ai-service/src/services/neo4jService.ts src/services/neo4jService.ts
```

No code changes needed — these files already import from `../config.js` which matches the new location.

- [ ] **Step 2: Create src/services/geolocation.ts**

Port of `app/Services/GeolocationService.php`:

```typescript
import { config } from "../config.js";

export interface GeocodedAddress {
  latitude: number;
  longitude: number;
  extraField: Record<string, unknown>;
  displayName: string;
}

export async function geocodeAddress(address: string): Promise<GeocodedAddress> {
  if (!address.trim()) {
    throw new Error("Address cannot be empty");
  }

  const url = new URL(config.nominatimBaseUrl);
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": config.nominatimUserAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(config.nominatimTimeout),
  });

  if (!res.ok) {
    throw new Error(`Nominatim API request failed with status ${res.status}`);
  }

  const results = (await res.json()) as Record<string, unknown>[];
  if (!results.length) {
    throw new Error("No results found for the provided address");
  }

  const result = results[0];
  return {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    displayName: String(result.display_name ?? address),
    extraField: {
      display_name: result.display_name ?? "",
      type: result.type ?? "",
      class: result.class ?? "",
      importance: result.importance ?? 0,
      place_id: result.place_id ?? null,
      osm_type: result.osm_type ?? "",
      osm_id: result.osm_id ?? null,
      boundingbox: result.boundingbox ?? [],
    },
  };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<{ address: string; addressDetails: Record<string, unknown> }> {
  const url = new URL(config.nominatimReverseUrl);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": config.nominatimUserAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(config.nominatimTimeout),
  });

  const data = (await res.json()) as Record<string, unknown>;
  return {
    address: String(data.display_name ?? "Unknown location"),
    addressDetails: (data.address ?? {}) as Record<string, unknown>,
  };
}
```

- [ ] **Step 3: Create src/services/openrouter.ts**

Port of `app/Services/OpenRouterService.php`:

```typescript
import { config } from "../config.js";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(messages: ChatMessage[], options: { temperature?: number; maxTokens?: number; responseFormat?: "json" } = {}): Promise<Record<string, unknown>> {
  if (!config.openRouterApiKey) {
    throw new Error("OpenRouter API key not configured. Set LLM_API_KEY in .env.");
  }

  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1000,
  };

  if (options.responseFormat === "json") {
    payload.response_format = { type: "json_object" };
  }

  return makeRequestWithRetry(payload);
}

export async function extractStructuredData(systemPrompt: string, userPrompt: string, options: { temperature?: number; maxTokens?: number } = {}): Promise<{ data: Record<string, unknown>; rawResponse: string }> {
  const response = await chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { ...options, responseFormat: "json" },
  );

  const text = extractTextFromResponse(response);
  const data = JSON.parse(text);

  return { data, rawResponse: text };
}

function extractTextFromResponse(response: Record<string, unknown>): string {
  const choices = response.choices as { message: { content: string } }[] | undefined;
  if (!choices?.[0]?.message?.content) {
    throw new Error("Unexpected API response format: " + JSON.stringify(response));
  }
  return choices[0].message.content;
}

async function makeRequestWithRetry(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  let lastError: Error | undefined;
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openRouterApiKey}`,
          "HTTP-Referer": config.httpReferer,
          "X-Title": config.xTitle,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (data.error) {
        const errObj = data.error as Record<string, unknown>;
        throw new Error("API error: " + (errObj.message ?? JSON.stringify(errObj)));
      }

      return data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const msg = lastError.message;

      // Don't retry auth errors
      if (msg.includes("invalid_api_key") || msg.includes("authentication") || msg.includes("401")) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2 ** (attempt - 1) * 1000));
      }
    }
  }

  throw new Error(`API request failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message ?? "Unknown"}`);
}
```

- [ ] **Step 4: Create src/services/featureExtraction.ts**

Port of `app/Services/FeatureExtractionService.php`. Uses the same prompts verbatim. Uses Drizzle for DB access.

```typescript
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { extractStructuredData } from "./openrouter.js";
import { config } from "../config.js";

const SYSTEM_PROMPT = `## ROLE
You are an expert commercial real estate analyst with deep expertise in property evaluation, feature analysis, and market assessment. You specialize in extracting structured insights from unstructured property research notes.

## TASK
Analyze the provided property research notes and extract structured information about key property features, amenities, and characteristics. Your goal is to transform unstructured observations into standardized, actionable data that can be used for property scoring and comparison.

## OUTPUT FORMAT
Return a valid JSON object with the following structure (no additional text or markdown):

{
  "near_subway": boolean or null,
  "needs_renovation": boolean or null,
  "parking_available": boolean or null,
  "has_elevator": boolean or null,
  "estimated_capacity_people": integer or null,
  "floor_level": integer or null,
  "condition_rating": integer or null,
  "recommended_use": string or null,
  "amenities": array or null,
  "confidence_score": float,
  "summary": string
}

## FIELD DEFINITIONS
- near_subway: Property is within 5-10 minutes walking distance to subway/metro/public transit
- needs_renovation: Property requires significant repairs or updates before use
- parking_available: On-site or dedicated parking spaces are available
- has_elevator: Building has a working elevator (relevant for multi-story buildings)
- estimated_capacity_people: Maximum comfortable occupancy (employees, customers, etc.)
- floor_level: Floor number the property is located on (ground floor = 0 or 1)
- condition_rating: Overall property condition (1=poor/uninhabitable, 2=fair/needs work, 3=good/move-in ready, 4=very good/recently updated, 5=excellent/newly built)
- recommended_use: Best business use case ("office", "retail", "warehouse", "logistics", "mixed", "restaurant", "medical", "industrial", etc.)
- amenities: List of features mentioned (e.g., ["kitchen", "conference room", "gym", "security", "wifi", "air conditioning"])
- confidence_score: Your confidence in the overall extraction quality (0.0 = low confidence, 1.0 = high confidence)
- summary: Concise 2-3 sentence overview of the property's key characteristics

## CONSTRAINTS
1. Evidence-based extraction: Only set a field if there is clear, explicit evidence in the notes
2. Use null for missing data: If information is uncertain, ambiguous, or not mentioned, use null
3. Conservative boolean logic: Only set true/false when explicitly stated or strongly implied
4. No assumptions: Don't infer information that isn't present in the notes
5. JSON only: Return pure JSON without markdown formatting, explanations, or additional text
6. Reasonable ranges: Ensure numeric values are realistic (e.g., capacity 1-1000, floors 0-100, rating 1-5)`;

export async function extractFeaturesFromProperty(propertyId: number, forceRefresh = false) {
  const property = await db.query.properties.findFirst({
    where: eq(schema.properties.id, propertyId),
  });
  if (!property) throw new Error(`Property with ID ${propertyId} not found`);

  if (!forceRefresh) {
    const existing = await db.query.propertyFeatures.findFirst({
      where: eq(schema.propertyFeatures.propertyId, propertyId),
    });
    if (existing) return existing;
  }

  const propertyNotes = await db.query.notes.findMany({
    where: eq(schema.notes.propertyId, propertyId),
    orderBy: (n, { desc }) => [desc(n.createdAt)],
  });

  if (propertyNotes.length === 0) {
    throw new Error("No notes found for property. Add some notes before extracting features.");
  }

  if (!config.openRouterApiKey) {
    throw new Error("LLM API key is not configured. Please add LLM_API_KEY to your .env file.");
  }

  const notesText = propertyNotes.map((n, i) => `Note ${i + 1}: ${n.note}`).join("\n");
  const userPrompt = `Property Information:\n- Name: ${property.name}\n- Address: ${property.address}\n- Total Notes: ${propertyNotes.length}\n\nResearch Notes:\n${notesText}\n\nPlease analyze these notes and extract structured features in JSON format.`;

  const { data } = await extractStructuredData(SYSTEM_PROMPT, userPrompt, { temperature: 0.3, maxTokens: 800 });

  // Handle array wrapper
  const parsed = Array.isArray(data) ? data[0] : data;

  const featureData = buildFeatureData(parsed, propertyId, propertyNotes.length);

  // Upsert
  const existing = await db.query.propertyFeatures.findFirst({
    where: eq(schema.propertyFeatures.propertyId, propertyId),
  });

  if (existing) {
    await db.update(schema.propertyFeatures)
      .set({ ...featureData, updatedAt: new Date() })
      .where(eq(schema.propertyFeatures.propertyId, propertyId));
  } else {
    await db.insert(schema.propertyFeatures).values(featureData);
  }

  return db.query.propertyFeatures.findFirst({
    where: eq(schema.propertyFeatures.propertyId, propertyId),
  });
}

function buildFeatureData(data: Record<string, unknown>, propertyId: number, notesCount: number) {
  const result: Record<string, unknown> = {
    propertyId,
    sourceNotesCount: notesCount,
    extractedAt: new Date(),
    rawAiResponse: data,
  };

  if (typeof data.near_subway === "boolean") result.nearSubway = data.near_subway;
  if (typeof data.needs_renovation === "boolean") result.needsRenovation = data.needs_renovation;
  if (typeof data.parking_available === "boolean") result.parkingAvailable = data.parking_available;
  if (typeof data.has_elevator === "boolean") result.hasElevator = data.has_elevator;

  if (typeof data.estimated_capacity_people === "number") result.estimatedCapacityPeople = data.estimated_capacity_people;
  if (typeof data.floor_level === "number") result.floorLevel = data.floor_level;
  if (typeof data.condition_rating === "number") {
    const r = data.condition_rating as number;
    if (r >= 1 && r <= 5) result.conditionRating = r;
  }

  if (typeof data.recommended_use === "string") result.recommendedUse = data.recommended_use;
  if (Array.isArray(data.amenities)) result.amenities = data.amenities;
  if (typeof data.confidence_score === "number") {
    result.confidenceScore = String(Math.min(1, Math.max(0, data.confidence_score)));
  }

  return result;
}

export function getFeatureSummary(feature: typeof schema.propertyFeatures.$inferSelect): string[] {
  const items: string[] = [];
  if (feature.nearSubway != null) items.push(feature.nearSubway ? "Near subway" : "Not near subway");
  if (feature.needsRenovation != null) items.push(feature.needsRenovation ? "Needs renovation" : "No renovation needed");
  if (feature.parkingAvailable != null) items.push(feature.parkingAvailable ? "Parking available" : "No parking");
  if (feature.hasElevator != null) items.push(feature.hasElevator ? "Has elevator" : "No elevator");
  if (feature.estimatedCapacityPeople != null) items.push(`Capacity: ${feature.estimatedCapacityPeople} people`);
  if (feature.recommendedUse != null) items.push(`Best for: ${feature.recommendedUse}`);
  if (feature.conditionRating != null) items.push(`Condition: ${feature.conditionRating}/5`);
  return items;
}
```

- [ ] **Step 5: Create src/services/propertyScoring.ts**

Port of `app/Services/PropertyScoringService.php`. Same prompts and parsing logic:

```typescript
import { db, schema } from "../db/index.js";
import { extractStructuredData } from "./openrouter.js";
import { config } from "../config.js";

const SCORING_SYSTEM_PROMPT = `You are an expert commercial real estate broker assistant with deep knowledge of property evaluation and client-property matching. Your task is to score how well a property matches a client's requirements using both basic property information and AI-extracted structured features.

## SCORING SCALE
Provide a score from 0 to 10:
- 0-3: Poor match
- 4-5: Fair match
- 6-7: Good match
- 8-9: Excellent match
- 10: Perfect match

## OUTPUT FORMAT
Return a valid JSON object (no markdown, no additional text):
{
  "score": float (0.0 to 10.0),
  "explanation": string (2-3 sentences),
  "strengths": array of strings,
  "weaknesses": array of strings,
  "confidence": float (0.0 to 1.0)
}`;

type PropertyRow = typeof schema.properties.$inferSelect;
type FeatureRow = typeof schema.propertyFeatures.$inferSelect;

export async function scoreProperty(property: PropertyRow, features: FeatureRow | null, clientRequirements: string) {
  const userPrompt = buildScoringUserPrompt(property, features, clientRequirements);
  const { data } = await extractStructuredData(SCORING_SYSTEM_PROMPT, userPrompt, { temperature: 0.1, maxTokens: 800 });
  return parseScoreResponse(data, property, features);
}

function buildScoringUserPrompt(property: PropertyRow, features: FeatureRow | null, requirements: string): string {
  let info = `PROPERTY NAME: ${property.name}\nADDRESS: ${property.address}\n`;
  const extra = property.extraField as Record<string, unknown> | null;
  if (extra?.city) info += `CITY: ${extra.city}\n`;
  if (extra?.state) info += `STATE: ${extra.state}\n`;

  if (features) {
    info += "\nAI-EXTRACTED FEATURES:\n";
    info += `Near Subway: ${features.nearSubway == null ? "UNKNOWN" : features.nearSubway ? "YES" : "NO"}\n`;
    info += `Recommended Use: ${features.recommendedUse ?? "UNKNOWN"}\n`;
    info += `Capacity: ${features.estimatedCapacityPeople ?? "UNKNOWN"}\n`;
    info += `Condition: ${features.conditionRating != null ? `${features.conditionRating}/5` : "UNKNOWN"}\n`;
    info += `Needs Renovation: ${features.needsRenovation == null ? "UNKNOWN" : features.needsRenovation ? "YES" : "NO"}\n`;
    info += `Parking: ${features.parkingAvailable == null ? "UNKNOWN" : features.parkingAvailable ? "AVAILABLE" : "NOT AVAILABLE"}\n`;
    info += `Elevator: ${features.hasElevator == null ? "UNKNOWN" : features.hasElevator ? "YES" : "NO"}\n`;
    const amenities = features.amenities as string[] | null;
    info += `Amenities: ${amenities?.length ? amenities.join(", ") : "NONE LISTED"}\n`;
  } else {
    info += "\nNO EXTRACTED FEATURES AVAILABLE\n";
  }

  return `PROPERTY DETAILS:\n${info}\n\nCLIENT REQUIREMENTS:\n${requirements}\n\nAnalyze and score in JSON format.`;
}

function parseScoreResponse(data: Record<string, unknown>, property: PropertyRow, features: FeatureRow | null) {
  const score = Math.min(10, Math.max(0, Number(data.score ?? 5)));
  const confidence = Math.min(1, Math.max(0, Number(data.confidence ?? 0.7)));

  return {
    property_id: property.id,
    property_name: property.name,
    address: property.address,
    score: Math.round(score * 10) / 10,
    explanation: String(data.explanation ?? "No explanation provided"),
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
    confidence: Math.round(confidence * 100) / 100,
    latitude: Number(property.latitude),
    longitude: Number(property.longitude),
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/services/
git commit -m "feat: add services — geolocation, openrouter, feature extraction, scoring, llm, neo4j"
```

---

## Task 4: API Routes — Properties + Notes + AI

**Files:**
- Create: `src/routes/properties.ts`
- Create: `src/routes/notes.ts`
- Create: `src/routes/ai.ts`

These routes replicate the exact same endpoints and response shapes as the Laravel API, so the Vue SPA needs no route changes.

- [ ] **Step 1: Create src/routes/properties.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { eq, desc, and, gte, lte, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { geocodeAddress } from "../services/geolocation.js";

export async function propertyRoutes(app: FastifyInstance) {
  // GET /api/properties
  app.get("/api/properties", async (_req, reply) => {
    try {
      const rows = await db.query.properties.findMany({
        with: { notes: true, propertyFeature: true },
        orderBy: (p, { desc: d }) => [d(p.createdAt)],
      });
      return reply.send({ data: rows, message: "Properties retrieved successfully", count: rows.length });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to retrieve properties" });
    }
  });

  // POST /api/properties
  app.post<{ Body: { name?: string; address?: string } }>("/api/properties", async (req, reply) => {
    try {
      const { name, address } = req.body ?? {};
      if (!name || name.length < 2 || name.length > 255) {
        return reply.status(422).send({ data: null, message: "Property name is required (2-255 chars)." });
      }
      if (!address || address.length < 5 || address.length > 500) {
        return reply.status(422).send({ data: null, message: "Address is required (5-500 chars)." });
      }

      const geo = await geocodeAddress(address);

      const [inserted] = await db.insert(schema.properties).values({
        name,
        address: geo.displayName,
        latitude: String(geo.latitude),
        longitude: String(geo.longitude),
        extraField: geo.extraField,
      }).returning();

      const property = await db.query.properties.findFirst({
        where: eq(schema.properties.id, inserted.id),
        with: { notes: true, propertyFeature: true },
      });

      return reply.status(201).send({ data: property, message: "Property created successfully" });
    } catch (e) {
      app.log.error(e);
      const msg = e instanceof Error ? e.message : "Failed to create property";
      return reply.status(422).send({ data: null, message: `Failed to create property: ${msg}` });
    }
  });

  // GET /api/properties/:id
  app.get<{ Params: { id: string } }>("/api/properties/:id", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      const property = await db.query.properties.findFirst({
        where: eq(schema.properties.id, id),
        with: { notes: true, propertyFeature: true },
      });
      if (!property) {
        return reply.status(404).send({ data: null, message: "Property not found" });
      }
      return reply.send({ data: property, message: "Property retrieved successfully" });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to retrieve property" });
    }
  });

  // POST /api/properties/search
  app.post<{ Body: { criteria?: Record<string, unknown>; limit?: number } }>("/api/properties/search", async (req, reply) => {
    try {
      const criteria = req.body?.criteria ?? {};
      const limit = Math.min(200, Math.max(1, Number(req.body?.limit ?? 50)));

      let query = db
        .select()
        .from(schema.properties)
        .innerJoin(schema.propertyFeatures, eq(schema.properties.id, schema.propertyFeatures.propertyId))
        .orderBy(desc(schema.properties.createdAt))
        .limit(limit);

      const conditions = [];

      if (criteria.recommended_use) {
        conditions.push(sql`LOWER(${schema.propertyFeatures.recommendedUse}) LIKE ${`%${String(criteria.recommended_use).toLowerCase()}%`}`);
      }
      if (criteria.near_subway != null) {
        conditions.push(eq(schema.propertyFeatures.nearSubway, Boolean(criteria.near_subway)));
      }
      if (criteria.parking_required != null) {
        conditions.push(eq(schema.propertyFeatures.parkingAvailable, Boolean(criteria.parking_required)));
      }
      if (criteria.min_capacity) {
        conditions.push(gte(schema.propertyFeatures.estimatedCapacityPeople, Number(criteria.min_capacity)));
      }
      if (criteria.max_capacity) {
        conditions.push(lte(schema.propertyFeatures.estimatedCapacityPeople, Number(criteria.max_capacity)));
      }
      if (criteria.min_condition) {
        conditions.push(gte(schema.propertyFeatures.conditionRating, Number(criteria.min_condition)));
      }
      if (criteria.needs_renovation != null) {
        conditions.push(eq(schema.propertyFeatures.needsRenovation, Boolean(criteria.needs_renovation)));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const rows = await query;

      // Reshape to match Laravel's response: property with nested property_feature
      const properties = rows.map((r) => ({
        ...r.properties,
        property_feature: r.property_features,
      }));

      return reply.send({
        data: { properties, count: properties.length, criteria },
        message: "Properties search completed",
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to search properties" });
    }
  });

  // POST /api/properties/by-ids
  app.post<{ Body: { ids?: number[] } }>("/api/properties/by-ids", async (req, reply) => {
    try {
      const ids = (req.body?.ids ?? []).map(Number);
      if (ids.length === 0) {
        return reply.send({ data: { properties: [], count: 0 }, message: "Properties retrieved successfully" });
      }

      const rows = await db.query.properties.findMany({
        where: inArray(schema.properties.id, ids),
        with: { notes: true, propertyFeature: true },
      });

      // Preserve requested order
      const map = new Map(rows.map((r) => [r.id, r]));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean);

      return reply.send({
        data: { properties: ordered, count: ordered.length },
        message: "Properties retrieved successfully",
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to load properties" });
    }
  });
}
```

- [ ] **Step 2: Create src/routes/notes.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export async function noteRoutes(app: FastifyInstance) {
  // GET /api/notes?property_id=N
  app.get<{ Querystring: { property_id?: string } }>("/api/notes", async (req, reply) => {
    try {
      const propertyId = Number(req.query.property_id);
      if (!propertyId || isNaN(propertyId)) {
        return reply.status(400).send({ data: null, message: "Invalid or missing property_id parameter" });
      }

      const rows = await db.query.notes.findMany({
        where: eq(schema.notes.propertyId, propertyId),
        orderBy: (n, { desc: d }) => [d(n.createdAt)],
      });

      return reply.send({ data: rows, message: "Notes retrieved successfully", count: rows.length });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to retrieve notes" });
    }
  });

  // POST /api/notes
  app.post<{ Body: { property_id?: number; note?: string } }>("/api/notes", async (req, reply) => {
    try {
      const { property_id, note } = req.body ?? {};
      if (!property_id) {
        return reply.status(422).send({ data: null, message: "Property ID is required." });
      }
      if (!note || note.length > 5000) {
        return reply.status(422).send({ data: null, message: "Note content is required (max 5000 chars)." });
      }

      // Verify property exists
      const property = await db.query.properties.findFirst({
        where: eq(schema.properties.id, property_id),
      });
      if (!property) {
        return reply.status(422).send({ data: null, message: "Property not found." });
      }

      const [inserted] = await db.insert(schema.notes).values({
        propertyId: property_id,
        note,
      }).returning();

      return reply.status(201).send({ data: inserted, message: "Note added successfully" });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to add note" });
    }
  });
}
```

- [ ] **Step 3: Create src/routes/ai.ts**

This replaces both the Laravel AIController AND the AI service's `/search`, `/search/stream`, `/similar` endpoints — all in one place, calling the LangGraph graphs directly.

```typescript
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { extractFeaturesFromProperty, getFeatureSummary } from "../services/featureExtraction.js";
import type { ChatOpenAI } from "@langchain/openai";
import type { CompiledStateGraph } from "@langchain/langgraph";
import type { RankingState } from "../graph/ranking/types.js";
import type { SimilarityState } from "../graph/similarity/types.js";

const NODE_LABELS: Record<string, string> = {
  parseRequirements: "Parsing requirements",
  buildRankingQuery: "Building ranking query",
  validateQuery: "Validating query",
  executeRanking: "Ranking properties",
  generateResponse: "Generating scores & response",
};

interface AiRouteDeps {
  rankingGraph: CompiledStateGraph<RankingState, Partial<RankingState>, string>;
  similarityGraph: CompiledStateGraph<SimilarityState, Partial<SimilarityState>, string>;
}

export async function aiRoutes(app: FastifyInstance, deps: AiRouteDeps) {
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

  // POST /api/ai/score — invokes ranking graph directly (no more HTTP proxy)
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

  // POST /api/ai/score/stream — SSE streaming via ranking graph
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

  // POST /api/ai/similar — invokes similarity graph directly
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
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/
git commit -m "feat: add Fastify API routes — properties, notes, ai (with LangGraph integration)"
```

---

## Task 5: Server Bootstrap + LangGraph Wiring

**Files:**
- Create: `src/server.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Create src/server.ts**

The unified server: registers all route plugins, serves the built Vue SPA in production.

```typescript
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
```

- [ ] **Step 2: Create src/index.ts**

```typescript
import "./envBootstrap.js";
import { startServer } from "./server.js";

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
git add src/server.ts src/index.ts
git commit -m "feat: add Fastify server bootstrap with LangGraph wiring and SPA serving"
```

---

## Task 6: Rewire Graph Nodes — Replace laravelClient with Drizzle

**Files:**
- Move + Modify: `ai-service/src/graph/` → `src/graph/`
- Delete reference: `laravelClient.ts` (already not copied in Task 3)

The graph nodes that call `laravelClient` need to import from Drizzle instead. Two files change: `executeRankingNode.ts` and `fetchPropertyNode.ts`. Also `generateExplanationNode.ts` calls `/properties/by-ids` via fetch.

- [ ] **Step 1: Copy all graph files into src/graph/**

```bash
cp -r ai-service/src/graph/* src/graph/
```

- [ ] **Step 2: Update src/graph/ranking/nodes/executeRankingNode.ts**

Replace the `laravelClient` import with a direct Drizzle query. The full updated file:

```typescript
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db, schema } from "../../../db/index.js";
import { PropertyDataSchema, type RankingState } from "../types.js";

const RETRIEVAL_LIMIT = 200;

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

      // Build conditions from filters
      const conditions = [];
      if (filters.recommended_use) {
        conditions.push(sql`LOWER(${schema.propertyFeatures.recommendedUse}) LIKE ${`%${String(filters.recommended_use).toLowerCase()}%`}`);
      }
      if (filters.min_capacity) {
        conditions.push(gte(schema.propertyFeatures.estimatedCapacityPeople, Number(filters.min_capacity)));
      }
      if (filters.max_capacity) {
        conditions.push(lte(schema.propertyFeatures.estimatedCapacityPeople, Number(filters.max_capacity)));
      }
      if (filters.min_condition) {
        conditions.push(gte(schema.propertyFeatures.conditionRating, Number(filters.min_condition)));
      }
      if (filters.needs_renovation != null) {
        conditions.push(eq(schema.propertyFeatures.needsRenovation, Boolean(filters.needs_renovation)));
      }
      if (filters.near_subway != null) {
        conditions.push(eq(schema.propertyFeatures.nearSubway, Boolean(filters.near_subway)));
      }
      if (filters.parking_required != null) {
        conditions.push(eq(schema.propertyFeatures.parkingAvailable, Boolean(filters.parking_required)));
      }

      let query = db
        .select()
        .from(schema.properties)
        .innerJoin(schema.propertyFeatures, eq(schema.properties.id, schema.propertyFeatures.propertyId))
        .orderBy(desc(schema.properties.createdAt))
        .limit(RETRIEVAL_LIMIT);

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const rows = await query;

      const raw = rows.map((r) => ({
        ...r.properties,
        property_feature: r.property_features,
      }));

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
        rankedCandidates: { candidates, total_checked: raw.length },
      };
    } catch (e) {
      return { error: `executeRanking: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
```

- [ ] **Step 3: Update src/graph/similarity/nodes/fetchPropertyNode.ts**

Replace the `fetch` call to Laravel with a direct Drizzle query:

```typescript
import { eq } from "drizzle-orm";
import { db, schema } from "../../../db/index.js";
import { runReadQuery } from "../../../services/neo4jService.js";
import { PropertyDataSchema, ConceptNodesSchema, type SimilarityState } from "../types.js";

export function createFetchPropertyNode() {
  return async (state: SimilarityState): Promise<Partial<SimilarityState>> => {
    try {
      // Direct DB query instead of HTTP call to Laravel
      const row = await db.query.properties.findFirst({
        where: eq(schema.properties.id, state.property_id),
        with: { propertyFeature: true },
      });
      if (!row) throw new Error(`Property ${state.property_id} not found`);

      const property = PropertyDataSchema.parse({
        id: row.id,
        name: row.name,
        address: row.address,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        property_feature: row.propertyFeature,
      });

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

      const neo4jRow = rows[0] ?? {};
      const concept_nodes = ConceptNodesSchema.parse({
        landmarks: neo4jRow["landmarks"] ?? [],
        neighborhoods: neo4jRow["neighborhoods"] ?? [],
        amenities: neo4jRow["amenities"] ?? [],
        use_types: neo4jRow["use_types"] ?? [],
      });

      return { sourceProperty: { property, concept_nodes } };
    } catch (e) {
      return { error: `fetchProperty: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
```

- [ ] **Step 4: Update src/graph/similarity/nodes/generateExplanationNode.ts**

Replace the `fetch` call to `/properties/by-ids` with a direct Drizzle query:

```typescript
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { db, schema } from "../../../db/index.js";
import { type SimilarProperty, type SimilarityState } from "../types.js";

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
      if (state.error) {
        return {
          similarProperties: [],
          summary: `Could not find similar properties: ${state.error}`,
        };
      }

      const scored = state.scoredSimilarity ?? [];
      const limit = state.limit ?? 10;
      const top = scored.slice(0, limit);

      if (top.length === 0) {
        return {
          similarProperties: [],
          summary: "No similar properties found in the knowledge graph. Run extract-entities to populate concept nodes.",
        };
      }

      // Direct DB query instead of HTTP to Laravel
      const ids = top.map((s) => s.property_id);
      const rows = await db.query.properties.findMany({
        where: inArray(schema.properties.id, ids),
      });
      const hydratedMap = new Map(rows.map((r) => [r.id, r]));

      // LLM call for explanations
      const sourceInfo = `${state.sourceProperty?.property.name ?? ""} at ${state.sourceProperty?.property.address ?? ""}`;
      const candidatesJson = JSON.stringify(
        top.map((s) => ({
          property_id: s.property_id,
          similarity_score: s.similarity_score,
          shared_concepts: s.shared_concepts,
        })),
        null, 2
      );

      const out = await structured.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(`Source property: ${sourceInfo}\n\nSimilar candidates:\n${candidatesJson}`),
      ]);

      const explanationMap = new Map(out.explanations.map((e) => [e.property_id, e.explanation]));

      const similarProperties: SimilarProperty[] = top.map((s) => {
        const hydrated = hydratedMap.get(s.property_id);
        return {
          property_id: s.property_id,
          property_name: hydrated?.name ?? `Property ${s.property_id}`,
          address: hydrated?.address ?? "",
          similarity_score: s.similarity_score,
          explanation: explanationMap.get(s.property_id) ?? "",
          shared_concepts: s.shared_concepts,
          latitude: hydrated ? Number(hydrated.latitude) : null,
          longitude: hydrated ? Number(hydrated.longitude) : null,
        };
      });

      return { similarProperties, summary: out.summary };
    } catch (e) {
      return { error: `generateExplanation: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}
```

- [ ] **Step 5: Update the factory.ts import path**

The `src/graph/factory.ts` file imports from `../envBootstrap.js` and `../services/llm.js` — these paths already match the new layout. No changes needed.

- [ ] **Step 6: Commit**

```bash
git add src/graph/
git commit -m "feat: migrate LangGraph nodes — replace laravelClient HTTP with direct Drizzle queries"
```

---

## Task 7: Vue SPA Migration

**Files:**
- Move: `resources/js/*` → `client/`
- Move: `resources/css/app.css` → `client/css/app.css`
- Create: `public/index.html`
- Create: `vite.config.ts` (replace existing)
- Modify: `client/api/index.js` (remove CSRF interceptor)
- Modify: `client/app.js` (update CSS import path)
- Modify: `client/css/app.css` (update @source paths)

- [ ] **Step 1: Move frontend files**

```bash
mv resources/js client
mv resources/css client/css
```

- [ ] **Step 2: Create public/index.html**

Replaces the Blade template `resources/views/spa.blade.php`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alvorada Property Research</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</head>
<body class="antialiased">
    <div id="app"></div>
    <script type="module" src="/client/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [
    vue({
      template: {
        transformAssetUrls: {
          base: null,
          includeAbsolute: false,
        },
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": "/client" },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "public/index.html",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

- [ ] **Step 4: Update client/api/index.js**

Remove the CSRF token interceptor (no more Laravel sessions):

```javascript
import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const message =
            error.response?.data?.message ||
            error.response?.statusText ||
            'An unexpected error occurred';

        const status = error.response?.status;

        if (status === 422) {
            return Promise.reject(error);
        }

        if (status === 404) {
            console.warn('[API] Resource not found:', error.config?.url);
        } else if (status === 500) {
            console.error('[API] Server error:', message);
        }

        return Promise.reject(error);
    },
);

export default api;
```

- [ ] **Step 5: Update client/app.js**

Change the CSS import path:

```javascript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './css/app.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
```

- [ ] **Step 6: Update client/css/app.css**

Update the `@source` directives to match the new paths:

```css
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

@source '../**/*.js';
@source '../**/*.vue';

@theme {
    --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
    --color-primary-50: #eff6ff;
    --color-primary-100: #dbeafe;
    --color-primary-200: #bfdbfe;
    --color-primary-300: #93c5fd;
    --color-primary-400: #60a5fa;
    --color-primary-500: #3b82f6;
    --color-primary-600: #2563eb;
    --color-primary-700: #1d4ed8;
    --color-primary-800: #1e40af;
    --color-primary-900: #1e3a8a;
    --color-accent-500: #8b5cf6;
    --color-accent-600: #7c3aed;
}
```

- [ ] **Step 7: Verify Vite dev build works**

```bash
npx vite build
```

Expected: builds to `dist/` without errors.

- [ ] **Step 8: Commit**

```bash
git add client/ public/index.html vite.config.ts
git commit -m "feat: migrate Vue SPA — standalone Vite build, remove Laravel dependencies"
```

---

## Task 8: Docker + Cleanup

**Files:**
- Rewrite: `Dockerfile`
- Rewrite: `docker-compose.yml`
- Delete: all PHP/Laravel files

- [ ] **Step 1: Create new Dockerfile**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY src/ ./src/
COPY drizzle/ ./drizzle/
EXPOSE 3000
CMD ["node", "--import", "tsx", "src/index.ts"]
```

- [ ] **Step 2: Create new docker-compose.yml**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://alvorada_user:alvorada_password@postgres:5432/alvorada_db
      - LLM_API_KEY=${LLM_API_KEY:-}
      - LLM_MODEL=${LLM_MODEL:-google/gemini-2.0-flash-001}
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD:-neo4j-secret}
      - LANGSMITH_API_KEY=${LANGSMITH_API_KEY:-}
      - LANGCHAIN_TRACING_V2=${LANGCHAIN_TRACING_V2:-false}
      - LANGCHAIN_PROJECT=${LANGCHAIN_PROJECT:-alvorada-property-research}
      - PORT=3000
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy

  neo4j:
    image: neo4j:5-community
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD:-neo4j-secret}
    volumes:
      - neo4jdata:/data

  postgres:
    image: postgis/postgis:16-3.4
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: alvorada_db
      POSTGRES_USER: alvorada_user
      POSTGRES_PASSWORD: alvorada_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U alvorada_user -d alvorada_db"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  neo4jdata:
```

- [ ] **Step 3: Delete all PHP/Laravel files**

```bash
rm -rf app/ bootstrap/ config/ database/ resources/ routes/ storage/ tests/ vendor/
rm -f artisan composer.json composer.lock phpunit.xml .env.docker
rm -rf ai-service/
```

- [ ] **Step 4: Delete the old vite.config.js** (replaced by vite.config.ts)

```bash
rm -f vite.config.js
```

- [ ] **Step 5: Update .gitignore**

Replace Laravel .gitignore with Node.js one. Key entries:

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 6: Verify full build works**

```bash
npm run build
npm run typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: complete Node.js rebuild — remove all PHP/Laravel, new Docker setup"
```

---

## Task 9: Database Seed Script

**Files:**
- Create: `src/db/seed.ts`

Port the PropertySeeder (275 US properties). The seed data is large — read the property array from the original PHP file and convert to TypeScript.

- [ ] **Step 1: Create src/db/seed.ts**

This file should contain the same 275 properties from the PHP seeder. Use the same structure:

```typescript
import "../envBootstrap.js";
import { db, schema } from "./index.js";

// Property data — same 275 entries as the original Laravel seeder
const PROPERTIES: { name: string; address: string; lat: string; lon: string; city: string; state: string }[] = [
  // ... (copy from PHP seeder, convert to TS array)
];

async function main() {
  console.log(`Seeding ${PROPERTIES.length} properties...`);

  for (const entry of PROPERTIES) {
    await db.insert(schema.properties).values({
      name: entry.name,
      address: entry.address,
      latitude: entry.lat,
      longitude: entry.lon,
      extraField: {
        display_name: entry.address,
        city: entry.city,
        state: entry.state,
      },
    }).onConflictDoNothing();
  }

  console.log("Seeding complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Note: The actual property data array should be extracted from `database/seeders/PropertySeeder.php` and converted. It's ~275 entries.

- [ ] **Step 2: Commit**

```bash
git add src/db/seed.ts
git commit -m "feat: add property seeder script (275 US properties)"
```

---

## Task 10: Update CLAUDE.md + README

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Rewrite CLAUDE.md**

Update to reflect the new Node.js architecture: commands, structure, services. Remove all PHP/Laravel references.

- [ ] **Step 2: Update README.md**

Update setup instructions, tech stack, architecture diagram.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLAUDE.md and README for Node.js rebuild"
```
