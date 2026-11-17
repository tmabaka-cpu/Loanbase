import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "./env";
import * as schema from "./schema";

export function createDatabase(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return {
    client,
    db,
    close: () => client.end({ timeout: 5 }),
  };
}

export type Database = ReturnType<typeof createDatabase>;

let shared: Database | undefined;

/** The application's shared connection pool, connected as the restricted application role. */
export function getDatabase(): Database {
  shared ??= createDatabase(requireEnv("DATABASE_URL"));
  return shared;
}
