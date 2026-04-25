import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { config } from "../config.js";

const connectionString = config.db.url;

// For migrations and long-running queries
export const migrationClient = postgres(connectionString, { max: 1 });

// For the application logic
const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
