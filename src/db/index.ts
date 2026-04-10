import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const db = drizzle(pool, { schema });

export { schema };
