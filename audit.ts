import type { Tx } from "./context";
import { auditLog } from "./schema";

export type AuditEntry = {
  /** The tenant the action belongs to. Null only for platform-level operator actions. */
  tenantId: string | null;
  /** Staff or operator id. Null for system jobs. */
  actorId: string | null;
  /** Name or email of the actor as it was at the time. */
  actorLabel: string;
  /** What happened: create, update, approve, reject, void, sign_in, and so on. */
  action: string;
  /** The kind of record: transaction, customer, tenant, and so on. */
  entity: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  reason?: string | null;
  requestId?: string | null;
};

/**
 * Write one audit row inside the caller's transaction, so the audit row and the
 * change it describes commit or roll back together (CLAUDE.md rule 12).
 */
export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  if (!entry.actorLabel.trim()) throw new Error("Audit entry needs an actor label");
  if (!entry.action.trim()) throw new Error("Audit entry needs an action");
  if (!entry.entity.trim()) throw new Error("Audit entry needs an entity");

  await tx.insert(auditLog).values({
    tenantId: entry.tenantId,
    actorId: entry.actorId,
    actorLabel: entry.actorLabel,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    oldValues: entry.oldValues ?? null,
    newValues: entry.newValues ?? null,
    reason: entry.reason ?? null,
    requestId: entry.requestId ?? null,
  });
}
