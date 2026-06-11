import { createHash } from "node:crypto";
import type { Drug, PassageSection, Provenance } from "@/lib/schemas";
import { PassageSectionSchema } from "@/lib/schemas";

/**
 * Passage extraction: chunk every drug record into small, citable text
 * passages — the retrieval unit shared by the embeddings pipeline
 * (`scripts/db/embed.ts`), semantic search, and the `/v1/grounded`
 * endpoint. Backend-agnostic on purpose: both repositories and the
 * seed script build passages with the same pure functions, so the
 * static fallback and Postgres can never disagree about what a
 * passage is.
 *
 * Every passage maps 1:1 to a span of a single drug record and carries
 * that record's provenance, which is what makes per-span citations in
 * `/v1/grounded` possible without any bookkeeping at query time.
 */

export interface DrugPassage {
  /** Stable id: `<drug-slug>#<section>` or `<drug-slug>#<section>:<chunk>`. */
  id: string;
  drugSlug: string;
  drugName: string;
  section: PassageSection;
  /** Zero-based chunk index within the section. */
  chunk: number;
  text: string;
  /** sha256 of `text` — the delta key that decides re-embedding. */
  textHash: string;
  provenance: Provenance;
}

/** Soft cap per chunk; long label narratives split on sentence ends. */
const MAX_CHUNK_CHARS = 1400;

export function hashPassageText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Split a long narrative into chunks of at most MAX_CHUNK_CHARS,
 * breaking on sentence boundaries where possible so no citation span
 * ever cuts a sentence in half.
 */
function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return [];
  if (clean.length <= MAX_CHUNK_CHARS) return [clean];

  const sentences = clean.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
    // Pathological single "sentence" longer than the cap: hard-split.
    while (current.length > MAX_CHUNK_CHARS) {
      chunks.push(current.slice(0, MAX_CHUNK_CHARS));
      current = current.slice(MAX_CHUNK_CHARS).trimStart();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function sectionTexts(drug: Drug): Array<[PassageSection, string]> {
  const out: Array<[PassageSection, string]> = [];

  const classNames = drug.classes.map((c) => c.name);
  const overviewParts = [
    `${drug.name}${classNames.length > 0 ? ` — ${classNames.slice(0, 4).join(", ")}` : ""}.`,
  ];
  if (drug.shortDescription) overviewParts.push(drug.shortDescription);
  if (drug.brands.length > 0) {
    overviewParts.push(`Brand names: ${drug.brands.slice(0, 8).join(", ")}.`);
  }
  out.push(["overview", overviewParts.join(" ")]);

  if (drug.mechanism) {
    const targets =
      drug.mechanism.targets.length > 0
        ? ` Molecular targets: ${drug.mechanism.targets.join(", ")}.`
        : "";
    out.push(["mechanism", `${drug.mechanism.summary}${targets}`]);
  }

  if (drug.indications.length > 0) {
    out.push([
      "indications",
      drug.indications.map((i) => i.text).join(" "),
    ]);
  }

  if (drug.contraindications.length > 0) {
    out.push([
      "contraindications",
      drug.contraindications
        .map((c) => `${c.text} (severity: ${c.severity})`)
        .join(" "),
    ]);
  }

  if (drug.dosing.length > 0) {
    out.push([
      "dosing",
      drug.dosing
        .map((d) => {
          const bits = [
            `${d.route}, ${d.population}${d.condition ? `, ${d.condition}` : ""}: ${d.dose}`,
          ];
          if (d.frequency) bits.push(d.frequency);
          if (d.maxDose) bits.push(`max ${d.maxDose}`);
          if (d.notes) bits.push(d.notes);
          return `${bits.join("; ")}.`;
        })
        .join(" "),
    ]);
  }

  if (drug.pharmacokinetics) {
    const pk = drug.pharmacokinetics;
    const fields: Array<[string, string | undefined]> = [
      ["Half-life", pk.halfLife],
      ["Tmax", pk.tMax],
      ["Bioavailability", pk.bioavailability],
      ["Protein binding", pk.proteinBinding],
      ["Metabolism", pk.metabolism],
      ["Excretion", pk.excretion],
    ];
    const text = fields
      .filter((f): f is [string, string] => Boolean(f[1]))
      .map(([label, value]) => `${label}: ${value}.`)
      .join(" ");
    if (text) out.push(["pharmacokinetics", text]);
  }

  if (drug.interactionsNarrative) {
    out.push(["interactions", drug.interactionsNarrative]);
  }

  const label = drug.labelSections;
  if (label) {
    const labelMap: Array<[PassageSection, string | undefined]> = [
      ["boxed-warning", label.boxedWarning],
      ["dosage-and-administration", label.dosageAndAdministration],
      ["warnings-and-precautions", label.warningsAndPrecautions],
      ["adverse-reactions", label.adverseReactions],
      ["use-in-specific-populations", label.useInSpecificPopulations],
      ["overdosage", label.overdosage],
    ];
    for (const [section, text] of labelMap) {
      if (text) out.push([section, text]);
    }
  }

  if (drug.patientSummary) {
    out.push(["patient-summary", drug.patientSummary]);
  }

  return out;
}

export function buildDrugPassages(drug: Drug): DrugPassage[] {
  const passages: DrugPassage[] = [];
  for (const [section, raw] of sectionTexts(drug)) {
    const chunks = chunkText(raw);
    chunks.forEach((text, chunk) => {
      passages.push({
        id:
          chunks.length === 1
            ? `${drug.slug}#${section}`
            : `${drug.slug}#${section}:${chunk}`,
        drugSlug: drug.slug,
        drugName: drug.name,
        section,
        chunk,
        text,
        textHash: hashPassageText(text),
        provenance: drug.provenance,
      });
    });
  }
  return passages;
}

export function buildPassages(drugs: Drug[]): DrugPassage[] {
  return drugs.flatMap(buildDrugPassages);
}

// ────────────────────────────────────────────────────────────────────────
// Lexical fallback scoring
// ────────────────────────────────────────────────────────────────────────

/**
 * TF-IDF-ish lexical scoring over the same passages, used whenever
 * embeddings are unavailable (static repository, or Postgres without
 * an embeddings provider configured). Weaker than real embeddings but
 * behaviourally identical in shape, so consumers never see a different
 * contract depending on which backend answered.
 */
export interface LexicalPassageIndex {
  passages: DrugPassage[];
  /** Per-passage token → term frequency. */
  termFrequencies: Array<Map<string, number>>;
  /** Token → number of passages containing it. */
  documentFrequencies: Map<string, number>;
  /** Per-passage Euclidean norm proxy (sqrt of token count). */
  norms: number[];
}

const TOKEN_RE = /[a-z0-9]+/g;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(TOKEN_RE) ?? []).filter(
    (t) => t.length > 1,
  );
}

