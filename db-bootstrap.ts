import { bootstrapDatabase } from "../src/db/bootstrap";
import { requireEnv } from "../src/db/env";

/**
 * Create the database roles and the database from the URLs in the environment.
 * Run once per environment, before the first `pnpm db:migrate`.
 */
async function main() {
  const owner = new URL(requireEnv("DATABASE_OWNER_URL"));
  const app = new URL(requireEnv("DATABASE_URL"));
  const databaseName = owner.pathname.replace(/^\//, "");

  await bootstrapDatabase({
    adminUrl: requireEnv("DATABASE_ADMIN_URL"),
    databaseName,
    ownerPassword: decodeURIComponent(owner.password),
    appPassword: decodeURIComponent(app.password),
  });
  console.log(`Database "${databaseName}" and roles are ready.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
