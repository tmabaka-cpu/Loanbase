import postgres from "postgres";

export const OWNER_ROLE = "fxchange_owner";
export const APP_ROLE = "fxchange_app";

export type BootstrapOptions = {
  /** Superuser connection URL. */
  adminUrl: string;
  databaseName: string;
  ownerPassword: string;
  appPassword: string;
  /** Drop the database first. Only ever used for the test database. */
  recreate?: boolean;
};

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Invalid database identifier: ${value}`);
  return `"${value}"`;
}

/** Replace the user, password and database of a connection URL. */
export function connectionUrl(baseUrl: string, user: string, password: string, database: string): string {
  const url = new URL(baseUrl);
  url.username = user;
  url.password = password;
  url.pathname = `/${database}`;
  return url.toString();
}

/**
 * Create the two database roles and the database. Safe to run again.
 *
 *  - fxchange_owner owns the schema and runs migrations.
 *  - fxchange_app is what the application connects as. It is not a superuser,
 *    does not own the tables and cannot bypass row-level security.
 */
export async function bootstrapDatabase(options: BootstrapOptions): Promise<void> {
  const db = identifier(options.databaseName);
  const admin = postgres(options.adminUrl, { max: 1, onnotice: () => {} });
  try {
    for (const [role, password] of [
      [OWNER_ROLE, options.ownerPassword],
      [APP_ROLE, options.appPassword],
    ] as const) {
      const exists = await admin`select 1 from pg_roles where rolname = ${role}`;
      if (exists.length === 0) {
        await admin.unsafe(`create role ${identifier(role)} login nosuperuser nocreatedb nocreaterole nobypassrls password ${literal(password)}`);
      } else {
        await admin.unsafe(`alter role ${identifier(role)} login nosuperuser nobypassrls password ${literal(password)}`);
      }
    }

    if (options.recreate) {
      await admin.unsafe(`drop database if exists ${db} with (force)`);
    }
    const dbExists = await admin`select 1 from pg_database where datname = ${options.databaseName}`;
    if (dbExists.length === 0) {
      await admin.unsafe(`create database ${db} owner ${identifier(OWNER_ROLE)}`);
    }
    await admin.unsafe(`revoke all on database ${db} from public`);
    await admin.unsafe(`grant connect on database ${db} to ${identifier(APP_ROLE)}`);
  } finally {
    await admin.end({ timeout: 5 });
  }

  // Schema-level setup has to run inside the new database.
  const inDb = postgres(connectionUrl(options.adminUrl, new URL(options.adminUrl).username, decodeURIComponent(new URL(options.adminUrl).password), options.databaseName), { max: 1, onnotice: () => {} });
  try {
    await inDb.unsafe(`alter schema public owner to ${identifier(OWNER_ROLE)}`);
    await inDb.unsafe(`revoke all on schema public from public`);
    await inDb.unsafe(`grant usage on schema public to ${identifier(APP_ROLE)}`);
  } finally {
    await inDb.end({ timeout: 5 });
  }
}
