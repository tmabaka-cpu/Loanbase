import path from "node:path";
import { bootstrapDatabase } from "../src/db/bootstrap";
import { runMigrations } from "../src/db/migrate";
import { installQueueSchema } from "../src/worker/queue";
import { adminUrl, ownerUrl, TEST_APP_PASSWORD, TEST_DATABASE, TEST_OWNER_PASSWORD } from "./helpers";

export default async function setup() {
  await bootstrapDatabase({
    adminUrl,
    databaseName: TEST_DATABASE,
    ownerPassword: TEST_OWNER_PASSWORD,
    appPassword: TEST_APP_PASSWORD,
    recreate: true,
  });
  await runMigrations(ownerUrl, path.resolve("migrations"));
  await installQueueSchema(ownerUrl);
}
