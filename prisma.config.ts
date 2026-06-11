import "dotenv/config";
import { defineConfig } from "prisma/config";

// Only the Prisma CLI reads this file (the runtime client gets its URL
// from lib/db/client.ts), so prefer the session pooler: schema-engine
// commands (db push, migrate) hang on Supabase's transaction pooler.
// The placeholder keeps `prisma generate` (and therefore `npm install` /
// `npm run build`) working on seed-only checkouts with no database
// configured. Commands that actually touch a database still require the
// real env vars.
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/pharmacopeia";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx scripts/db/seed.ts",
  },
  datasource: { url },
});
