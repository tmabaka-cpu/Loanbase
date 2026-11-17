import { requireEnv } from "../db/env";
import { registerJobs } from "./jobs";
import { createQueue } from "./queue";

/** The background worker process. Start with `pnpm worker`. */
async function main() {
  const boss = createQueue(requireEnv("DATABASE_URL"));
  boss.on("error", (error) => console.error("queue error", error));
  await boss.start();
  await registerJobs(boss, (data) => console.log("heartbeat", data.sentAt));
  console.log("worker started");

  const stop = async () => {
    console.log("worker stopping");
    await boss.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
