/**
 * scripts/ingest/fetch-structures.ts
 *
 * Pulls 2D chemical structures for every drug in `SEED_DRUGS` and
 * writes:
 *   - one self-hosted SVG per drug to `public/structures/<slug>.svg`
 *   - a `SEED_STRUCTURES` map keyed by slug to
 *     `lib/data/seed/structures.ts`
 *
 * Source of truth: PubChem (NIH). We resolve drug name → CID, fetch
 * SMILES + InChIKey + IUPACName, render via openchemlib, and
 * post-process the SVG so bonds and atom labels use `currentColor`
 * (so the diagram inherits page foreground in light / dark themes)
 * while preserving chemistry-meaningful colors (N = blue, O = red,
 * halogens, etc.).
 *
 * Idempotent: skips drugs that already have an SVG on disk unless
 * `--force` is passed. Polite to PubChem (200 ms delay between calls,
 * single-flight, no parallel fan-out).
 *
 * Run with: `npm run ingest:structures`
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as OCL from "openchemlib";
import { SEED_DRUGS } from "../../lib/data/seed/drugs";
import {
  ChemicalStructureSchema,
  type ChemicalStructure,
} from "../../lib/schemas/drug";

const STRUCTURES_DIR = join(process.cwd(), "public", "structures");
const STRUCTURES_TS = join(
  process.cwd(),
  "lib",
  "data",
  "seed",
  "structures.ts",
);
const PUBCHEM_DELAY_MS = 200;
const SVG_WIDTH = 320;
const SVG_HEIGHT = 240;

const FORCE = process.argv.includes("--force");

// ────────────────────────────────────────────────────────────── PubChem

interface PubChemProps {
  cid: number;
  smiles: string;
  inchiKey?: string;
  iupacName?: string;
  rawHash: string;
}

async function resolveCid(name: string): Promise<number | null> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`PubChem name resolve failed ${res.status}: ${url}`);
  }
  const json: unknown = await res.json();
  const cid = (json as { IdentifierList?: { CID?: number[] } }).IdentifierList
    ?.CID?.[0];
  return typeof cid === "number" ? cid : null;
}

async function fetchProps(cid: number): Promise<PubChemProps | null> {
  // PubChem renamed CanonicalSMILES → SMILES in 2024; ask for the new
  // name, with the old as fallback in case a mirror lags.
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/SMILES,InChIKey,IUPACName/JSON`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`PubChem property fetch failed ${res.status}: ${url}`);
  }
  const raw = await res.text();
  const json: unknown = JSON.parse(raw);
  const props = (
    json as {
      PropertyTable?: {
        Properties?: Array<{
          SMILES?: string;
          CanonicalSMILES?: string;
          InChIKey?: string;
          IUPACName?: string;
        }>;
      };
    }
  ).PropertyTable?.Properties?.[0];
  const smiles = props?.SMILES ?? props?.CanonicalSMILES;
  if (!smiles) return null;
  return {
    cid,
    smiles,
    inchiKey: props?.InChIKey,
    iupacName: props?.IUPACName,
    rawHash: sha256(raw),
  };
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ────────────────────────────────────────────────────────── SVG render

/**
 * Render a SMILES → SVG via openchemlib and rewrite the SVG so it
 * adapts to the page foreground color (via `currentColor`) without
 * losing chemistry-meaningful coloring of heteroatoms.
 */
function renderSvg(smiles: string, opts: { title: string }): string {
  const mol = OCL.Molecule.fromSmiles(smiles);
  const raw: string = mol.toSVG(SVG_WIDTH, SVG_HEIGHT);
  return postProcess(raw, opts.title);
}

const BLACK_PATTERNS: ReadonlyArray<RegExp> = [
  /stroke="rgb\(0,\s*0,\s*0\)"/g,
  /stroke="#000000"/gi,
  /stroke="#000"/gi,
  /stroke="black"/gi,
];

const BLACK_FILL_PATTERNS: ReadonlyArray<RegExp> = [
  /fill="rgb\(0,\s*0,\s*0\)"/g,
  /fill="#000000"/gi,
  /fill="#000"/gi,
  /fill="black"/gi,
];

