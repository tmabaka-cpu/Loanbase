import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HEARTBEAT_QUEUE, type HeartbeatData, registerJobs } from "../src/worker/jobs";
import { createQueue } from "../src/worker/queue";
import { appUrl } from "./helpers";

let boss: PgBoss;
const received: HeartbeatData[] = [];

beforeAll(async () => {
  boss = createQueue(appUrl);
  boss.on("error", () => {});
  await boss.start();
  await registerJobs(boss, (data) => received.push(data));
});

afterAll(async () => {
  await boss.stop({ graceful: false });
});

describe("background worker", () => {
  it("runs a queued job, connected as the application role", async () => {
    const sentAt = new Date().toISOString();
    await boss.send(HEARTBEAT_QUEUE, { sentAt });

    const deadline = Date.now() + 15_000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(received).toEqual([{ sentAt }]);
  });
});
