import { z } from "zod";
import { SlugSchema } from "./shared";

/**
 * A single record-level change event in the pharmacopeia dataset.
 *
 * Each entry is what a consumer would want to see in an RSS/JSON feed:
 * what changed, on which entity, when, why, and where the canonical
 * source for the change lives. Curators add an entry whenever an
 * ingestion script lands, a new entity type appears, or a notable
 * batch is refreshed.
 *
 * `id` is a stable, slug-like identifier (e.g.
 * `2026-05-28-structures-pubchem`) used as the RSS `<guid>` and the
 * JSON Feed `id` so consumers de-duplicate cleanly across polls.
 */

export const ChangelogKindSchema = z.enum([
  "drug",
  "class",
  "ingredient",
  "interaction",
  "structure",
  "dataset",
  "endpoint",
]);
export type ChangelogKind = z.infer<typeof ChangelogKindSchema>;

export const ChangelogActionSchema = z.enum([
  "added",
  "updated",
  "removed",
  "released",
]);
export type ChangelogAction = z.infer<typeof ChangelogActionSchema>;

export const ChangelogEntrySchema = z.object({
  id: SlugSchema,
  kind: ChangelogKindSchema,
  action: ChangelogActionSchema,
  /** Slug of the affected entity, when one applies. */
  entitySlug: SlugSchema.optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  /** ISO-8601 timestamp at which the change was published. */
  timestamp: z.string().datetime(),
  /** Site-relative path the entry links to (e.g. `/drugs/metformin`). */
  url: z.string().regex(/^\/[a-z0-9/_#?=&.-]*$/i),
  /** Canonical upstream URLs that justify the change, if any. */
  sources: z.array(z.string().url()).default([]),
  /** Optional categorisation tags surfaced in the feed. */
  tags: z.array(z.string()).default([]),
});
export type ChangelogEntry = z.infer<typeof ChangelogEntrySchema>;
