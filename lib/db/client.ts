import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Process-wide Prisma client singleton.
 *
 * Driver-adapter setup (Prisma 7): the runtime connects through
 * node-postgres using `DATABASE_URL` — on Supabase that should be the
 * transaction pooler (port 6543, `?pgbouncer=true&connection_limit=1`)
 * so serverless instances don't exhaust Postgres connections. The
 * global stash survives Next.js dev-server hot reloads, which would
 * otherwise leak a pool per reload.
 */
const globalForPrisma = globalThis as unknown as {
  __pharmacopeiaPrisma?: PrismaClient;
};

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.__pharmacopeiaPrisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "getPrismaClient() requires DATABASE_URL; the static seed repository should be used instead when it is unset",
      );
    }
    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.__pharmacopeiaPrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.__pharmacopeiaPrisma;
}
