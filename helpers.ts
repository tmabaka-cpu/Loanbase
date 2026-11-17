import { APP_ROLE, connectionUrl, OWNER_ROLE } from "../src/db/bootstrap";

/**
 * Tests run against a real PostgreSQL database named fxchange_test, which is
 * dropped and rebuilt from the migrations at the start of every test run.
 */
export const TEST_DATABASE = "fxchange_test";
export const TEST_OWNER_PASSWORD = "owner_test_password";
export const TEST_APP_PASSWORD = "app_test_password";

export const adminUrl = process.env.DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
export const ownerUrl = connectionUrl(adminUrl, OWNER_ROLE, TEST_OWNER_PASSWORD, TEST_DATABASE);
export const appUrl = connectionUrl(adminUrl, APP_ROLE, TEST_APP_PASSWORD, TEST_DATABASE);

export const TENANT_A = "11111111-1111-4111-8111-111111111111";
export const TENANT_B = "22222222-2222-4222-8222-222222222222";

/** The message of an error together with the messages of everything that caused it. */
export function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(" | ");
}