export function buildLexicalPassageIndex(
  passages: DrugPassage[],
): LexicalPassageIndex {
  const termFrequencies: Array<Map<string, number>> = [];
  const documentFrequencies = new Map<string, number>();
  const norms: number[] = [];

  for (const passage of passages) {
    const tf = new Map<string, number>();
    const tokens = tokenize(`${passage.drugName} ${passage.text}`);
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }
    for (const token of tf.keys()) {
      documentFrequencies.set(
        token,
        (documentFrequencies.get(token) ?? 0) + 1,
      );
    }
    termFrequencies.push(tf);
    norms.push(Math.sqrt(Math.max(tokens.length, 1)));
  }

  return { passages, termFrequencies, documentFrequencies, norms };
}

export interface ScoredPassage {
  passage: DrugPassage;
  score: number;
}

export function searchLexicalPassageIndex(
  index: LexicalPassageIndex,
  query: string,
  opts: { limit: number; sections?: PassageSection[] },
): ScoredPassage[] {
  const queryTokens = [...new Set(tokenize(query))];
  if (queryTokens.length === 0) return [];

  const total = index.passages.length;
  const sectionFilter = opts.sections ? new Set(opts.sections) : null;
  const scored: ScoredPassage[] = [];

  for (let i = 0; i < total; i++) {
    const passage = index.passages[i];
    if (sectionFilter && !sectionFilter.has(passage.section)) continue;
    const tf = index.termFrequencies[i];
    let score = 0;
    for (const token of queryTokens) {
      const f = tf.get(token);
      if (!f) continue;
      const df = index.documentFrequencies.get(token) ?? 1;
      const idf = Math.log(1 + total / df);
      score += idf * (1 + Math.log(f));
    }
    if (score > 0) {
      scored.push({ passage, score: score / index.norms[i] });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, opts.limit);

  // Normalise into 0..1 so lexical scores are comparable in *shape*
  // (not meaning) to cosine similarities from the embedding path.
  const max = top[0]?.score ?? 1;
  return top.map(({ passage, score }) => ({
    passage,
    score: Math.round((score / max) * 1000) / 1000,
  }));
}

export { PassageSectionSchema };
