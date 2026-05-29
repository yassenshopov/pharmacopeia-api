import { z } from "zod";
import { ADVERSE_EVENT_DISCLAIMER } from "./adverse-events";
import { LiteratureReferenceSchema } from "./literature";
import { ProvenanceSchema, SlugSchema } from "./shared";

/**
 * Reactions are MedDRA Preferred Terms ("Diarrhoea", "Drug
 * Hypersensitivity", "International Normalised Ratio Increased") as
 * reported to FAERS. They are NOT symptoms in any clinical sense, and
 * the directory is NOT a symptom checker or diagnostic tool. Every
 * reaction record carries the same FAERS framing as the per-drug
 * adverse-event endpoint so a downstream consumer can never accidentally
 * read these counts as incidence or causal evidence.
 *
 * The directory is derived from the per-drug FAERS aggregates rather
 * than ingested separately, so there is no `scripts/ingest/` script for
 * it — the source of truth is `lib/data/seed/adverse-events.ts`. Each
 * canonical reaction may carry American-English aliases (Diarrhoea ↔
 * Diarrhea) so URL hits on either spelling resolve to the same page.
 */

export { ADVERSE_EVENT_DISCLAIMER } from "./adverse-events";

/**
 * Lightweight reaction record for browse/list surfaces and reverse
 * indexes. Mirrors what we keep cheap to compute and bounded in size.
 */
export const ReactionSummarySchema = z.object({
  slug: SlugSchema,
  /** MedDRA Preferred Term as supplied by FAERS (British English). */
  name: z.string().min(1),
  /**
   * Alternate spellings that resolve to this reaction — typically the
   * American-English form when FAERS uses British English. Order is
   * preserved; the first entry is the most natural alternate.
   */
  aliases: z.array(z.string()).default([]),
  /** Number of drugs in the dataset that report this reaction at all. */
  drugCount: z.number().int().nonnegative(),
  /**
   * Sum of FAERS reports across every drug that mentions this term.
   * Useful for ordering the browse index by overall reporting volume.
   */
  totalReports: z.number().int().nonnegative(),
});
export type ReactionSummary = z.infer<typeof ReactionSummarySchema>;

/**
 * One (drug, reaction) cell with both the raw count and the share —
 * what fraction of the drug's matched FAERS reports listed this
 * reaction. `share` is in [0, 1]; renderers multiply by 100 for the
 * percentage. Shares routinely sum to >100% across reactions because a
 * single report can list several.
 *
 * `share` is **null** when the drug's `drugTotalReports` is 0 (the
 * upstream FAERS ingest sometimes drops the totals query on transient
 * 429s, leaving the denominator unknown). Treating that case as `0` or
 * `1` would silently mislead consumers, so the schema forces a
 * deliberate handling decision.
 */
export const ReactionDrugRowSchema = z.object({
  drug: SlugSchema,
  name: z.string().min(1),
  count: z.number().int().nonnegative(),
  share: z.number().min(0).max(1).nullable(),
  /** Denominator for `share`: total FAERS reports matched for the drug. */
  drugTotalReports: z.number().int().nonnegative(),
});
export type ReactionDrugRow = z.infer<typeof ReactionDrugRowSchema>;

/**
 * "Related" reactions: ones most often co-reported on the same drug
 * set as this one, ranked by Jaccard similarity over the drug-id sets.
 * Free, honest graph density — entirely derived from our data, no
 * paid-licence MedDRA SOC mapping required.
 */
export const RelatedReactionSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  /** Drugs that report BOTH this reaction and the parent reaction. */
  sharedDrugs: z.number().int().nonnegative(),
  /** Jaccard = |intersection| / |union| over drug-id sets. */
  similarity: z.number().min(0).max(1),
});
export type RelatedReaction = z.infer<typeof RelatedReactionSchema>;

/**
 * A node in the MeSH descriptor tree. Used to expose parent (and
 * eventually sibling) descriptors next to a reaction so consumers can
 * see where this reaction sits in NLM's controlled vocabulary without
 * a second round-trip.
 */
