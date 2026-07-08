import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is missing in .env.local");
}

export const pool = new Pool({
  connectionString,
});

export async function query(text, params) {
  return pool.query(text, params);
}
