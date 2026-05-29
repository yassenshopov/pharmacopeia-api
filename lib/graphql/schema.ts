/**
 * GraphQL schema for pharmacopeia.
 *
 * A thin field-selection layer over the same `PharmacopeiaRepository`
 * that powers the REST API. The Zod schemas in `lib/schemas/` remain
 * the source of truth; this module only re-shapes that data for
 * GraphQL clients that want to fetch a drug + its mechanism + a few
 * fields from each interaction in a single round-trip.
 *
 * No clever per-request caching here — the repository is already
 * synchronous over the in-memory seed dataset, so GraphQL queries are
 * cheap even when they touch every relation.
 */
import { createSchema } from "graphql-yoga";
import { getRepository } from "@/lib/data/repository";
import { InvalidSmilesError } from "@/lib/data/structure-search";
import type {
  Drug,
  DrugClass,
  DrugSummary,
  Ingredient,
  Interaction,
  SimilarDrugResult,
  StructureMatch,
} from "@/lib/schemas";

const typeDefs = /* GraphQL */ `
  scalar JSON

  """
  Audit trail attached to every persisted record so any field can be
  traced back to its source. Mirrors \`lib/schemas/shared.ts::Provenance\`.
  """
  type Provenance {
    sourceUrl: String!
    sourceHash: String!
    extractedAt: String!
    extractor: String!
    confidence: Float!
  }

  enum Jurisdiction {
    US_FDA
    EU_EMA
    UK_MHRA
    CA_HC
  }

  enum Severity {
    contraindicated
    major
    moderate
    minor
    unknown
  }

  enum DrugClassKind {
    atc
    moa
    epc
    pe
    pharm
    mesh
  }

  type IngredientRef {
    slug: ID!
    name: String!
    strength: String
    """Full ingredient record (one extra repository hop)."""
    full: Ingredient
  }

  type DrugClassRef {
    slug: ID!
    name: String!
    kind: DrugClassKind!
    code: String
    """Full class record, including all member drugs."""
    full: DrugClass
  }

  type Indication {
    text: String!
    icd10: [String!]!
  }

  type Contraindication {
    text: String!
    severity: Severity!
  }

  type Dosing {
    route: String!
    population: String!
    condition: String
    dose: String!
    frequency: String
    maxDose: String
    notes: String
  }

  type Mechanism {
    summary: String!
    targets: [String!]!
  }

  type Pharmacokinetics {
    halfLife: String
    tMax: String
    bioavailability: String
    proteinBinding: String
    metabolism: String
    excretion: String
  }

  type Approval {
    date: String!
    applicationNumber: String!
    type: String!
    sponsor: String
  }

  """
  Verbatim narrative sections lifted from the openFDA structured
  product label. Reference text, not parsed structured data.
  """
  type LabelSections {
    boxedWarning: String
    dosageAndAdministration: String
    warningsAndPrecautions: String
    adverseReactions: String
    useInSpecificPopulations: String
    overdosage: String
  }

  type Identifiers {
    rxcui: String
    ndc: [String!]!
    atc: [String!]!
    drugbank: String
    chembl: String
    pubchem: String
    unii: String
  }

  type ChemicalStructure {
    smiles: String!
    inchiKey: String
    iupacName: String
    pubchemCid: Int
    structureSvgPath: String!
    provenance: Provenance!
  }

  type Drug {
    slug: ID!
    name: String!
    synonyms: [String!]!
    jurisdiction: Jurisdiction!
    brands: [String!]!
    shortDescription: String
    ingredients: [IngredientRef!]!
    classes: [DrugClassRef!]!

    mechanism: Mechanism
    indications: [Indication!]!
    contraindications: [Contraindication!]!
    dosing: [Dosing!]!
    pharmacokinetics: Pharmacokinetics
    approvalHistory: [Approval!]!
    patientSummary: String
    interactionsNarrative: String
    labelSections: LabelSections
    identifiers: Identifiers!
    chemical: ChemicalStructure
    provenance: Provenance!

    """All known pair-graph interactions involving this drug."""
    interactions: [Interaction!]!
    """
    Precomputed structural analogs ranked by 2D Tanimoto similarity.
    Structural proximity only — never therapeutic equivalence.
    """
    similar: [SimilarDrug!]!
  }

  type Interaction {
    drugA: ID!
    drugB: ID!
    severity: Severity!
    mechanism: String
    description: String!
    recommendation: String
    evidenceSpan: String
    provenance: Provenance!
  }

  type SimilarDrug {
    slug: ID!
    name: String!
    score: Float!
    className: String
  }

  type DrugClass {
    slug: ID!
    name: String!
    kind: DrugClassKind!
    code: String
    description: String
    parent: DrugClassParent
    drugCount: Int!
    provenance: Provenance!
    """Drugs assigned to this class (full summaries)."""
    drugs: [Drug!]!
  }

  type DrugClassParent {
    slug: ID!
    name: String!
  }

  type Ingredient {
    slug: ID!
    name: String!
    synonyms: [String!]!
    rxcui: String
    unii: String
    smiles: String
    inchikey: String
    molecularFormula: String
    molecularWeight: Float
    drugCount: Int!
    provenance: Provenance!
    """Drugs that contain this active ingredient."""
    drugs: [Drug!]!
  }

  type Pagination {
    total: Int!
    limit: Int!
    offset: Int!
  }

  type DrugList {
    items: [Drug!]!
    pagination: Pagination!
  }

  type ClassList {
    items: [DrugClass!]!
    pagination: Pagination!
  }

  type IngredientList {
    items: [Ingredient!]!
    pagination: Pagination!
  }

  type Stats {
    drugs: Int!
    classes: Int!
    ingredients: Int!
    interactions: Int!
    indications: Int!
    version: String!
    updatedAt: String!
  }

  enum SearchKind {
    drug
    class
    ingredient
  }

  type SearchResult {
    slug: ID!
    name: String!
    kind: SearchKind!
    description: String
  }

  type StructureMatch {
    slug: ID!
    name: String!
    score: Float!
    className: String
    smiles: String!
    """Resolve the full drug record for this match."""
    drug: Drug
  }

  type StructureSearchResult {
    method: String!
    total: Int!
    results: [StructureMatch!]!
  }

  type InteractionSummary {
    contraindicated: Int!
    major: Int!
    moderate: Int!
    minor: Int!
    unknown: Int!
  }

  type InteractionCheckResult {
    input: [ID!]!
    pairs: [Interaction!]!
    summary: InteractionSummary!
  }

  type Query {
    """Top-level counts and current version of the dataset."""
    stats: Stats!

    """A single drug by slug, or null if not in the dataset."""
    drug(slug: ID!): Drug

    """
    Paginated drug summaries. Optionally filter by class slug or
    ingredient slug.
    """
    drugs(
      limit: Int = 50
      offset: Int = 0
      classSlug: String
      ingredientSlug: String
    ): DrugList!

    """A single pharmacological class by slug."""
    class(slug: ID!): DrugClass

    classes(limit: Int = 50, offset: Int = 0): ClassList!

    ingredient(slug: ID!): Ingredient

    ingredients(limit: Int = 50, offset: Int = 0): IngredientList!

    """Cross-entity search across drug, class, and ingredient names."""
    search(q: String!, limit: Int = 10): [SearchResult!]!

    """
    Pairwise interaction check across a set of drug slugs. Mirrors
    POST /api/v1/interactions/check.
    """
    checkInteractions(drugs: [ID!]!): InteractionCheckResult!

    """
    Rank drugs by 2D Tanimoto similarity to a caller-supplied SMILES.
    Structural proximity only — never therapeutic equivalence.
    """
    structureSearch(
      smiles: String!
      limit: Int = 10
      threshold: Float = 0
    ): StructureSearchResult!
  }
`;

