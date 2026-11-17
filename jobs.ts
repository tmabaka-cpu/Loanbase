import type { PgBoss } from "pg-boss";

/**
 * Background jobs. Each later phase registers its jobs here: emails, report
 * generation, integrity checks and billing sync.
 */

export const HEARTBEAT_QUEUE = "system.heartbeat";

export type HeartbeatData = { sentAt: string };

export async function registerJobs(boss: PgBoss, onHeartbeat?: (data: HeartbeatData) => void): Promise<void> {
  await boss.createQueue(HEARTBEAT_QUEUE);
  await boss.work<HeartbeatData>(HEARTBEAT_QUEUE, async (jobs) => {
    for (const job of jobs) {
      onHeartbeat?.(job.data);
    }
  });
}
