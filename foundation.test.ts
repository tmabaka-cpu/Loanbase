import path from "node:path";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeAudit } from "../src/db/audit";
import { createDatabase, type Database } from "../src/db/client";
import { withContext } from "../src/db/context";
import { runMigrations } from "../src/db/migrate";
import { auditLog } from "../src/db/schema";
import { adminUrl, appUrl, errorText, ownerUrl, TENANT_A, TENANT_B, TEST_DATABASE } from "./helpers";

let database: Database;

const entry = (tenantId: string | null, entityId: string) => ({
  tenantId,
  actorId: null,
  actorLabel: "Test Teller",
  action: "create",
  entity: "test_record",
  entityId,
  newValues: { amount: "1320.00" },
});

beforeAll(async () => {
  // One connection, so the tests also prove settings do not leak between transactions.
  database = createDatabase(appUrl, { max: 1 });
  await withContext(database, { kind: "tenant", tenantId: TENANT_A }, (tx) => writeAudit(tx, entry(TENANT_A, "a-1")));
  await withContext(database, { kind: "tenant", tenantId: TENANT_B }, (tx) => writeAudit(tx, entry(TENANT_B, "b-1")));
});

afterAll(async () => {
  await database.close();
});

describe("migrations", () => {
  it("apply nothing when run a second time", async () => {
    const result = await runMigrations(ownerUrl, path.resolve("migrations"));
    expect(result.applied).toEqual([]);
    expect(result.skipped).toContain("0001_foundation.sql");
  });
});