export const MeshTreeNodeSchema = z.object({
  /** MeSH descriptor UID (the eight-digit NCBI id, e.g. "68012817"). */
  uid: z.string().min(1),
  /** MeSH D-number (e.g. "D012817"). Stable canonical identifier. */
  descriptorId: z.string().regex(/^D\d{6,9}$/),
  /** Canonical MeSH descriptor name (e.g. "Signs and Symptoms, Digestive"). */
  name: z.string().min(1),
});
export type MeshTreeNode = z.infer<typeof MeshTreeNodeSchema>;

/**
 * Reference metadata for a single MedDRA Preferred Term. Sourced from
 * NLM MeSH (scope note, descriptor identifiers, tree position) and the
 * NCBI E-utilities (recent PubMed papers with the descriptor as MeSH
 * major topic). Everything in this record is written by NLM librarians
 * or pulled from indexed PubMed metadata — pharmacopeia never authors
 * its own clinical definitions.
 *
 * `null` on a reaction record means the ingest script either hasn't
 * been run or could not find a MeSH descriptor matching the term —
 * "Drug Ineffective" and "Off Label Use" are MedDRA administrative
 * concepts with no MeSH counterpart, for example.
 */
export const ReactionMetaSchema = z.object({
  /** MeSH D-number (e.g. "D003967"). */
  meshDescriptorId: z.string().regex(/^D\d{6,9}$/),
  /** NCBI MeSH UID; used to build mesh.nlm.nih.gov URLs. */
  meshUid: z.string().min(1),
  /** Canonical MeSH descriptor name (e.g. "Diarrhea"). */
  meshDescriptorName: z.string().min(1),
  /** Alternate spellings/synonyms registered against the same descriptor. */
  meshEntryTerms: z.array(z.string()).default([]),
  /** NLM-authored definition. Treat as read-only quoted content. */
  scopeNote: z.string().min(1),
  /**
   * Tree numbers (one descriptor can sit in multiple branches; for
   * Diarrhea: ["C23.888.821.214"]).
   */
  treeNumbers: z.array(z.string()).min(1),
  /**
   * Immediate parent descriptors in the MeSH hierarchy, one per tree
   * position. May be empty when the descriptor is a top-level node.
   */
  parents: z.array(MeshTreeNodeSchema).default([]),
  /** Pre-built NLM MeSH browser link, so consumers don't assemble it. */
  meshBrowserUrl: z.string().url(),
  /**
   * Recent PubMed papers indexed with this MeSH term as a major topic.
   * Same schema as the per-drug literature records — capped at the
   * ingest layer (default 6) so payloads stay tight.
   */
  references: z.array(LiteratureReferenceSchema).default([]),
  provenance: ProvenanceSchema,
});
export type ReactionMeta = z.infer<typeof ReactionMetaSchema>;

/**
 * Full reaction record. The schema bakes the FAERS disclaimer in so
 * SDK consumers receive the framing automatically — they don't have to
 * re-state it from the per-drug endpoint just because they hit the
 * reaction surface instead.
 */
export const ReactionSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  drugCount: z.number().int().nonnegative(),
  totalReports: z.number().int().nonnegative(),
  drugs: z.array(ReactionDrugRowSchema),
  relatedReactions: z.array(RelatedReactionSchema),
  /**
   * Reference content sourced from NLM MeSH and PubMed: an
   * authoritative scope note, descriptor identifiers, tree position,
   * and recent literature about the term itself. `null` when no MeSH
   * descriptor matches (administrative MedDRA terms like "Drug
   * Ineffective", or when the ingest pipeline hasn't been run).
   */
  meta: ReactionMetaSchema.nullable(),
  disclaimer: z.string(),
});
export type Reaction = z.infer<typeof ReactionSchema>;

/** Mandatory framing used both inline on records and in disclaimers. */
export { ADVERSE_EVENT_DISCLAIMER as REACTION_DISCLAIMER };

/**
 * Default disclaimer string baked into every reaction record. Kept as a
 * constant rather than inlined so tests, the UI, the SDK, and the MCP
 * server can assert against the same canonical wording.
 */
export const REACTION_DIRECTORY_DESCRIPTION =
  "Reactions are MedDRA Preferred Terms reported to FAERS. This directory is a reverse index of reporting volume — NOT a symptom checker, NOT diagnostic guidance.";
