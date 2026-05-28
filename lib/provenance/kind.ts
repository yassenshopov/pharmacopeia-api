import type { Provenance } from "@/lib/schemas";

/**
 * Three-bucket classification of provenance so the UI can decide how
 * loudly to mark a piece of content.
 *
 * - `ai-extracted`  — produced or rewritten by a language model.
 * - `auto-sourced`  — pulled from a structured/authoritative source by
 *                     a deterministic pipeline; the words themselves
 *                     were written by humans at that source.
 * - `curated`       — typed by a maintainer; default trust, no badge.
 *
 * Keep this file the single source of truth. Both the page-level
 * badges and the legend on /docs read from `kindOf` and `labelFor`.
 */

export type ProvenanceKind = "ai-extracted" | "auto-sourced" | "curated";

const AI_PREFIXES = [
  "llm-",
  "claude-",
  "gpt-",
  "gemini-",
  "mistral-",
  "anthropic-",
  "openai-",
] as const;

const SOURCED_EXACT = new Set<string>([
  "rxnav",
  "rxnorm",
  "rxclass",
  "openfda",
  "dailymed",
  "drugbank",
  "drugbank-open",
  "drugs-at-fda",
  "orange-book",
  "atc-who",
]);

const SOURCED_PREFIXES = ["ingest-script", "ingest-"] as const;

const CURATED_EXACT = new Set<string>(["hand-curated", "manual", "curated"]);

function stripVersion(extractor: string): string {
  const at = extractor.indexOf("@");
  return at === -1 ? extractor : extractor.slice(0, at);
}

export function kindOf(provenance: Provenance): ProvenanceKind {
  const raw = provenance.extractor.toLowerCase();
  const base = stripVersion(raw);

  if (AI_PREFIXES.some((p) => base.startsWith(p))) return "ai-extracted";
  if (SOURCED_EXACT.has(base)) return "auto-sourced";
  if (SOURCED_PREFIXES.some((p) => base.startsWith(p))) return "auto-sourced";
  if (CURATED_EXACT.has(base)) return "curated";

  return "curated";
}

const SOURCE_NAMES: Record<string, string> = {
  rxnav: "RxNav",
  rxnorm: "RxNorm",
  rxclass: "RxClass",
  openfda: "openFDA",
  dailymed: "DailyMed",
  drugbank: "DrugBank",
  "drugbank-open": "DrugBank Open",
  "drugs-at-fda": "Drugs@FDA",
  "orange-book": "FDA Orange Book",
  "atc-who": "WHO ATC",
};

/**
 * Short human-readable label for a kind. Pass the provenance so we can
 * name the source for `auto-sourced` records ("Sourced from RxNav")
 * and the model family for `ai-extracted` ones.
 */
export function labelFor(
  kind: ProvenanceKind,
  provenance?: Provenance,
): string {
  if (kind === "ai-extracted") return "AI-extracted";
  if (kind === "curated") return "Curated";

  if (!provenance) return "Sourced";
  const base = stripVersion(provenance.extractor.toLowerCase());
  if (base.startsWith("ingest-")) return "Ingested";
  const pretty = SOURCE_NAMES[base];
  return pretty ? `Sourced from ${pretty}` : "Sourced";
}
