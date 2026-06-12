/**
 * lib/ingest/orange-book.ts
 *
 * Curated FDA Orange Book therapeutic-equivalence crosswalk, keyed on a
 * drug's active ingredients (and name/synonyms as a fallback).
 *
 * The Orange Book ("Approved Drug Products with Therapeutic Equivalence
 * Evaluations") is free, public-domain FDA data, so — like the ICD-10
 * and DEA crosswalks — it can ship without licensing. The table is
 * deliberately conservative: a curated list of unambiguous single-
 * ingredient products mapped to the therapeutic-equivalence code of
 * their predominant marketed form, whether a Reference Listed Drug
 * exists, and whether an AB-rated generic is available.
 *
 * Precision beats recall. A TE code is a per-product fact (a single
 * ingredient can ship in many products with different codes), so matches
 * stay at the single-ingredient identity level and describe the common
 * oral form. Per-product patent and exclusivity expiry dates move on
 * FDA-update timescales and are intentionally left to a future
 * authoritative ingest rather than hand-curated here.
 *
 * These are reference regulatory facts — never substitution,
 * prescribing, or formulary guidance (see AGENTS.md).
 *
 * Shared by every pipeline that builds or loads drug records, exactly
 * like `lib/ingest/controlled-substances.ts`:
 *   - scripts/db/seed.ts        (enriches records at load time)
 *   - lib/data/repository.ts    (static fallback, one-time at construction)
 *   - lib/data/prisma-repository (fill at read so both backends agree)
 *
 * Enrichment only ever fills an *empty* `orangeBook` — a value already
 * present (e.g. from a future authoritative source) is never overwritten.
 */

import type { Drug, OrangeBook } from "@/lib/schemas";

interface OrangeBookEntry {
  /** Ingredient names (lowercase) this entry describes. */
  names: string[];
  /** TE code of the predominant marketed product, if rated. */
  teCode?: string;
  /** Whether an FDA Reference Listed Drug exists (true for all here). */
  referenceListed?: boolean;
  /** Whether an AB-rated generic is marketed. */
  genericAvailable: boolean;
}

/**
 * Curated table of well-established single-ingredient products. Names
 * are matched against the drug's ingredient names (and, as a fallback,
 * its own name/synonyms) on a word-boundary basis. Kept conservative:
 * a missing entry is fine, a wrong TE rating is not.
 */
export const ORANGE_BOOK: readonly OrangeBookEntry[] = [
  // ── AB-rated, generics widely marketed ────────────────────────────
  { names: ["metformin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["atorvastatin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["simvastatin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["pravastatin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["rosuvastatin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["lisinopril"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["enalapril"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["ramipril"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["losartan"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["valsartan"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["amlodipine"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["metoprolol"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["atenolol"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["carvedilol"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["hydrochlorothiazide"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["furosemide"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["spironolactone"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["clopidogrel"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["warfarin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["omeprazole"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["pantoprazole"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["esomeprazole"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["sertraline"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["fluoxetine"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["escitalopram"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["citalopram"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["duloxetine"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["venlafaxine"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["gabapentin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["amoxicillin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["azithromycin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["ciprofloxacin"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["doxycycline"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["ibuprofen"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["naproxen"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["prednisone"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["montelukast"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["levothyroxine"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["tramadol"], teCode: "AB", referenceListed: true, genericAvailable: true },
  { names: ["albuterol", "salbutamol"], teCode: "AB", referenceListed: true, genericAvailable: true },
  // ── Brand-dominant: RLD exists, no AB-rated generic marketed ───────
  { names: ["apixaban"], referenceListed: true, genericAvailable: false },
  { names: ["rivaroxaban"], referenceListed: true, genericAvailable: false },
  { names: ["empagliflozin"], referenceListed: true, genericAvailable: false },
  { names: ["dapagliflozin"], referenceListed: true, genericAvailable: false },
  { names: ["semaglutide"], referenceListed: true, genericAvailable: false },
  { names: ["dulaglutide"], referenceListed: true, genericAvailable: false },
  { names: ["sitagliptin"], referenceListed: true, genericAvailable: false },
];

/** Map a TE code (or its absence) to a short reference note. */
export function describeTeCode(
  teCode: string | undefined,
  genericAvailable: boolean,
): string {
  if (teCode && teCode.startsWith("A")) {
    return `Orange Book code ${teCode} — FDA-rated therapeutically equivalent to the reference product${
      genericAvailable ? "; AB-rated generics are marketed." : "."
    }`;
  }
  if (teCode && teCode.startsWith("B")) {
    return `Orange Book code ${teCode} — NOT rated therapeutically equivalent (bioequivalence not demonstrated or data insufficient).`;
  }
  return genericAvailable
    ? "Listed in the FDA Orange Book; AB-rated generics are marketed."
    : "Listed in the FDA Orange Book; no AB-rated generic is currently marketed (brand-dominant).";
}

/** Precompiled word-boundary matchers, built once. */
const MATCHERS: { re: RegExp; entry: OrangeBookEntry }[] = ORANGE_BOOK.flatMap(
  (entry) =>
    entry.names.map((name) => ({
      re: new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      entry,
    })),
);

/**
 * Resolve an Orange Book summary from a set of candidate names
 * (ingredient names first, then drug name/synonyms). Returns the first
 * matching entry, or `null` when nothing matches.
 */
export function orangeBookForNames(names: string[]): OrangeBook | null {
  const haystack = names.join(" \u0001 ").toLowerCase();
  for (const m of MATCHERS) {
    if (!m.re.test(haystack)) continue;
    return {
      ...(m.entry.teCode ? { teCode: m.entry.teCode } : {}),
      ...(m.entry.referenceListed ? { referenceListed: true } : {}),
      genericAvailable: m.entry.genericAvailable,
      description: describeTeCode(m.entry.teCode, m.entry.genericAvailable),
    };
  }
  return null;
}

/**
 * Fill an empty `orangeBook` on a drug. Returns the same object when
 * nothing changed so callers can cheaply detect no-ops. A value already
 * present is never overwritten.
 */
export function applyOrangeBookCrosswalk(drug: Drug): Drug {
  if (drug.orangeBook) return drug;
  const ob = orangeBookForNames([
    ...drug.ingredients.map((i) => i.name),
    drug.name,
    ...drug.synonyms,
  ]);
  if (!ob) return drug;
  return { ...drug, orangeBook: ob };
}
