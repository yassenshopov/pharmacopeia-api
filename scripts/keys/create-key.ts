/**
 * Mint an API key for the grounded tier.
 *
 *   npm run keys:create -- --name "acme staging"
 *   npm run keys:create -- --name "acme prod" --tier grounded
 *
 * Prints the plaintext key (`pk_live_...`) exactly once — only its
 * sha256 is stored, so a lost key can only be revoked and re-minted.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { hashApiKey } from "../../lib/auth/api-keys";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = argValue("--name");
  if (!name) {
    throw new Error('Usage: npm run keys:create -- --name "<key name>" [--tier grounded]');
  }
  const tier = argValue("--tier") ?? "grounded";

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DIRECT_URL or DATABASE_URL before minting keys");
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const key = `pk_live_${randomBytes(24).toString("base64url")}`;
    const row = await prisma.apiKey.create({
      data: { keyHash: hashApiKey(key), name, tier },
    });
    console.log(`Created API key "${row.name}" (tier: ${row.tier}, id: ${row.id})`);
    console.log("");
    console.log(`  ${key}`);
    console.log("");
    console.log("Store it now — the plaintext is never shown again.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
