/**
 * lib/ingest/controlled-substances.ts
 *
 * Curated DEA controlled-substance schedule crosswalk, keyed on a drug's
 * active ingredients (and name/synonyms as a fallback).
 *
 * DEA schedules I–V are public, structured regulatory facts (21 CFR
 * §1308), so — like the public-domain ICD-10 crosswalk — they can ship
 * without licensing. The table is deliberately conservative: a curated
 * list of unambiguous ingredient names mapped to their federal schedule.
 * Precision beats recall — a missing schedule is fine, a wrong one is
 * not, and combination products can shift an ingredient's schedule, so
 * matches stay at the single-ingredient identity level.
 *
 * These are reference regulatory facts — never prescribing, dispensing,
 * or diversion-control guidance (see AGENTS.md).
 *
 * Shared by every pipeline that builds or loads drug records, exactly
 * like `lib/ingest/icd10.ts`:
 *   - scripts/db/seed.ts        (enriches records at load time)
 *   - lib/data/repository.ts    (static fallback, one-time at construction)
 *   - lib/data/prisma-repository (fill at read so both backends agree)
 *
 * Enrichment only ever fills an *empty* `controlledSubstance` — a value
 * already present (e.g. from a future authoritative source) is never
 * overwritten.
 */

import type { ControlledSubstance, DeaSchedule, Drug } from "@/lib/schemas";

interface ControlledSubstanceEntry {
  /** Ingredient names (lowercase) that carry this schedule. */
  names: string[];
  schedule: DeaSchedule;
  narcotic?: boolean;
}

/**
 * Curated table. Names are matched against the drug's ingredient names
 * (and, as a fallback, its own name/synonyms) on a word-boundary basis.
 * When a drug matches several entries, the most restrictive schedule
 * wins (II beats IV).
 */
export const CONTROLLED_SUBSTANCES: readonly ControlledSubstanceEntry[] = [
  // ── Schedule II ───────────────────────────────────────────────────
  {
    schedule: "II",
    narcotic: true,
    names: [
      "oxycodone",
      "hydrocodone",
      "morphine",
      "fentanyl",
      "hydromorphone",
      "oxymorphone",
      "methadone",
      "meperidine",
      "tapentadol",
      "codeine", // single-entity codeine is CII; combinations drop lower
      "sufentanil",
      "remifentanil",
    ],
  },
  {
    schedule: "II",
    names: [
      "amphetamine",
      "dextroamphetamine",
      "lisdexamfetamine",
      "methamphetamine",
      "methylphenidate",
      "dexmethylphenidate",
      "cocaine",
      "secobarbital",
      "pentobarbital",
      "phencyclidine",
      "nabilone",
    ],
  },
  // ── Schedule III ──────────────────────────────────────────────────
  {
    schedule: "III",
    narcotic: true,
    names: ["buprenorphine"],
  },
  {
    schedule: "III",
    names: [
      "ketamine",
      "testosterone",
      "nandrolone",
      "oxandrolone",
      "oxymetholone",
      "methyltestosterone",
      "stanozolol",
      "benzphetamine",
      "dronabinol",
    ],
  },
  // ── Schedule IV ───────────────────────────────────────────────────
  {
    schedule: "IV",
    narcotic: true,
    names: ["tramadol", "butorphanol", "pentazocine"],
  },
  {
    schedule: "IV",
    names: [
      "alprazolam",
      "diazepam",
      "lorazepam",
      "clonazepam",
      "temazepam",
      "oxazepam",
      "triazolam",
      "midazolam",
      "chlordiazepoxide",
      "clorazepate",
      "flurazepam",
      "estazolam",
      "zolpidem",
      "zaleplon",
      "eszopiclone",
      "phenobarbital",
      "carisoprodol",
      "modafinil",
      "armodafinil",
      "diethylpropion",
      "phentermine",
      "lorcaserin",
      "tramadol",
    ],
  },
  // ── Schedule V ────────────────────────────────────────────────────
  {
    schedule: "V",
    names: ["pregabalin", "lacosamide", "brivaracetam", "cenobamate"],
  },
  {
    schedule: "V",
    narcotic: true,
    names: ["diphenoxylate"],
  },
];

/** One-line reference note per schedule. */
export const SCHEDULE_DESCRIPTIONS: Record<DeaSchedule, string> = {
  I: "Schedule I — no currently accepted medical use and a high potential for abuse.",
  II: "Schedule II — high potential for abuse, with severe psychological or physical dependence risk.",
  III: "Schedule III — moderate-to-low potential for physical and psychological dependence.",
  IV: "Schedule IV — low potential for abuse and low risk of dependence.",
  V: "Schedule V — lowest potential for abuse, typically preparations with limited quantities of certain narcotics.",
};

/** I is most restrictive (rank 0) → V least. */
const SCHEDULE_RANK: Record<DeaSchedule, number> = {
  I: 0,
  II: 1,
  III: 2,
  IV: 3,
  V: 4,
};

/** Precompiled word-boundary matchers, built once. */
const MATCHERS: { re: RegExp; schedule: DeaSchedule; narcotic?: boolean }[] =
  CONTROLLED_SUBSTANCES.flatMap((entry) =>
    entry.names.map((name) => ({
      re: new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      schedule: entry.schedule,
      narcotic: entry.narcotic,
    })),
  );

/**
 * Resolve a controlled-substance classification from a set of candidate
 * names (ingredient names first, then drug name/synonyms). Returns the
 * most restrictive matching schedule, or `null` when nothing matches.
 */
export function controlledSubstanceForNames(
  names: string[],
): ControlledSubstance | null {
  const haystack = names.join(" \u0001 ").toLowerCase();
  let best: { schedule: DeaSchedule; narcotic?: boolean } | null = null;
  for (const m of MATCHERS) {
    if (!m.re.test(haystack)) continue;
    if (!best || SCHEDULE_RANK[m.schedule] < SCHEDULE_RANK[best.schedule]) {
      best = { schedule: m.schedule, narcotic: m.narcotic };
    }
  }
  if (!best) return null;
  return {
    schedule: best.schedule,
    ...(best.narcotic ? { narcotic: true } : {}),
    description: SCHEDULE_DESCRIPTIONS[best.schedule],
  };
}

/**
 * Fill an empty `controlledSubstance` on a drug. Returns the same object
 * when nothing changed so callers can cheaply detect no-ops. A value
 * already present is never overwritten.
 */
export function applyControlledSubstanceCrosswalk(drug: Drug): Drug {
  if (drug.controlledSubstance) return drug;
  const cs = controlledSubstanceForNames([
    ...drug.ingredients.map((i) => i.name),
    drug.name,
    ...drug.synonyms,
  ]);
  if (!cs) return drug;
  return { ...drug, controlledSubstance: cs };
}
