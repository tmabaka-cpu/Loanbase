import { bigint, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Drizzle table definitions. These describe tables for type-safe queries only.
 * The tables themselves are created by the SQL files in /migrations, which are
 * the single source of truth for the schema.
 */

export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  tenantId: uuid("tenant_id"),
  actorId: uuid("actor_id"),
  actorLabel: text("actor_label").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  reason: text("reason"),
  requestId: text("request_id"),
});