function postProcess(svg: string, title: string): string {
  let out = svg;

  // Bonds: black → currentColor so they inherit page foreground.
  for (const re of BLACK_PATTERNS) {
    out = out.replace(re, 'stroke="currentColor"');
  }

  // Atom labels: only carbon and "neutral" labels render with a
  // black-ish fill in OpenChemLib. Heteroatoms (N, O, halogens) and
  // stereo annotations use distinctive RGB colors that we want to
  // keep, so we only swap explicit black fills.
  for (const re of BLACK_FILL_PATTERNS) {
    out = out.replace(re, 'fill="currentColor"');
  }

  // Strip any explicit white / transparent background rect so the SVG
  // lets the page background show through.
  out = out.replace(
    /<rect[^>]*fill="(?:#fff(?:fff)?|white|rgb\(255,\s*255,\s*255\))"[^>]*\/?>(?:<\/rect>)?/gi,
    "",
  );

  // Inject role + accessible <title> right after the opening <svg>.
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  out = out.replace(
    /<svg([^>]*)>/,
    (_match, attrs: string) => {
      const withRole = /\brole=/.test(attrs)
        ? attrs
        : `${attrs} role="img"`;
      return `<svg${withRole}><title>${safeTitle}</title>`;
    },
  );

  return out;
}

// ─────────────────────────────────────────────────────────────── Driver

interface DrugLite {
  slug: string;
  name: string;
}

