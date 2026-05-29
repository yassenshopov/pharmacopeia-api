import { z } from "zod";
import { ProvenanceSchema, SlugSchema } from "./shared";

/**
 * PubMed literature crosswalks.
 *
 * Each drug carries an optional list of canonical PubMed references —
 * the most-cited papers, reviews, and meta-analyses with the drug as
 * their MeSH major topic. Links out to https://pubmed.ncbi.nlm.nih.gov
 * so callers can jump from a fact to the paper that produced it.
 *
 * Sourced from the NCBI E-utilities (esearch + esummary), free and
 * no-auth, refreshed per-drug via `npm run ingest:literature`. We pin
 * to MeSH-major-topic to keep precision high — a drug's name appearing
 * incidentally in a paper's abstract is not enough.
 */

export const LiteratureReferenceSchema = z.object({
  /** PubMed PMID, the stable canonical identifier. */
  pmid: z.string().regex(/^\d{1,9}$/, "PMID must be 1–9 digits"),
  title: z.string().min(1),
  journal: z.string().min(1),
  /** Year of publication. */
  year: z.number().int().min(1800).max(2200),
  /**
   * First few authors in "LastName Initials" form, as PubMed returns
   * them. Capped at the ingest layer so payloads stay small.
   */
  authors: z.array(z.string()).default([]),
  /** Digital Object Identifier when present in the PubMed record. */
  doi: z.string().optional(),
  /** Pre-built link to the PubMed record so consumers don't have to assemble it. */
  pubmedUrl: z.string().url(),
});
export type LiteratureReference = z.infer<typeof LiteratureReferenceSchema>;

export const DrugLiteratureSchema = z.object({
  drug: SlugSchema,
  references: z.array(LiteratureReferenceSchema),
  provenance: ProvenanceSchema,
});
export type DrugLiterature = z.infer<typeof DrugLiteratureSchema>;
