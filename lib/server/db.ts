import { Pool } from "pg";
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required. Configure .env.local before starting AGI One.",
  );
const globalDb = globalThis as unknown as { agiPool?: Pool };
export const pool =
  globalDb.agiPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  });
if (process.env.NODE_ENV !== "production") globalDb.agiPool = pool;