function shouldSkipSmiles(smiles: string, drug: DrugLite): boolean {
  // Multi-component SMILES (salts, mixtures, combination products) use
  // "." as the component separator. We render single-component
  // molecules only — combination products belong in a future
  // "components" rendering path.
  if (smiles.includes(".")) {
    console.error(
      `  ! ${drug.slug}: SMILES has multiple components (${smiles.slice(
        0,
        60,
      )}…), skipping`,
    );
    return true;
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  if (!existsSync(STRUCTURES_DIR)) {
    mkdirSync(STRUCTURES_DIR, { recursive: true });
  }

  const drugs: DrugLite[] = SEED_DRUGS
    .map((d) => ({ slug: d.slug, name: d.name }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  console.error(
    `[fetch-structures] processing ${drugs.length} drugs (force=${FORCE})`,
  );

  const generated: ChemicalStructure[] = [];
  const skipped: Array<{ slug: string; reason: string }> = [];
  const reused: string[] = [];

  for (const drug of drugs) {
    const svgPath = join(STRUCTURES_DIR, `${drug.slug}.svg`);
    const apiPath = `/structures/${drug.slug}.svg`;

    if (!FORCE && existsSync(svgPath)) {
      console.error(`  · ${drug.slug}: SVG present, skipping fetch`);
      reused.push(drug.slug);
      continue;
    }

    try {
      console.error(`  → ${drug.slug}: resolving via PubChem`);
      const cid = await resolveCid(drug.name);
      await delay(PUBCHEM_DELAY_MS);
      if (cid == null) {
        skipped.push({
          slug: drug.slug,
          reason: "PubChem could not resolve name",
        });
        console.error(`  ! ${drug.slug}: no CID for "${drug.name}", skipping`);
        continue;
      }

      const props = await fetchProps(cid);
      await delay(PUBCHEM_DELAY_MS);
      if (!props) {
        skipped.push({
          slug: drug.slug,
          reason: `CID ${cid} returned no SMILES`,
        });
        console.error(`  ! ${drug.slug}: CID ${cid} returned no SMILES`);
        continue;
      }

      if (shouldSkipSmiles(props.smiles, drug)) {
        skipped.push({
          slug: drug.slug,
          reason: `multi-component SMILES (salt or mixture)`,
        });
        continue;
      }

      const title = props.iupacName ?? drug.name;
      const svg = renderSvg(props.smiles, { title });
      writeFileSync(svgPath, svg, "utf8");

      const sourceUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/SMILES,InChIKey,IUPACName/JSON`;

      const record: ChemicalStructure = {
        smiles: props.smiles,
        inchiKey: props.inchiKey,
        iupacName: props.iupacName,
        pubchemCid: cid,
        structureSvgPath: apiPath,
        provenance: {
          sourceUrl,
          sourceHash: props.rawHash,
          extractedAt: new Date().toISOString(),
          extractor: "pubchem",
          confidence: 0.95,
        },
      };
      ChemicalStructureSchema.parse(record);
      generated.push(record);

      console.error(
        `  ✓ ${drug.slug}: CID ${cid}, ${props.smiles.length} char SMILES`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      skipped.push({ slug: drug.slug, reason: message });
      console.error(`  ! ${drug.slug}: ${message}`);
    }
  }

  // Always re-emit structures.ts so it stays in sync with whatever
  // SVGs are on disk. Re-scan the directory to include reused entries
  // and re-read their cached metadata from the existing structures.ts
  // if present — but the source of truth for *what's written* is the
  // current run, so we merge fresh records with any existing ones we
  // didn't regenerate.
  const merged = await mergeWithExisting(drugs, generated);
  writeStructuresFile(merged);

  console.error(
    `[fetch-structures] done — ${generated.length} fetched, ${reused.length} reused, ${skipped.length} skipped`,
  );
  if (skipped.length > 0) {
    console.error("skipped:");
    for (const s of skipped) console.error(`  - ${s.slug}: ${s.reason}`);
  }
}

async function mergeWithExisting(
  drugs: DrugLite[],
  fresh: ChemicalStructure[],
): Promise<Map<string, ChemicalStructure>> {
  const merged = new Map<string, ChemicalStructure>();

  // Bring forward existing entries that we didn't regenerate this run.
  if (existsSync(STRUCTURES_TS)) {
    try {
      const mod = (await import(pathToImport(STRUCTURES_TS))) as {
        SEED_STRUCTURES?: Record<string, ChemicalStructure>;
      };
      const existing = mod.SEED_STRUCTURES ?? {};
      for (const slug of Object.keys(existing)) {
        const entry = existing[slug];
        const result = ChemicalStructureSchema.safeParse(entry);
        if (result.success) merged.set(slug, result.data);
      }
    } catch {
      // first run, or existing file is malformed — ignore.
    }
  }

  for (const record of fresh) {
    const slug = svgPathToSlug(record.structureSvgPath);
    merged.set(slug, record);
  }

  // Drop entries for drugs whose SVG is no longer on disk.
  const onDisk = new Set(
    drugs
      .filter((d) => existsSync(join(STRUCTURES_DIR, `${d.slug}.svg`)))
      .map((d) => d.slug),
  );
  for (const slug of [...merged.keys()]) {
    if (!onDisk.has(slug)) merged.delete(slug);
  }

  return merged;
}

function svgPathToSlug(p: string): string {
  const m = p.match(/^\/structures\/([a-z0-9-]+)\.svg$/);
  if (!m) throw new Error(`unexpected structureSvgPath ${p}`);
  return m[1];
}

function pathToImport(absPath: string): string {
  // tsx supports importing TS modules directly via file:// URLs.
  const normalized = absPath.replace(/\\/g, "/");
  return `file:///${normalized}`;
}

function writeStructuresFile(records: Map<string, ChemicalStructure>): void {
  const sorted = [...records.entries()].sort(([a], [b]) => a.localeCompare(b));
  const body = sorted
    .map(([slug, record]) => `  "${slug}": ${formatRecord(record)},`)
    .join("\n");

  const file = `// AUTO-GENERATED by scripts/ingest/fetch-structures.ts
// Source: PubChem (NIH) — see provenance.sourceUrl on each record.
// Do not edit by hand; re-run \`npm run ingest:structures\` to refresh.

import type { ChemicalStructure } from "@/lib/schemas";

export const SEED_STRUCTURES: Record<string, ChemicalStructure> = {
${body}
};

export function getSeedStructure(slug: string): ChemicalStructure | null {
  return SEED_STRUCTURES[slug] ?? null;
}
`;
  writeFileSync(STRUCTURES_TS, file, "utf8");
  console.error(
    `[fetch-structures] wrote ${sorted.length} entries to ${STRUCTURES_TS}`,
  );
}

function formatRecord(r: ChemicalStructure): string {
  const parts: string[] = [];
  parts.push(`    smiles: ${jsonString(r.smiles)}`);
  if (r.inchiKey) parts.push(`    inchiKey: ${jsonString(r.inchiKey)}`);
  if (r.iupacName) parts.push(`    iupacName: ${jsonString(r.iupacName)}`);
  if (r.pubchemCid != null) parts.push(`    pubchemCid: ${r.pubchemCid}`);
  parts.push(`    structureSvgPath: ${jsonString(r.structureSvgPath)}`);
  parts.push(
    `    provenance: {
      sourceUrl: ${jsonString(r.provenance.sourceUrl)},
      sourceHash: ${jsonString(r.provenance.sourceHash)},
      extractedAt: ${jsonString(r.provenance.extractedAt)},
      extractor: ${jsonString(r.provenance.extractor)},
      confidence: ${r.provenance.confidence},
    }`,
  );
  return `{\n${parts.join(",\n")},\n  }`;
}

function jsonString(s: string): string {
  return JSON.stringify(s);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
