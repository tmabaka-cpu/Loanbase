import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

export type MigrationResult = { applied: string[]; skipped: string[] };

/**
 * Apply every .sql file in the migrations directory that has not been applied yet,
 * in file-name order. Each file runs in its own transaction and is recorded in
 * `schema_migrations`, so running this twice changes nothing the second time.
 *
 * Connect as the owner role. The application role cannot change the schema.
 */
export async function runMigrations(ownerUrl: string, directory: string): Promise<MigrationResult> {
  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  const result: MigrationResult = { applied: [], skipped: [] };
  try {
    // One migration run at a time, even if two deployments start together.
    await sql`select pg_advisory_lock(727001)`;
    await sql`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )`;

    const files = (await readdir(directory)).filter((f) => f.endsWith(".sql")).sort();
    const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));

    for (const file of files) {
      if (done.has(file)) {
        result.skipped.push(file);
        continue;
      }
      const body = await readFile(path.join(directory, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into schema_migrations (name) values (${file})`;
      });
      result.applied.push(file);
    }
  } finally {
    await sql`select pg_advisory_unlock(727001)`.catch(() => {});
    await sql.end({ timeout: 5 });
  }
  return result;
}
