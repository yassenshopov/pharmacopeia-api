/**
 * Typed glossary content. Drives both the rendered /glossary page and a
 * `DefinedTermSet` JSON-LD block. Definitions are reference-style and
 * plain text so they serialise cleanly into structured data.
 *
 * Adding a term is one append. Anchors are derived from `slug`.
 */

export type GlossaryCategory =
  | "identifiers"
  | "classification"
  | "clinical"
  | "chemistry"
  | "platform";

export interface GlossaryRelated {
  label: string;
  href: string;
}

export interface GlossaryTerm {
  /** Stable anchor slug, lowercase-with-hyphens. */
  slug: string;
  term: string;
  category: GlossaryCategory;
  /** Plain text definition. */
  definition: string;
  /** Alternate names / abbreviations. */
  aka?: string[];
  /** Internal cross-links to relevant pages. */
  related?: GlossaryRelated[];
}

export const GLOSSARY_CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  identifiers: "Identifiers",
  classification: "Classification",
  clinical: "Clinical concepts",
  chemistry: "Chemistry",
  platform: "Platform & data",
};

export const GLOSSARY_CATEGORY_ORDER: GlossaryCategory[] = [
  "identifiers",
  "classification",
  "clinical",
  "chemistry",
  "platform",
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // --- Identifiers ---
  {
    slug: "rxcui",
    term: "RxCUI",
    category: "identifiers",
    aka: ["RxNorm Concept Unique Identifier"],
    definition:
      "A numeric identifier assigned by RxNorm (maintained by the U.S. National Library of Medicine) to a drug concept. RxCUIs let you link a drug across systems that all reference RxNorm.",
    related: [{ label: "Ingredients", href: "/ingredients" }],
  },
  {
    slug: "unii",
    term: "UNII",
    category: "identifiers",
    aka: ["Unique Ingredient Identifier"],
    definition:
      "A non-proprietary, alphanumeric code from the FDA's Substance Registration System that uniquely identifies a substance based on its molecular structure or descriptive information.",
    related: [{ label: "Ingredients", href: "/ingredients" }],
  },
  {
    slug: "ndc",
    term: "NDC",
    category: "identifiers",
    aka: ["National Drug Code"],
    definition:
      "A unique, three-segment number that is the FDA's universal product identifier for human drugs marketed in the United States. It encodes the labeler, product, and package size.",
  },
  {
    slug: "drugbank-id",
    term: "DrugBank ID",
    category: "identifiers",
    definition:
      "An accession number (for example DB00331) from DrugBank that identifies a drug entry. pharmacopeia references DrugBank's open data release only.",
  },
  {
    slug: "slug",
    term: "Slug",
    category: "platform",
    definition:
      "A stable, human-readable, lowercase-with-hyphens key (for example metformin) used to address every entity in pharmacopeia. Slugs never change and numeric database IDs are never exposed in the API.",
    related: [{ label: "Docs — conventions", href: "/docs#conventions" }],
  },

  // --- Classification ---
  {
    slug: "atc",
    term: "ATC code",
    category: "classification",
    aka: ["Anatomical Therapeutic Chemical classification"],
    definition:
      "The WHO's hierarchical system that classifies drugs by the organ or system they act on and their therapeutic, pharmacological, and chemical properties. A code such as A10BA02 places metformin within the biguanide blood-glucose-lowering drugs.",
    related: [{ label: "ATC classification", href: "/atc" }],
  },
  {
    slug: "epc",
    term: "EPC",
    category: "classification",
    aka: ["Established Pharmacologic Class"],
    definition:
      "An FDA-curated pharmacologic class assigned to a drug, describing its scientifically documented mechanism of action in a standardized phrase shown on labeling.",
    related: [{ label: "Classes", href: "/classes" }],
  },
  {
    slug: "moa",
    term: "Mechanism of action",
    category: "classification",
    aka: ["MoA"],
    definition:
      "The specific biochemical interaction through which a drug produces its effect — for example, the molecular target it binds and what that binding does. In pharmacopeia, mechanism is a distinct, separately-sourced section of each drug record.",
    related: [{ label: "Classes", href: "/classes" }],
  },
  {
    slug: "drug-class",
    term: "Drug class",
    category: "classification",
    definition:
      "A grouping of drugs that share a chemical structure, mechanism of action, or therapeutic use. pharmacopeia models classes from several systems (ATC, EPC, MoA, and MeSH) rather than a single taxonomy.",
    related: [{ label: "Classes", href: "/classes" }],
  },

  // --- Clinical concepts ---
  {
    slug: "indication",
    term: "Indication",
    category: "clinical",
    definition:
      "A condition or use for which a drug is approved or recognized. In pharmacopeia, indications are reference facts drawn from labeling — not a recommendation that a given drug is appropriate for a given patient.",
  },
  {
    slug: "contraindication",
    term: "Contraindication",
    category: "clinical",
    definition:
      "A situation in which a drug should not be used because the risk clearly outweighs any benefit. Listed for reference only; clinical judgment always governs real use.",
  },
  {
    slug: "boxed-warning",
    term: "Boxed warning",
    category: "clinical",
    aka: ["Black box warning"],
    definition:
      "The FDA's strongest labeling warning, used to highlight serious or life-threatening risks. It appears, when present, as a dedicated section of a drug's label record.",
  },
  {
    slug: "adverse-reaction",
    term: "Adverse reaction",
    category: "clinical",
    aka: ["Adverse event", "Side effect"],
    definition:
      "An undesirable effect associated with use of a drug. pharmacopeia surfaces the adverse-reactions section of FDA labeling as structured text.",
  },
  {
    slug: "drug-interaction",
    term: "Drug interaction",
    category: "clinical",
    definition:
      "A change in a drug's effect caused by another drug, food, or condition taken together. pharmacopeia models known pairwise interactions with a severity grade, a mechanism, and a reference-style note.",
    related: [{ label: "Interactions", href: "/interactions" }],
  },
  {
    slug: "pharmacokinetics",
    term: "Pharmacokinetics",
    category: "clinical",
    aka: ["PK", "ADME"],
    definition:
      "What the body does to a drug — its absorption, distribution, metabolism, and excretion. Often summarized by parameters such as half-life and route of elimination.",
  },
  {
    slug: "half-life",
    term: "Half-life",
    category: "clinical",
    aka: ["t½"],
    definition:
      "The time required for the concentration of a drug in the body to fall to half its value. A core pharmacokinetic parameter that informs dosing frequency.",
  },

  // --- Chemistry ---
  {
    slug: "smiles",
    term: "SMILES",
    category: "chemistry",
    aka: ["Simplified Molecular-Input Line-Entry System"],
    definition:
      "A compact text notation that encodes a molecule's structure as a line of ASCII characters, so a chemical structure can be stored and transmitted as a string.",
    related: [{ label: "Ingredients", href: "/ingredients" }],
  },
  {
    slug: "inchikey",
    term: "InChIKey",
    category: "chemistry",
    definition:
      "A fixed-length, hashed version of the IUPAC International Chemical Identifier (InChI). Its uniformity makes it ideal as a database key and for web searches that resolve to a specific compound.",
    related: [{ label: "Ingredients", href: "/ingredients" }],
  },
  {
    slug: "active-ingredient",
    term: "Active ingredient",
    category: "chemistry",
    definition:
      "The component of a drug product that is pharmacologically active and responsible for its intended effect, as distinct from excipients (inactive ingredients).",
    related: [{ label: "Ingredients", href: "/ingredients" }],
  },
  {
    slug: "tanimoto",
    term: "Tanimoto similarity",
    category: "chemistry",
    definition:
      "A coefficient between 0 and 1 measuring how similar two molecules are based on their structural fingerprints. pharmacopeia uses it to rank structurally similar drugs from PubChem 2D fingerprints.",
  },
  {
    slug: "brand-name",
    term: "Brand name",
    category: "chemistry",
    aka: ["Proprietary name", "Trade name"],
    definition:
      "The marketed name a manufacturer gives a product, as opposed to the generic (nonproprietary) ingredient name. A single generic can have many brand names; pharmacopeia maintains a brand-to-generic crosswalk.",
    related: [{ label: "Brands", href: "/brands" }],
  },

  // --- Platform & data ---
  {
    slug: "provenance",
    term: "Provenance",
    category: "platform",
    definition:
      "The per-record audit trail attached to every fact in pharmacopeia: the canonical source URL, a source hash, when it was extracted, which extractor produced it, and a confidence score. It is how you verify any field and how the pipeline knows what to refresh.",
    related: [{ label: "Docs — indicators", href: "/docs#indicators" }],
  },
  {
    slug: "jurisdiction",
    term: "Jurisdiction",
    category: "platform",
    definition:
      "The regulatory region a record describes. v0 is US-FDA only; additional jurisdictions are added additively rather than by forking the dataset, because the same drug can be labeled differently in different regions.",
  },
  {
    slug: "ai-extracted",
    term: "AI-extracted",
    category: "platform",
    definition:
      "A provenance label for content an LLM produced or rewrote. It is flagged with a visible badge so you read it critically and cross-check the linked source. Contrast with auto-sourced and curated content.",
    related: [{ label: "Docs — indicators", href: "/docs#indicators" }],
  },
  {
    slug: "auto-sourced",
    term: "Auto-sourced",
    category: "platform",
    definition:
      "A provenance label for content a script fetched directly from a structured, authoritative source such as openFDA or RxNav. Humans wrote the words; the pipeline only shipped them.",
    related: [{ label: "Docs — indicators", href: "/docs#indicators" }],
  },
  {
    slug: "idempotent-pipeline",
    term: "Idempotent pipeline",
    category: "platform",
    definition:
      "An ingest or extraction step that can be re-run safely without creating duplicates or corrupting data. pharmacopeia achieves this with upserts keyed on the source, source hash, and section.",
  },
];
