import { sql } from "drizzle-orm";
import type { Database } from "./client";

/**
 * Who a database transaction is running for.
 *
 * CLAUDE.md rule 1: tenant isolation is enforced by the database. Every request
 * runs inside `withContext`, which sets the tenant for that transaction only.
 * Row-level security policies then refuse any row of another tenant.
 */
export type RequestContext =
  | { kind: "tenant"; tenantId: string }
  | { kind: "operator" };

export type Tx = Parameters<Parameters<Database["db"]["transaction"]>[0]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withContext<T>(
  database: Database,
  context: RequestContext,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (context.kind === "tenant" && !UUID.test(context.tenantId)) {
    throw new Error("Tenant id is not a valid UUID");
  }
  const tenantId = context.kind === "tenant" ? context.tenantId : "";
  const isOperator = context.kind === "operator" ? "on" : "off";

  return database.db.transaction(async (tx) => {
    // The third argument `true` makes each setting local to this transaction,
    // so it can never leak to another request that reuses the connection.
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.is_operator', ${isOperator}, true)`);
    return work(tx);
  });
}
