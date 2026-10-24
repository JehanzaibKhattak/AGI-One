import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  if (
    !process.env.DATABASE_URL ||
    !process.env.BETTER_AUTH_SECRET ||
    !process.env.BETTER_AUTH_URL
  )
    throw new Error(
      "Set DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL in .env.local before migrating.",
    );
  const { auth } = await import("../lib/server/auth");
  const { pool } = await import("../lib/server/db");
  const { getMigrations } = await import("better-auth/db/migration");
  try {
    const migration = await getMigrations(auth.options);
    await migration.runMigrations();
    await pool.query(await readFile("lib/server/schema.sql", "utf8"));
    console.log("AGI One database migrations complete.");
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
