import { PgBoss } from "pg-boss";
import postgres from "postgres";
import { APP_ROLE } from "../db/bootstrap";

export const QUEUE_SCHEMA = "pgboss";

/**
 * Install or upgrade the job queue's own tables. Runs as the owner role during
 * `pnpm db:migrate`, then lets the application role use the queue.
 */
export async function installQueueSchema(ownerUrl: string): Promise<void> {
  const boss = new PgBoss({ connectionString: ownerUrl, schema: QUEUE_SCHEMA, supervise: false, schedule: false });
  boss.on("error", () => {});
  await boss.start();
  await boss.stop({ graceful: false });

  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`grant usage on schema ${QUEUE_SCHEMA} to ${APP_ROLE}`);
    await sql.unsafe(`grant select, insert, update, delete on all tables in schema ${QUEUE_SCHEMA} to ${APP_ROLE}`);
    await sql.unsafe(`grant usage, select on all sequences in schema ${QUEUE_SCHEMA} to ${APP_ROLE}`);
    await sql.unsafe(`grant execute on all functions in schema ${QUEUE_SCHEMA} to ${APP_ROLE}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * A queue client for the application or the worker, connected as the
 * application role. It never changes the queue's schema.
 */
export function createQueue(appUrl: string): PgBoss {
  return new PgBoss({ connectionString: appUrl, schema: QUEUE_SCHEMA, migrate: false, createSchema: false });
}
