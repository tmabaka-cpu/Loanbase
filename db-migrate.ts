import path from "node:path";
import { requireEnv } from "../src/db/env";
import { runMigrations } from "../src/db/migrate";
import { installQueueSchema } from "../src/worker/queue";

async function main() {
  const ownerUrl = requireEnv("DATABASE_OWNER_URL");
  const result = await runMigrations(ownerUrl, path.resolve("migrations"));
  for (const name of result.applied) console.log(`applied  ${name}`);
  for (const name of result.skipped) console.log(`skipped  ${name} (already applied)`);

  await installQueueSchema(ownerUrl);
  console.log("job queue schema is up to date");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