/**
 * Light wrapper for `IngredientRef.full` resolver: fetches the full
 * ingredient record on demand so a query that only asks for `name`
 * doesn't pay the lookup cost.
 */
type IngredientRefSource = Drug["ingredients"][number];
type ClassRefSource = Drug["classes"][number];

type Context = Record<string, never>;

const resolvers = {
  Jurisdiction: {
    US_FDA: "US-FDA",
    EU_EMA: "EU-EMA",
    UK_MHRA: "UK-MHRA",
    CA_HC: "CA-HC",
  },

  Query: {
    async stats() {
      return getRepository().getStats();
    },

    async drug(_: unknown, { slug }: { slug: string }) {
      return getRepository().getDrug(slug);
    },

    async drugs(
      _: unknown,
      args: {
        limit?: number;
        offset?: number;
        classSlug?: string | null;
        ingredientSlug?: string | null;
      },
    ) {
      const { items, pagination } = await getRepository().listDrugs({
        limit: args.limit ?? undefined,
        offset: args.offset ?? undefined,
        classSlug: args.classSlug ?? undefined,
        ingredientSlug: args.ingredientSlug ?? undefined,
      });
      // Hydrate each summary into the richer Drug type lazily by slug.
      // Many clients only want a handful of fields, so we keep these as
      // summaries and let the per-field resolvers on Drug handle the
      // upgrade if the caller asks for something heavier.
      return { items, pagination };
    },

    async class(_: unknown, { slug }: { slug: string }) {
      return getRepository().getClass(slug);
    },

    async classes(
      _: unknown,
      args: { limit?: number; offset?: number },
    ) {
      return getRepository().listClasses({
        limit: args.limit ?? undefined,
        offset: args.offset ?? undefined,
      });
    },

    async ingredient(_: unknown, { slug }: { slug: string }) {
      return getRepository().getIngredient(slug);
    },

    async ingredients(
      _: unknown,
      args: { limit?: number; offset?: number },
    ) {
      return getRepository().listIngredients({
        limit: args.limit ?? undefined,
        offset: args.offset ?? undefined,
      });
    },

    async search(
      _: unknown,
      { q, limit }: { q: string; limit?: number },
    ) {
      return getRepository().search(q, limit ?? 10);
    },

    async checkInteractions(
      _: unknown,
      { drugs }: { drugs: string[] },
    ) {
      return getRepository().checkInteractions(drugs);
    },

    async structureSearch(
      _: unknown,
      args: { smiles: string; limit?: number; threshold?: number },
    ) {
      try {
        const results = await getRepository().searchByStructure(args.smiles, {
          limit: args.limit ?? 10,
          threshold: args.threshold ?? 0,
        });
        return {
          method: "tanimoto-2d-fingerprint",
          total: results.length,
          results,
        };
      } catch (err) {
        if (err instanceof InvalidSmilesError) {
          // GraphQL surfaces thrown errors as GraphQLError entries on
          // the response; clients see `errors[0].message`.
          throw new Error(err.message);
        }
        throw err;
      }
    },
  },

  Drug: {
    // Surface fields are 1:1 with the Zod types and resolve by default.
    // These three relations make a second repository call only when
    // the client actually selects them.
    async interactions(parent: Drug | DrugSummary) {
      return getRepository().getDrugInteractions(parent.slug);
    },

    async similar(parent: Drug | DrugSummary) {
      return getRepository().getSimilarDrugs(parent.slug);
    },

    // The list resolvers return DrugSummary; if a query reaches a
    // field that only exists on the full Drug, upgrade lazily.
    async mechanism(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.mechanism ?? null;
      const full = await getRepository().getDrug(parent.slug);
      return full?.mechanism ?? null;
    },
    async indications(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.indications;
      const full = await getRepository().getDrug(parent.slug);
      return full?.indications ?? [];
    },
    async contraindications(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.contraindications;
      const full = await getRepository().getDrug(parent.slug);
      return full?.contraindications ?? [];
    },
    async dosing(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.dosing;
      const full = await getRepository().getDrug(parent.slug);
      return full?.dosing ?? [];
    },
    async pharmacokinetics(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.pharmacokinetics ?? null;
      const full = await getRepository().getDrug(parent.slug);
      return full?.pharmacokinetics ?? null;
    },
    async approvalHistory(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.approvalHistory;
      const full = await getRepository().getDrug(parent.slug);
      return full?.approvalHistory ?? [];
    },
    async patientSummary(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.patientSummary ?? null;
      const full = await getRepository().getDrug(parent.slug);
      return full?.patientSummary ?? null;
    },
    async interactionsNarrative(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.interactionsNarrative ?? null;
      const full = await getRepository().getDrug(parent.slug);
      return full?.interactionsNarrative ?? null;
    },
    async labelSections(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.labelSections ?? null;
      const full = await getRepository().getDrug(parent.slug);
      return full?.labelSections ?? null;
    },
    async identifiers(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.identifiers;
      const full = await getRepository().getDrug(parent.slug);
      return full?.identifiers ?? null;
    },
    async chemical(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.chemical ?? null;
      const full = await getRepository().getDrug(parent.slug);
      return full?.chemical ?? null;
    },
    async provenance(parent: Drug | DrugSummary) {
      if (isFullDrug(parent)) return parent.provenance;
      const full = await getRepository().getDrug(parent.slug);
      return full?.provenance ?? null;
    },
  },

  IngredientRef: {
    async full(parent: IngredientRefSource) {
      return getRepository().getIngredient(parent.slug);
    },
  },

  DrugClassRef: {
    async full(parent: ClassRefSource) {
      return getRepository().getClass(parent.slug);
    },
  },

  DrugClass: {
    async drugs(parent: DrugClass) {
      const { items } = await getRepository().listDrugs({
        classSlug: parent.slug,
        limit: 200,
      });
      return items;
    },
  },

  Ingredient: {
    async drugs(parent: Ingredient) {
      const { items } = await getRepository().listDrugs({
        ingredientSlug: parent.slug,
        limit: 200,
      });
      return items;
    },
  },

  Interaction: {
    // Zod's `evidenceSpan` is already optional; this resolver only exists
    // so the type system stays explicit about the nullability story.
    evidenceSpan(parent: Interaction) {
      return parent.evidenceSpan ?? null;
    },
  },

  SimilarDrug: {
    className(parent: SimilarDrugResult) {
      return parent.className ?? null;
    },
  },

  StructureMatch: {
    async drug(parent: StructureMatch) {
      return getRepository().getDrug(parent.slug);
    },
  },

  SearchResult: {
    description(parent: { description?: string }) {
      return parent.description ?? null;
    },
  },
};

/**
 * Cheap structural check: only the full Drug carries `identifiers`.
 * Used to decide whether a list resolver's parent already has the
 * heavy fields or we need to upgrade via `getDrug`.
 */
function isFullDrug(d: Drug | DrugSummary): d is Drug {
  return (d as Drug).identifiers !== undefined;
}

export const schema = createSchema<Context>({
  typeDefs,
  resolvers,
});
