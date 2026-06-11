/**
 * Push the static seed dataset into Supabase Postgres.
 *
 * Idempotent snapshot load: every table is wiped and rewritten from the
 * validated seed files, so re-runs always converge on the same state.
 * Each record is parsed against its Zod schema before it is written —
 * the database can never hold a record the API schemas would reject.
 *
 * Uses DIRECT_URL (session pooler) when available because this is a
 * long-lived bulk-writing process; falls back to DATABASE_URL.
 *
 *   npx prisma db seed   (or: npm run db:seed)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../lib/generated/prisma/client";
import {
  AdverseEventStatsSchema,
  ChangelogEntrySchema,
  ChemicalStructureSchema,
  DrugClassSchema,
  DrugLiteratureSchema,
  DrugSchema,
  IngredientSchema,
  InteractionSchema,
  ShortageEntrySchema,
  type Drug,
} from "../../lib/schemas";
import { SEED_DRUGS } from "../../lib/data/seed/drugs";
import { SEED_CLASSES } from "../../lib/data/seed/classes";
import { SEED_INGREDIENTS } from "../../lib/data/seed/ingredients";
import { SEED_INTERACTIONS } from "../../lib/data/seed/interactions";
import { SEED_CHANGELOG } from "../../lib/data/seed/changelog";
import { SEED_SHORTAGES } from "../../lib/data/seed/shortages";
import { SEED_ADVERSE_EVENTS } from "../../lib/data/seed/adverse-events";
import { SEED_LITERATURE } from "../../lib/data/seed/literature";
import { SEED_STRUCTURES } from "../../lib/data/seed/structures";
import { SEED_SIMILARITY } from "../../lib/data/seed/similarity";
import { SEED_REACTION_META } from "../../lib/data/seed/reaction-meta";
import { SEED_DRUG_INTERACTIONS_NARRATIVES } from "../../lib/data/seed/drug-interactions-narratives";
import { buildPassages } from "../../lib/data/passages";
import { dispatchWebhookEvent, newEventId } from "../../lib/webhooks/dispatch";
import type { WebhookDrugChange, WebhookEventPayload } from "../../lib/schemas";

const DATASET_VERSION = "v0.1.0-db";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Mirror of StaticRepository.search()'s haystack for a drug. */
function drugSearchText(d: Drug): string {
  return [d.name, d.slug, ...d.synonyms, ...d.brands, ...d.ingredients.map((i) => i.name)]
    .join(" ")
    .toLowerCase();
}

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DIRECT_URL or DATABASE_URL before seeding");
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // Pre-write snapshot of (slug, sourceHash) so we can diff after the
    // load and fire drug.created / drug.updated / drug.deleted webhooks.
    const priorDrugs = await prisma.drug.findMany({
      select: { slug: true, sourceHash: true },
    });
    const priorHashBySlug = new Map(
      priorDrugs.map((d) => [d.slug, d.sourceHash]),
    );

    // ── Drugs ─────────────────────────────────────────────────────────
    // The one-sided openFDA interactions narrative lives in a separate
    // seed file (size); in the database it is folded into the payload so
    // a drug row is the complete record.
    const drugs = SEED_DRUGS.map((raw) => {
      const narrative =
        raw.interactionsNarrative ??
        SEED_DRUG_INTERACTIONS_NARRATIVES[raw.slug]?.text;
      const drug = DrugSchema.parse(
        narrative ? { ...raw, interactionsNarrative: narrative } : raw,
      );
      return {
        slug: drug.slug,
        name: drug.name,
        classSlugs: [...new Set(drug.classes.map((c) => c.slug))],
        ingredientSlugs: [...new Set(drug.ingredients.map((i) => i.slug))],
        searchText: drugSearchText(drug),
        indicationCount: drug.indications.length,
        hasInteractionsNarrative: Boolean(drug.interactionsNarrative),
        sourceHash: drug.provenance.sourceHash,
        payload: json(drug),
      };
    });
    await prisma.drug.deleteMany();
    for (const batch of chunk(drugs, 25)) {
      await prisma.drug.createMany({ data: batch });
    }
    console.log(`drugs: ${drugs.length}`);

    // ── Classes ───────────────────────────────────────────────────────
    const classes = SEED_CLASSES.map((raw) => {
      const cls = DrugClassSchema.parse(raw);
      return {
        slug: cls.slug,
        name: cls.name,
        kind: cls.kind,
        code: cls.code ?? null,
        searchText: `${cls.name} ${cls.slug}`.toLowerCase(),
        sourceHash: cls.provenance.sourceHash,
        payload: json(cls),
      };
    });
    await prisma.drugClass.deleteMany();
    for (const batch of chunk(classes, 100)) {
      await prisma.drugClass.createMany({ data: batch });
    }
    console.log(`classes: ${classes.length}`);

    // ── Ingredients ───────────────────────────────────────────────────
    const ingredients = SEED_INGREDIENTS.map((raw) => {
      const ing = IngredientSchema.parse(raw);
      return {
        slug: ing.slug,
        name: ing.name,
        searchText: `${ing.name} ${ing.slug}`.toLowerCase(),
        sourceHash: ing.provenance.sourceHash,
        payload: json(ing),
      };
    });
    await prisma.ingredient.deleteMany();
    for (const batch of chunk(ingredients, 100)) {
      await prisma.ingredient.createMany({ data: batch });
    }
    console.log(`ingredients: ${ingredients.length}`);

    // ── Interaction pairs (canonicalised drugA < drugB) ───────────────
    const interactions = SEED_INTERACTIONS.map((raw) => {
      const x = InteractionSchema.parse(raw);
      return {
        id: `${x.drugA}|${x.drugB}`,
        drugA: x.drugA,
        drugB: x.drugB,
        payload: json(x),
      };
    });
    await prisma.interaction.deleteMany();
    for (const batch of chunk(interactions, 200)) {
      await prisma.interaction.createMany({ data: batch });
    }
    console.log(`interactions: ${interactions.length}`);

    // ── Changelog ─────────────────────────────────────────────────────
    const changelog = SEED_CHANGELOG.map((raw) => {
      const entry = ChangelogEntrySchema.parse(raw);
      return {
        id: entry.id,
        timestamp: new Date(entry.timestamp),
        payload: json(entry),
      };
    });
    await prisma.changelogEntry.deleteMany();
    await prisma.changelogEntry.createMany({ data: changelog });
    console.log(`changelog entries: ${changelog.length}`);

    // ── Shortages ─────────────────────────────────────────────────────
    const shortages = Object.values(SEED_SHORTAGES)
      .flat()
      .map((raw) => {
        const entry = ShortageEntrySchema.parse(raw);
        return { drugSlug: entry.drug, payload: json(entry) };
      });
    await prisma.shortage.deleteMany();
    for (const batch of chunk(shortages, 200)) {
      await prisma.shortage.createMany({ data: batch });
    }
    console.log(`shortage entries: ${shortages.length}`);

    // ── FAERS adverse-event aggregates ────────────────────────────────
    const adverse = Object.values(SEED_ADVERSE_EVENTS).map((raw) => {
      const stats = AdverseEventStatsSchema.parse(raw);
      return { drugSlug: stats.drug, payload: json(stats) };
    });
    await prisma.adverseEvents.deleteMany();
    for (const batch of chunk(adverse, 100)) {
      await prisma.adverseEvents.createMany({ data: batch });
    }
    console.log(`adverse-event snapshots: ${adverse.length}`);

    // ── PubMed literature ─────────────────────────────────────────────
    const literature = Object.values(SEED_LITERATURE).map((raw) => {
      const lit = DrugLiteratureSchema.parse(raw);
      return { drugSlug: lit.drug, payload: json(lit) };
    });
    await prisma.literature.deleteMany();
    for (const batch of chunk(literature, 100)) {
      await prisma.literature.createMany({ data: batch });
    }
    console.log(`literature lists: ${literature.length}`);

    // ── 2D structures ─────────────────────────────────────────────────
    const structures = Object.entries(SEED_STRUCTURES).map(([slug, raw]) => {
      const struct = ChemicalStructureSchema.parse(raw);
      return { drugSlug: slug, smiles: struct.smiles, payload: json(struct) };
    });
    await prisma.structure.deleteMany();
    for (const batch of chunk(structures, 100)) {
      await prisma.structure.createMany({ data: batch });
    }
    console.log(`structures: ${structures.length}`);

    // ── Precomputed structural analogs ────────────────────────────────
    const similarity = Object.entries(SEED_SIMILARITY).map(
      ([slug, neighbors]) => ({ drugSlug: slug, neighbors: json(neighbors) }),
    );
    await prisma.similarity.deleteMany();
    for (const batch of chunk(similarity, 200)) {
      await prisma.similarity.createMany({ data: batch });
    }
    console.log(`similarity lists: ${similarity.length}`);

    // ── Reaction reference metadata (MeSH / PubMed) ───────────────────
    const reactionMeta = Object.entries(SEED_REACTION_META).map(
      ([slug, meta]) => ({ slug, payload: json(meta) }),
    );
    await prisma.reactionMeta.deleteMany();
    for (const batch of chunk(reactionMeta, 100)) {
      await prisma.reactionMeta.createMany({ data: batch });
    }
    console.log(`reaction meta records: ${reactionMeta.length}`);

    // ── Retrieval passages ────────────────────────────────────────────
    // Unlike the snapshot tables above, passages are upserted instead of
    // wiped: embeddings are expensive, so an unchanged passage (same
    // text_hash) keeps its vector across re-seeds. Changed text nulls the
    // vector, which is what `npm run db:embed` uses as its delta key.
    const drugRecords = drugs.map((d) => d.payload as unknown as Drug);
    const passages = buildPassages(drugRecords);
    const existingPassages = await prisma.passage.findMany({
      select: { id: true, textHash: true },
    });
    const existingHashById = new Map(
      existingPassages.map((p) => [p.id, p.textHash]),
    );
    const liveIds = new Set(passages.map((p) => p.id));

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const p of passages) {
      const prior = existingHashById.get(p.id);
      if (prior === p.textHash) {
        unchanged++;
        continue;
      }
      const data = {
        drugSlug: p.drugSlug,
        drugName: p.drugName,
        section: p.section,
        chunk: p.chunk,
        text: p.text,
        textHash: p.textHash,
        provenance: json(p.provenance),
      };
      if (prior === undefined) {
        await prisma.passage.create({ data: { id: p.id, ...data } });
        created++;
      } else {
        // Text changed → stored vector no longer matches; reset it so the
        // embed pipeline picks this passage up again.
        await prisma.passage.update({ where: { id: p.id }, data });
        await prisma.$executeRaw`UPDATE passages SET embedding = NULL WHERE id = ${p.id}`;
        updated++;
      }
    }
    const staleIds = existingPassages
      .map((p) => p.id)
      .filter((id) => !liveIds.has(id));
    if (staleIds.length > 0) {
      await prisma.passage.deleteMany({ where: { id: { in: staleIds } } });
    }
    console.log(
      `passages: ${passages.length} (${created} created, ${updated} updated, ${unchanged} unchanged, ${staleIds.length} removed)`,
    );

    // ── Dataset snapshot marker ───────────────────────────────────────
    const updatedAt = new Date();
    await prisma.datasetMeta.upsert({
      where: { id: 1 },
      create: { id: 1, version: DATASET_VERSION, updatedAt },
      update: { version: DATASET_VERSION, updatedAt },
    });
    console.log(`dataset meta: ${DATASET_VERSION} @ ${updatedAt.toISOString()}`);

    // ── Webhooks ──────────────────────────────────────────────────────
    // Diff the pre-write snapshot against what was just loaded and fire
    // one batched event per change type, then a dataset.refreshed
    // roll-up. A first seed into an empty database is "everything
    // created" — skip the noise and only send the roll-up.
    const isFirstSeed = priorDrugs.length === 0;
    const createdDrugs: WebhookDrugChange[] = [];
    const updatedDrugs: WebhookDrugChange[] = [];
    for (const d of drugs) {
      const prior = priorHashBySlug.get(d.slug);
      if (prior === undefined) {
        createdDrugs.push({ slug: d.slug, name: d.name, sourceHash: d.sourceHash });
      } else if (prior !== d.sourceHash) {
        updatedDrugs.push({ slug: d.slug, name: d.name, sourceHash: d.sourceHash });
      }
    }
    const liveSlugs = new Set(drugs.map((d) => d.slug));
    const deletedDrugs: WebhookDrugChange[] = priorDrugs
      .filter((d) => !liveSlugs.has(d.slug))
      .map((d) => ({ slug: d.slug }));

    const timestamp = updatedAt.toISOString();
    const events: WebhookEventPayload[] = [];
    if (!isFirstSeed) {
      if (createdDrugs.length > 0) {
        events.push({
          id: newEventId(),
          event: "drug.created",
          timestamp,
          datasetVersion: DATASET_VERSION,
          drugs: createdDrugs,
        });
      }
      if (updatedDrugs.length > 0) {
        events.push({
          id: newEventId(),
          event: "drug.updated",
          timestamp,
          datasetVersion: DATASET_VERSION,
          drugs: updatedDrugs,
        });
      }
      if (deletedDrugs.length > 0) {
        events.push({
          id: newEventId(),
          event: "drug.deleted",
          timestamp,
          datasetVersion: DATASET_VERSION,
          drugs: deletedDrugs,
        });
      }
    }
    events.push({
      id: newEventId(),
      event: "dataset.refreshed",
      timestamp,
      datasetVersion: DATASET_VERSION,
      summary: {
        created: isFirstSeed ? drugs.length : createdDrugs.length,
        updated: updatedDrugs.length,
        deleted: deletedDrugs.length,
      },
    });
    for (const event of events) {
      const delivered = await dispatchWebhookEvent(prisma, event);
      console.log(
        `webhook ${event.event}: delivered to ${delivered} endpoint(s)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
