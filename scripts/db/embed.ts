/**
 * Embed retrieval passages into pgvector.
 *
 * Delta-based: only passages whose `embedding` is NULL are embedded —
 * `scripts/db/seed.ts` nulls the vector whenever a passage's text_hash
 * changes, so a normal run after re-seeding embeds exactly what moved.
 * Pass `--all` to re-embed everything (required after changing
 * EMBEDDING_MODEL or EMBEDDING_DIMENSIONS in lib/ai/embeddings.ts).
 *
 *   npm run db:embed
 *   npm run db:embed -- --all
 *
 * Needs DIRECT_URL (or DATABASE_URL) plus an embeddings provider key
 * (AI_GATEWAY_API_KEY or OPENAI_API_KEY).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  embedTexts,
  embeddingsConfigured,
  toVectorLiteral,
} from "../../lib/ai/embeddings";

const BATCH_SIZE = 64;

async function main() {
  const all = process.argv.includes("--all");

  if (!embeddingsConfigured()) {
    throw new Error(
      "No embeddings provider configured; set AI_GATEWAY_API_KEY or OPENAI_API_KEY",
    );
  }
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DIRECT_URL or DATABASE_URL before embedding");
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const pending = all
      ? await prisma.passage.findMany({
          select: { id: true, text: true },
          orderBy: { id: "asc" },
        })
      : await prisma.$queryRaw<Array<{ id: string; text: string }>>`
          SELECT id, text FROM passages WHERE embedding IS NULL ORDER BY id
        `;

    if (pending.length === 0) {
      console.log("Nothing to embed — every passage already has a vector.");
      return;
    }
    console.log(
      `Embedding ${pending.length} passage(s) with ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dims)...`,
    );

    let done = 0;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const vectors = await embedTexts(batch.map((p) => p.text));
      // One UPDATE per row, inside a transaction per batch: passage ids
      // are primary keys, so this stays fast at this dataset size and a
      // mid-batch crash never leaves a torn vector.
      await prisma.$transaction(
        batch.map((p, j) =>
          prisma.$executeRaw`
            UPDATE passages
            SET embedding = ${toVectorLiteral(vectors[j])}::vector
            WHERE id = ${p.id}
          `,
        ),
      );
      done += batch.length;
      console.log(`  ${done}/${pending.length}`);
    }
    console.log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
