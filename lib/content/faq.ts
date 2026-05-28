/**
 * Typed FAQ content. Answers are plain text (split into paragraphs on
 * blank lines) so the same array drives both the rendered page and the
 * `FAQPage` JSON-LD block. Keep answers reference-style, never
 * recommendation-style — this is not clinical advice.
 *
 * Adding a question is one append. Anchors are derived from `id`.
 */

export type FaqCategory =
  | "basics"
  | "data"
  | "api"
  | "usage"
  | "contributing";

export interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  /** Plain text. Blank lines become separate paragraphs on the page. */
  answer: string;
}

export const FAQ_CATEGORY_LABEL: Record<FaqCategory, string> = {
  basics: "The basics",
  data: "Data & sources",
  api: "Using the API",
  usage: "Licensing & limits",
  contributing: "Contributing",
};

export const FAQ_CATEGORY_ORDER: FaqCategory[] = [
  "basics",
  "data",
  "api",
  "usage",
  "contributing",
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-pharmacopeia",
    category: "basics",
    question: "What is pharmacopeia?",
    answer:
      "pharmacopeia is a developer-first reference API for medications. It exposes structured, predictable JSON about drugs, pharmacological classes, active ingredients, brand names, and known interactions.\n\nThink of it as a \"PokeAPI for drugs\": stable public facts behind clean, versioned endpoints. It is not a clinical product.",
  },
  {
    id: "is-this-medical-advice",
    category: "basics",
    question: "Is this medical advice?",
    answer:
      "No. pharmacopeia is for educational and informational use only. Nothing in the API or on this site is medical advice, a diagnosis, a treatment recommendation, or a substitute for a qualified clinician.\n\nAlways verify any field against its canonical source before acting on it. Every record carries a provenance object with the source URL for exactly this reason.",
  },
  {
    id: "not-a-clinical-tool",
    category: "basics",
    question: "Can I use it for clinical decision-making?",
    answer:
      "No. pharmacopeia is explicitly not a clinical decision-support tool, not an EHR or FHIR integration layer, not a symptom checker, and not a medical device under FDA SaMD or EU MDR rules. All language is reference-style by design.\n\nIf you need a regulated clinical data source, license one. This project is a structured reference layer, not a substitute for one.",
  },
  {
    id: "where-does-data-come-from",
    category: "data",
    question: "Where does the data come from?",
    answer:
      "Primary sources are public, authoritative datasets: openFDA, RxNorm / RxNav, DailyMed, the WHO ATC classification, and DrugBank's open data release. Chemistry identifiers are cross-referenced against PubChem.\n\nWe do not wrap paid feeds (DrugBank's full commercial dataset, SNOMED CT outside member countries, UpToDate, Lexicomp, etc.).",
  },
  {
    id: "ai-extracted-content",
    category: "data",
    question: "How do I know which content was written by an AI?",
    answer:
      "Every field is tagged with the pipeline that produced it. Content an LLM produced or rewrote is marked with an \"AI-extracted\" badge. Content a script pulled directly from a structured source is marked \"auto-sourced\". Content a maintainer typed by hand carries no badge.\n\nRegardless of badge, the underlying provenance — extractor, confidence, and source URL — is always present in the JSON payload.",
  },
  {
    id: "how-current",
    category: "data",
    question: "How current is the data?",
    answer:
      "The current build is a seed dataset (v0). It is a curated slice, not the full pharmacopeia, and is intended to prove out the schema and the surface. Each record reports when it was extracted via provenance.extractedAt, and the API exposes a top-level updatedAt through /api/v1/stats.",
  },
  {
    id: "report-an-error",
    category: "data",
    question: "I found an error. How do I report it?",
    answer:
      "Open an issue on GitHub. Include the entity slug, the field, the value you expected, and ideally the canonical source that supports the correction. Because every record links its source, fixes are usually fast to verify.",
  },
  {
    id: "authentication",
    category: "api",
    question: "Do I need an API key?",
    answer:
      "No. There is no authentication in v0. Reasonable rate limits apply to keep the service healthy. If higher-volume access becomes necessary later, it will be additive and announced on the roadmap.",
  },
  {
    id: "api-shape",
    category: "api",
    question: "How is the API structured?",
    answer:
      "Every public route lives under /api/v1, and every entity is keyed by a stable lowercase-with-hyphens slug — numeric IDs are never exposed. Requests and responses are application/json, and the responses are generated and validated by the same Zod schemas used internally, so the docs page is effectively the schema.\n\nBreaking changes will ship under a new prefix (/api/v2) rather than mutating v1.",
  },
  {
    id: "slugs-stable",
    category: "api",
    question: "Will the slugs or URLs ever change?",
    answer:
      "No. Slugs are forever. Once an entity has a slug, it keeps it. That is a hard architectural rule so you can hardcode URLs and cache aggressively without fear of breakage.",
  },
  {
    id: "caching",
    category: "api",
    question: "Can I cache responses?",
    answer:
      "Yes, and you should. GET routes ship with Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400 unless explicitly hot. Slugs are stable, so cached URLs stay valid.",
  },
  {
    id: "license",
    category: "usage",
    question: "Can I use this commercially?",
    answer:
      "The pharmacopeia code and the API surface are open. Downstream data, however, inherits the license of its upstream source — openFDA is public domain, but DrugBank's open data and other sources carry their own terms.\n\nCheck each record's provenance.sourceUrl and the upstream license before redistributing. When in doubt, attribute the original source.",
  },
  {
    id: "attribution",
    category: "usage",
    question: "How should I attribute pharmacopeia?",
    answer:
      "A link back to pharmacopeia.dev is appreciated but not required for the code. For the data, attribute the upstream source named in each record's provenance, since that is the authoritative origin of the facts.",
  },
  {
    id: "contributing",
    category: "contributing",
    question: "How can I contribute?",
    answer:
      "The project is open on GitHub. Useful contributions include data corrections with sources, new entity coverage, schema improvements, and documentation. Read AGENTS.md first — it documents the architectural rules contributions are expected to follow.",
  },
  {
    id: "roadmap",
    category: "contributing",
    question: "What's planned next?",
    answer:
      "The roadmap page is the live changelog and backlog: what has shipped, what is in progress, and what is queued. The biggest planned step is moving from the static seed dataset to a real database with an LLM-backed extraction pipeline that carries section-level provenance.",
  },
];