describe("application database role", () => {
  it("is not a superuser and cannot bypass row-level security", async () => {
    const rows = await database.client<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      select rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("cannot change the schema", async () => {
    await expect(database.client`create table sneaky (id int)`).rejects.toSatisfy((e) => /permission denied/.test(errorText(e)));
    await expect(database.client`drop table audit_log`).rejects.toSatisfy((e) => /must be owner/.test(errorText(e)));
  });
});

describe("tenant isolation (CLAUDE.md rule 1)", () => {
  it("a tenant sees only its own rows", async () => {
    const seenByA = await withContext(database, { kind: "tenant", tenantId: TENANT_A }, (tx) => tx.select().from(auditLog));
    expect(seenByA.length).toBeGreaterThan(0);
    expect(seenByA.every((row) => row.tenantId === TENANT_A)).toBe(true);

    const seenByB = await withContext(database, { kind: "tenant", tenantId: TENANT_B }, (tx) => tx.select().from(auditLog));
    expect(seenByB.length).toBeGreaterThan(0);
    expect(seenByB.every((row) => row.tenantId === TENANT_B)).toBe(true);
  });

  it("a connection with no tenant set sees nothing", async () => {
    const rows = await database.client`select * from audit_log`;
    expect(rows).toHaveLength(0);
  });

  it("the tenant setting does not leak into the next transaction on the same connection", async () => {
    await withContext(database, { kind: "tenant", tenantId: TENANT_A }, (tx) => tx.select().from(auditLog));
    const after = await database.client<{ tenant: string | null }[]>`select app.current_tenant_id()::text as tenant`;
    expect(after[0]?.tenant).toBeNull();
  });

  it("a tenant cannot write a row for another tenant", async () => {
    await expect(
      withContext(database, { kind: "tenant", tenantId: TENANT_A }, (tx) => writeAudit(tx, entry(TENANT_B, "forged"))),
    ).rejects.toSatisfy((e) => /row-level security/.test(errorText(e)));
  });

  it("a tenant cannot write a platform-level row", async () => {
    await expect(
      withContext(database, { kind: "tenant", tenantId: TENANT_A }, (tx) => writeAudit(tx, entry(null, "forged"))),
    ).rejects.toSatisfy((e) => /row-level security/.test(errorText(e)));
  });

  it("a connection with no tenant set cannot write", async () => {
    await expect(
      database.client`insert into audit_log (tenant_id, actor_label, action, entity) values (${TENANT_A}, 'x', 'create', 'x')`,
    ).rejects.toSatisfy((e) => /row-level security/.test(errorText(e)));
  });

  it("refuses a tenant id that is not a UUID", async () => {
    await expect(
      withContext(database, { kind: "tenant", tenantId: "1 or 1=1" }, async () => undefined),
    ).rejects.toSatisfy((e) => /valid UUID/.test(errorText(e)));
  });

  it("the operator sees every tenant and can write platform-level rows", async () => {
    await withContext(database, { kind: "operator" }, (tx) => writeAudit(tx, { ...entry(null, "platform-1"), actorLabel: "Operator" }));
    const rows = await withContext(database, { kind: "operator" }, (tx) => tx.select().from(auditLog));
    const tenants = new Set(rows.map((row) => row.tenantId));
    expect(tenants.has(TENANT_A)).toBe(true);
    expect(tenants.has(TENANT_B)).toBe(true);
    expect(tenants.has(null)).toBe(true);
  });
});

describe("audit log is append-only (CLAUDE.md rules 5 and 12)", () => {
  it("the application role has no permission to update or delete", async () => {
    await expect(
      withContext(database, { kind: "tenant", tenantId: TENANT_A }, (tx) => tx.execute(sql`update audit_log set action = 'tampered'`)),
    ).rejects.toSatisfy((e) => /permission denied/.test(errorText(e)));
    await expect(
      withContext(database, { kind: "tenant", tenantId: TENANT_A }, (tx) => tx.execute(sql`delete from audit_log`)),
    ).rejects.toSatisfy((e) => /permission denied/.test(errorText(e)));
  });

  it("the owner role cannot change or remove rows either", async () => {
    const owner = postgres(ownerUrl, { max: 1, onnotice: () => {} });
    try {
      await owner.begin(async (tx) => {
        await tx`select set_config('app.is_operator', 'on', true)`;
        // Row-level security gives the owner no update or delete policy, so no row is touched.
        expect((await tx`update audit_log set action = 'tampered'`).count).toBe(0);
        expect((await tx`delete from audit_log`).count).toBe(0);
        await expect(tx.savepoint((sp) => sp`truncate audit_log`)).rejects.toSatisfy((e) => /append-only/.test(errorText(e)));
      });
    } finally {
      await owner.end({ timeout: 5 });
    }
  });

  it("even a superuser, who bypasses row-level security, is refused by the append-only trigger", async () => {
    const url = new URL(adminUrl);
    url.pathname = `/${TEST_DATABASE}`;
    const superuser = postgres(url.toString(), { max: 1, onnotice: () => {} });
    try {
      await superuser.begin(async (tx) => {
        await expect(tx.savepoint((sp) => sp`update audit_log set action = 'tampered'`)).rejects.toSatisfy((e) => /append-only/.test(errorText(e)));
        await expect(tx.savepoint((sp) => sp`delete from audit_log`)).rejects.toSatisfy((e) => /append-only/.test(errorText(e)));
        await expect(tx.savepoint((sp) => sp`truncate audit_log`)).rejects.toSatisfy((e) => /append-only/.test(errorText(e)));
      });
    } finally {
      await superuser.end({ timeout: 5 });
    }
  });

  it("an audit row rolls back with the change it describes", async () => {
    await expect(
      withContext(database, { kind: "tenant", tenantId: TENANT_A }, async (tx) => {
        await writeAudit(tx, entry(TENANT_A, "rolled-back"));
        throw new Error("posting failed");
      }),
    ).rejects.toThrow("posting failed");

    const rows = await withContext(database, { kind: "tenant", tenantId: TENANT_A }, (tx) => tx.select().from(auditLog));
    expect(rows.some((row) => row.entityId === "rolled-back")).toBe(false);
  });

  it("refuses an audit entry with no actor, action or entity", async () => {
    await expect(
      withContext(database, { kind: "tenant", tenantId: TENANT_A }, (tx) => writeAudit(tx, { ...entry(TENANT_A, "x"), actorLabel: " " })),
    ).rejects.toSatisfy((e) => /actor label/.test(errorText(e)));
  });
});
