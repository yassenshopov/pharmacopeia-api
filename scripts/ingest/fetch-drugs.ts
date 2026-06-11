/**
 * scripts/ingest/fetch-drugs.ts
 *
 * Stage-0 ingest. Builds the static seed dataset from two free,
 * no-auth-required public sources:
 *
 *  1. RxNav (NIH)   https://rxnav.nlm.nih.gov/REST/
 *     Authoritative IDs, brand names, ingredients, ATC + EPC + MOA classes.
 *  2. openFDA       https://api.fda.gov/drug/label.json
 *     FDA-labeled narrative text for mechanism, indications,
 *     contraindications, pharmacokinetics, boxed warnings, dosage,
 *     adverse reactions, warnings, special populations, overdosage,
 *     plus NDC + UNII identifiers.
 *  3. openFDA       https://api.fda.gov/drug/drugsfda.json
 *     Original approval history (application number, type, date, sponsor).
 *
 * The script is idempotent: deterministic timestamps, sorted output,
 * stable hashing. Re-running it produces byte-identical files unless
 * an upstream source changed.
 *
 * Run:   npm run ingest
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrugClassSchema,
  DrugSchema,
  IngredientSchema,
  type Drug,
  type DrugClass,
  type DrugClassKind,
  type DrugClassRef,
  type Ingredient,
  type Provenance,
} from "../../lib/schemas";

// ────────────────────────────────────────────────────────────────────────
// Paths and constants
// ────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const OUT_DIR = resolve(REPO_ROOT, "lib/data/seed");

// Deterministic fixed timestamp so re-runs do not diff just because of clock.
const EXTRACTED_AT = "2026-05-28T00:00:00.000Z";

/**
 * Curated list of widely-prescribed and clinically-significant US
 * medications, organised by therapeutic area for browsability.
 *
 * Targets ~300 valid records; a handful will be dropped at ingest time
 * if RxNav cannot resolve the name to a mono-substance RxCUI or
 * openFDA does not return a clean label. Each name resolves to a
 * single active ingredient — combination products are deliberately
 * out of scope for v0 (the ingest pipeline rejects them).
 *
 * Adding a drug here:
 *   1. Append to the relevant therapeutic group (or open a new one).
 *   2. Use the canonical generic name as a single token where possible
 *      ("ramipril", not "ramipril 5 mg"). Multi-word names like
 *      "insulin glargine" are fine — the script slugifies them.
 *   3. Avoid combination products (FDA labels these as
 *      "X AND Y") — they will be skipped by the openFDA mono-match.
 *   4. Re-run `npm run ingest` and then `npm run ingest:structures`
 *      to backfill the PubChem 2D diagram for the new entries.
 */
const DRUG_NAMES: ReadonlyArray<string> = [
  // ── Analgesics, antipyretics, NSAIDs ─────────────────────────────
  "acetaminophen",
  "aspirin",
  "celecoxib",
  "diclofenac",
  "etodolac",
  "ibuprofen",
  "indomethacin",
  "ketoprofen",
  "ketorolac",
  "meloxicam",
  "nabumetone",
  "naproxen",
  "piroxicam",

  // ── Opioid analgesics ────────────────────────────────────────────
  "buprenorphine",
  "codeine",
  "fentanyl",
  "hydrocodone",
  "hydromorphone",
  "methadone",
  "morphine",
  "naloxone",
  "naltrexone",
  "oxycodone",
  "oxymorphone",
  "tapentadol",
  "tramadol",

  // ── Anticonvulsants / mood stabilisers ──────────────────────────
  "carbamazepine",
  "ethosuximide",
  "gabapentin",
  "lacosamide",
  "lamotrigine",
  "levetiracetam",
  "oxcarbazepine",
  "phenobarbital",
  "phenytoin",
  "pregabalin",
  "topiramate",
  "valproic acid",
  "zonisamide",

  // ── Antidepressants ──────────────────────────────────────────────
  "amitriptyline",
  "bupropion",
  "citalopram",
  "desvenlafaxine",
  "doxepin",
  "duloxetine",
  "escitalopram",
  "fluoxetine",
  "fluvoxamine",
  "mirtazapine",
  "nortriptyline",
  "paroxetine",
  "selegiline",
  "sertraline",
  "trazodone",
  "venlafaxine",
  "vortioxetine",

  // ── Anxiolytics, sedatives, hypnotics ───────────────────────────
  "alprazolam",
  "buspirone",
  "chlordiazepoxide",
  "clonazepam",
  "diazepam",
  "eszopiclone",
  "lorazepam",
  "oxazepam",
  "ramelteon",
  "temazepam",
  "zolpidem",

  // ── Antipsychotics & lithium ────────────────────────────────────
  "aripiprazole",
  "chlorpromazine",
  "clozapine",
  "haloperidol",
  "lithium",
  "lurasidone",
  "olanzapine",
  "paliperidone",
  "quetiapine",
  "risperidone",
  "ziprasidone",

  // ── ADHD & stimulants ───────────────────────────────────────────
  "atomoxetine",
  "lisdexamfetamine",
  "methylphenidate",
  "modafinil",

  // ── Antimigraine ────────────────────────────────────────────────
  "rizatriptan",
  "sumatriptan",
  "zolmitriptan",

  // ── Antiparkinsonian / neurology ────────────────────────────────
  "amantadine",
  "donepezil",
  "galantamine",
  "levodopa",
  "memantine",
  "pramipexole",
  "rivastigmine",
  "ropinirole",

  // ── Muscle relaxants ────────────────────────────────────────────
  "baclofen",
  "carisoprodol",
  "cyclobenzaprine",
  "metaxalone",
  "methocarbamol",
  "orphenadrine",
  "tizanidine",

  // ── Antihypertensives — ACE inhibitors / ARBs ───────────────────
  "benazepril",
  "candesartan",
  "captopril",
  "enalapril",
  "fosinopril",
  "irbesartan",
  "lisinopril",
  "losartan",
  "olmesartan",
  "quinapril",
  "ramipril",
  "telmisartan",
  "valsartan",

  // ── Antihypertensives — beta blockers ───────────────────────────
  "atenolol",
  "betaxolol",
  "bisoprolol",
  "carvedilol",
  "labetalol",
  "metoprolol",
  "nadolol",
  "nebivolol",
  "propranolol",
  "sotalol",

  // ── Antihypertensives — calcium channel blockers ────────────────
  "amlodipine",
  "diltiazem",
  "felodipine",
  "nicardipine",
  "nifedipine",
  "verapamil",

  // ── Antihypertensives — diuretics, other ────────────────────────
  "bumetanide",
  "chlorthalidone",
  "clonidine",
  "doxazosin",
  "furosemide",
  "hydrochlorothiazide",
  "indapamide",
  "prazosin",
  "spironolactone",
  "terazosin",
  "torsemide",
  "triamterene",

  // ── Cardiac (rhythm, heart failure, antianginal) ────────────────
  "amiodarone",
  "digoxin",
  "flecainide",
  "isosorbide mononitrate",
  "propafenone",
  "ranolazine",

  // ── Lipid lowering ──────────────────────────────────────────────
  "atorvastatin",
  "ezetimibe",
  "fenofibrate",
  "fluvastatin",
  "gemfibrozil",
  "lovastatin",
  "niacin",
  "pitavastatin",
  "pravastatin",
  "rosuvastatin",
  "simvastatin",

  // ── Anticoagulants & antiplatelets ──────────────────────────────
  "apixaban",
  "cilostazol",
  "clopidogrel",
  "dabigatran",
  "edoxaban",
  "enoxaparin",
  "prasugrel",
  "rivaroxaban",
  "ticagrelor",
  "warfarin",

  // ── Antidiabetic ─────────────────────────────────────────────────
  "canagliflozin",
  "dapagliflozin",
  "dulaglutide",
  "empagliflozin",
  "glimepiride",
  "glipizide",
  "glyburide",
  "insulin glargine",
  "insulin lispro",
  "linagliptin",
  "liraglutide",
  "metformin",
  "pioglitazone",
  "repaglinide",
  "saxagliptin",
  "semaglutide",
  "sitagliptin",

  // ── Thyroid & hormones ──────────────────────────────────────────
  "desmopressin",
  "estradiol",
  "levothyroxine",
  "liothyronine",
  "methimazole",
  "propylthiouracil",
  "testosterone",

  // ── Bone & gout ─────────────────────────────────────────────────
  "alendronate",
  "allopurinol",
  "colchicine",
  "febuxostat",
  "ibandronate",
  "raloxifene",
  "risedronate",
  "zoledronic acid",

  // ── BPH / urology ───────────────────────────────────────────────
  "alfuzosin",
  "dutasteride",
  "finasteride",
  "mirabegron",
  "oxybutynin",
  "solifenacin",
  "tamsulosin",
  "tolterodine",

  // ── Antibiotics ─────────────────────────────────────────────────
  "amoxicillin",
  "ampicillin",
  "azithromycin",
  "cefdinir",
  "ceftriaxone",
  "cefuroxime",
  "cephalexin",
  "ciprofloxacin",
  "clarithromycin",
  "clindamycin",
  "doxycycline",
  "erythromycin",
  "levofloxacin",
  "linezolid",
  "metronidazole",
  "minocycline",
  "moxifloxacin",
  "nitrofurantoin",
  "trimethoprim",
  "vancomycin",

  // ── Antifungals & antivirals ────────────────────────────────────
  "acyclovir",
  "dolutegravir",
  "fluconazole",
  "itraconazole",
  "ketoconazole",
  "oseltamivir",
  "tenofovir",
  "terbinafine",
  "valacyclovir",
  "valganciclovir",
  "voriconazole",

  // ── GI: acid, motility, IBD ─────────────────────────────────────
  "dicyclomine",
  "esomeprazole",
  "famotidine",
  "lansoprazole",
  "linaclotide",
  "loperamide",
  "mesalamine",
  "metoclopramide",
  "omeprazole",
  "ondansetron",
  "pantoprazole",
  "prochlorperazine",
  "promethazine",
  "rifaximin",
  "sucralfate",

  // ── Allergy / antihistamines ────────────────────────────────────
  "cetirizine",
  "chlorpheniramine",
  "desloratadine",
  "diphenhydramine",
  "fexofenadine",
  "hydroxyzine",
  "levocetirizine",
  "loratadine",
  "meclizine",

  // ── Respiratory: asthma, COPD ───────────────────────────────────
  "albuterol",
  "beclomethasone",
  "budesonide",
  "fluticasone",
  "formoterol",
  "ipratropium",
  "mometasone",
  "montelukast",
  "roflumilast",
  "salmeterol",
  "theophylline",
  "tiotropium",

  // ── Corticosteroids (systemic) ──────────────────────────────────
  "dexamethasone",
  "hydrocortisone",
  "methylprednisolone",
  "prednisolone",
  "prednisone",
  "triamcinolone",

  // ── Immunosuppressants & DMARDs ─────────────────────────────────
  "azathioprine",
  "hydroxychloroquine",
  "leflunomide",
  "methotrexate",
  "mycophenolate",
  "sulfasalazine",

  // ── Dermatology ─────────────────────────────────────────────────
  "isotretinoin",
  "mupirocin",
  "tacrolimus",
  "tretinoin",

  // ── Ophthalmic ──────────────────────────────────────────────────
  "brimonidine",
  "dorzolamide",
  "latanoprost",
  "timolol",
  "travoprost",

  // ── Oncology endocrine ──────────────────────────────────────────
  "anastrozole",
  "bicalutamide",
  "exemestane",
  "letrozole",
  "tamoxifen",

  // ── ED / pulmonary hypertension ─────────────────────────────────
  "sildenafil",
  "tadalafil",
  "vardenafil",

  // ── Antiemetics (oncology / vestibular) ─────────────────────────
  "aprepitant",
  "granisetron",

  // ── Hematinics & supplements ────────────────────────────────────
  "cyanocobalamin",
  "ferrous sulfate",
  "folic acid",

  // ── Smoking cessation ───────────────────────────────────────────
  "varenicline",
];

// ────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['"\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Strip leading section headers ("12.1 MECHANISM OF ACTION", "1 INDICATIONS
 * AND USAGE", etc.) and collapse whitespace. openFDA labels often prefix the
 * narrative with these markers.
 */
function cleanLabelText(text: string): string {
  return text
    .replace(/^\s*\d+(\.\d+)*\s+/i, "")
    .replace(
      /^\s*(MECHANISM OF ACTION|INDICATIONS AND USAGE|INDICATIONS|CONTRAINDICATIONS?|PHARMACOKINETICS|CLINICAL PHARMACOLOGY|DOSAGE AND ADMINISTRATION|ADVERSE REACTIONS|WARNINGS AND PRECAUTIONS|WARNINGS AND CAUTIONS|WARNINGS|PRECAUTIONS|USE IN SPECIFIC POPULATIONS|OVERDOSAGE|BOXED WARNING|WARNING:?)[:\s]+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean and hard-cap a label section to `maxLen`, snapping to the last
 * sentence boundary so excerpts don't end mid-word. Unlike
 * `firstSentences`, this keeps as much text as fits — used for the
 * richer reference sections (dosage, adverse reactions, warnings) where
 * a two-sentence summary would be uselessly short.
 */
function clip(text: string, maxLen: number): string {
  const cleaned = cleanLabelText(text);
  if (!cleaned) return cleaned;
  if (cleaned.length <= maxLen) return cleaned;
  const hardCut = cleaned.slice(0, maxLen);
  const lastPeriod = hardCut.lastIndexOf(". ");
  return (
    lastPeriod > maxLen * 0.5 ? hardCut.slice(0, lastPeriod + 1) : `${hardCut}…`
  ).trim();
}

/**
 * Returns the first 1-2 sentences of `text`, never exceeding `maxLen`. Used to
 * derive a brief `summary` from openFDA's frequently-verbose narrative blocks.
 */
function firstSentences(text: string, maxLen = 1500): string {
  const cleaned = cleanLabelText(text);
  if (!cleaned) return cleaned;

  const sentenceRe = /[.!?](\s+|$)/g;
  let count = 0;
  let endIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(cleaned)) !== null) {
    count++;
    endIdx = m.index + 1;
    if (count >= 2) break;
  }
  if (endIdx > 0 && endIdx <= maxLen) return cleaned.slice(0, endIdx).trim();
  if (cleaned.length <= maxLen) return cleaned;
  // Hard cap fallback.
  const hardCut = cleaned.slice(0, maxLen);
  const lastPeriod = hardCut.lastIndexOf(". ");
  return (lastPeriod > 200 ? hardCut.slice(0, lastPeriod + 1) : hardCut + "…").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string, retries = 3): Promise<any> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "pharmacopeia-ingest/1.0 (+local dev)" },
      });
      if (res.status === 404) return null;
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error(`fetch failed: ${url}`);
}

function makeProv(
  sourceUrl: string,
  responseForHash: unknown,
  extractor: Provenance["extractor"],
  confidence: number,
): Provenance {
  const hashBasis =
    typeof responseForHash === "string"
      ? responseForHash
      : JSON.stringify(responseForHash ?? sourceUrl);
  return {
    sourceUrl,
    sourceHash: sha256(hashBasis).slice(0, 64),
    extractedAt: EXTRACTED_AT,
    extractor,
    confidence,
  };
}

// ────────────────────────────────────────────────────────────────────────
// RxNav lookups
// ────────────────────────────────────────────────────────────────────────

interface RxNavSummary {
  rxcui: string;
  name: string;
  synonyms: string[];
  brands: string[];
  classRefs: DrugClassRef[];
  classRecords: DrugClass[];
  atcCodes: string[];
}

async function fetchRxNavSummary(name: string): Promise<RxNavSummary | null> {
  const idUrl = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=2`;
  const idResp = await fetchJson(idUrl);
  const rxcui: string | undefined = idResp?.idGroup?.rxnormId?.[0];
  if (!rxcui) return null;

  const propsUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
  const propsResp = await fetchJson(propsUrl);
  const props = propsResp?.properties;
  if (!props) return null;
  const canonicalName = titleCase(props.name ?? name);
  const synonyms = props.synonym ? [props.synonym] : [];

  // brand names containing this ingredient
  const brandsUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=BN`;
  const brandsResp = await fetchJson(brandsUrl);
  const brandGroups = brandsResp?.relatedGroup?.conceptGroup ?? [];
  const brandSet = new Set<string>();
  for (const g of brandGroups) {
    if (g.tty !== "BN") continue;
    for (const c of g.conceptProperties ?? []) {
      if (c?.name) brandSet.add(c.name);
    }
  }
  const brands = Array.from(brandSet).sort();

  // classes
  const classUrl = `https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json?rxcui=${rxcui}`;
  const classResp = await fetchJson(classUrl);
  const classList = classResp?.rxclassDrugInfoList?.rxclassDrugInfo ?? [];

  const classRefs: DrugClassRef[] = [];
  const classRecords: DrugClass[] = [];
  const seenRefs = new Set<string>();

  for (const item of classList) {
    const min = item?.minConcept;
    // only look at the ingredient (IN) row to avoid combination-product noise
    if (!min || (min.tty !== "IN" && min.tty !== "PIN")) continue;
    if (min.rxcui !== rxcui) continue;

    const concept = item?.rxclassMinConceptItem;
    if (!concept?.classId || !concept?.className) continue;

    const classType: string = concept.classType ?? "";
    const kind = mapClassType(classType);
    if (!kind) continue;

    const slug = slugify(concept.className);
    if (!slug) continue;

    const key = `${kind}:${slug}`;
    if (seenRefs.has(key)) continue;
    seenRefs.add(key);

    classRefs.push({
      slug,
      name: concept.className,
      kind,
      code: concept.classId,
    });

    const classProv = makeProv(
      `https://rxnav.nlm.nih.gov/REST/rxclass/class/byId.json?classId=${concept.classId}`,
      { classId: concept.classId, className: concept.className, kind },
      "rxclass",
      0.95,
    );

    classRecords.push({
      slug,
      name: concept.className,
      kind,
      code: concept.classId,
      parent: null,
      drugCount: 0,
      provenance: classProv,
    });
  }

  classRefs.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));
  classRecords.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));

  const atcCodes = Array.from(
    new Set(
      classRefs
        .filter((c) => c.kind === "atc" && c.code)
        .map((c) => c.code as string),
    ),
  ).sort();

  return {
    rxcui,
    name: canonicalName,
    synonyms,
    brands,
    classRefs,
    classRecords,
    atcCodes,
  };
}

function mapClassType(classType: string): DrugClassKind | null {
  switch (classType) {
    case "ATC1-4":
    case "ATC":
      return "atc";
    case "EPC":
      return "epc";
    case "MOA":
      return "moa";
    case "PE":
      return "pe";
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────────────
// openFDA label lookup
// ────────────────────────────────────────────────────────────────────────

interface OpenFdaLabel {
  url: string;
  raw: any;
}

async function fetchOpenFdaLabel(name: string): Promise<OpenFdaLabel | null> {
  // Fetch up to 50 candidate labels and pick the first one whose generic_name
  // is mono-substance. Combination products (e.g. "SITAGLIPTIN AND METFORMIN
  // HYDROCHLORIDE") are rejected so we get the FDA label for the single drug.
  const search = `openfda.generic_name:%22${encodeURIComponent(name)}%22`;
  const url = `https://api.fda.gov/drug/label.json?search=${search}&limit=50`;
  const resp = await fetchJson(url);
  const results: any[] = resp?.results ?? [];
  if (!results.length) return null;

  const upper = name.toUpperCase();
  const SALT_SUFFIXES = [
    "HYDROCHLORIDE",
    "HCL",
    "SODIUM",
    "POTASSIUM",
    "CALCIUM",
    "SULFATE",
    "SUCCINATE",
    "TARTRATE",
    "MALEATE",
    "FUMARATE",
    "CITRATE",
    "PHOSPHATE",
    "BESYLATE",
    "MESYLATE",
    "ACETATE",
    "BROMIDE",
    "CHLORIDE",
    "BITARTRATE",
  ];

  function isMonoMatch(gnList: string[]): boolean {
    if (gnList.length !== 1) return false;
    const single = (gnList[0] ?? "").toUpperCase().trim();
    if (!single) return false;
    // reject anything that smells like a combination product
    if (/\bAND\b|\bWITH\b|[,/;+]/.test(single)) return false;
    if (single === upper) return true;
    // allow "<NAME> HYDROCHLORIDE", "<NAME> SODIUM" etc.
    const tokens = single.split(/\s+/);
    if (tokens.length === 1 && tokens[0] === upper) return true;
    if (tokens.length === 2 && tokens[0] === upper && SALT_SUFFIXES.includes(tokens[1]))
      return true;
    // some ingredients are themselves multi-word (e.g. "FLUTICASONE PROPIONATE")
    if (tokens[0] === upper && tokens.slice(1).every((t) => SALT_SUFFIXES.includes(t)))
      return true;
    return false;
  }

  const monoMatch = results.find((r) =>
    isMonoMatch(r?.openfda?.generic_name ?? []),
  );

  if (!monoMatch) {
    // fall back to the first result whose generic_name contains the search term
    const loose = results.find((r) => {
      const gn: string[] = r?.openfda?.generic_name ?? [];
      return gn.some((g) => (g ?? "").toUpperCase().includes(upper));
    });
    if (!loose) return null;
    return { url, raw: loose };
  }
  return { url, raw: monoMatch };
}

// ────────────────────────────────────────────────────────────────────────
// openFDA drugsfda approval history
// ────────────────────────────────────────────────────────────────────────

interface ApprovalEntry {
  date: string; // YYYY-MM-DD
  applicationNumber: string;
  type: "NDA" | "ANDA" | "BLA" | "OTC";
  sponsor?: string;
}

function applicationType(appNo: string): ApprovalEntry["type"] | null {
  const up = appNo.toUpperCase();
  if (up.startsWith("NDA")) return "NDA";
  if (up.startsWith("ANDA")) return "ANDA";
  if (up.startsWith("BLA")) return "BLA";
  if (up.startsWith("OTC")) return "OTC";
  return null;
}

function fdaDateToIso(yyyymmdd: string): string | null {
  if (!/^\d{8}$/.test(yyyymmdd)) return null;
  const iso = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : iso;
}

/**
 * Pull original-approval records from openFDA's drugsfda endpoint. We
 * keep one entry per application (the original "ORIG/1" approval), tag
 * it by application type, and cap the list so a generic with hundreds of
 * ANDAs doesn't bloat the record. NDA/BLA originals are prioritised over
 * generic ANDAs since they carry the more interesting approval dates.
 */
async function fetchApprovalHistory(name: string): Promise<ApprovalEntry[]> {
  const search = `openfda.generic_name:%22${encodeURIComponent(name)}%22`;
  const url = `https://api.fda.gov/drug/drugsfda.json?search=${search}&limit=100`;
  const resp = await fetchJson(url).catch(() => null);
  const results: any[] = resp?.results ?? [];
  if (!results.length) return [];

  const entries: ApprovalEntry[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    const appNo: string | undefined = r?.application_number;
    if (!appNo || seen.has(appNo)) continue;
    const type = applicationType(appNo);
    if (!type) continue;

    const submissions: any[] = r?.submissions ?? [];
    const orig = submissions.find(
      (s) =>
        (s?.submission_type ?? "").toUpperCase() === "ORIG" &&
        String(s?.submission_number ?? "") === "1" &&
        (s?.submission_status ?? "").toUpperCase() === "AP",
    );
    const iso = orig?.submission_status_date
      ? fdaDateToIso(String(orig.submission_status_date))
      : null;
    if (!iso) continue;

    seen.add(appNo);
    const sponsor: string | undefined = r?.sponsor_name
      ? titleCase(String(r.sponsor_name))
      : undefined;
    entries.push({ date: iso, applicationNumber: appNo, type, sponsor });
  }

  // Prioritise innovator applications, then oldest-first within the cap.
  const rank: Record<ApprovalEntry["type"], number> = {
    BLA: 0,
    NDA: 1,
    OTC: 2,
    ANDA: 3,
  };
  entries.sort(
    (a, b) => rank[a.type] - rank[b.type] || a.date.localeCompare(b.date),
  );
  const capped = entries.slice(0, 8);
  // Present chronologically for the UI.
  capped.sort((a, b) => a.date.localeCompare(b.date));
  return capped;
}

// ────────────────────────────────────────────────────────────────────────
// Mechanism targets (derived from MOA class names)
// ────────────────────────────────────────────────────────────────────────

const MOA_SUFFIXES = [
  "inhibitors",
  "inhibitor",
  "agonists",
  "agonist",
  "antagonists",
  "antagonist",
  "blockers",
  "blocker",
  "modulators",
  "modulator",
  "activators",
  "activator",
  "stimulants",
  "stimulant",
  "agents",
  "agent",
  "reuptake inhibitors",
];

/**
 * Derive plausible molecular/process targets from a drug's MOA-kind
 * RxClass names by stripping the trailing mechanism word. E.g.
 * "HMG-CoA Reductase Inhibitors" → "HMG-CoA Reductase". Conservative:
 * a class only contributes a target when it ends in a known mechanism
 * suffix, so we don't emit garbage.
 */
function deriveTargets(moaClassNames: string[]): string[] {
  const targets = new Set<string>();
  for (const raw of moaClassNames) {
    const name = raw.trim();
    const lower = name.toLowerCase();
    const suffix = MOA_SUFFIXES.find((s) => lower.endsWith(` ${s}`));
    if (!suffix) continue;
    const stripped = name.slice(0, name.length - suffix.length).trim();
    if (stripped.length >= 3) targets.add(stripped);
  }
  return Array.from(targets).sort();
}

// ────────────────────────────────────────────────────────────────────────
// Per-drug ingest
// ────────────────────────────────────────────────────────────────────────

interface IngestOk {
  ok: true;
  drug: Drug;
  ingredient: Ingredient;
  classes: DrugClass[];
  coverage: CoverageBits;
}
interface IngestFail {
  ok: false;
  reason: string;
}
type IngestResult = IngestOk | IngestFail;

interface CoverageBits {
  mechanism: boolean;
  targets: boolean;
  indications: boolean;
  contraindications: boolean;
  pharmacokinetics: boolean;
  boxedWarning: boolean;
  dosageNarrative: boolean;
  adverseReactions: boolean;
  approvalHistory: boolean;
  atc: boolean;
  brands: boolean;
  label: boolean;
}

async function ingestOne(name: string, idx: number, total: number): Promise<IngestResult> {
  const slug = slugify(name);
  const tag = `[${idx + 1}/${total}] ${slug}`;
  process.stderr.write(`${tag}: resolving RxCUI...\n`);

  const rx = await fetchRxNavSummary(name);
  if (!rx) {
    process.stderr.write(`${tag}: ✗ no RxNav result, skipping\n`);
    return { ok: false, reason: "no-rxcui" };
  }

  const label = await fetchOpenFdaLabel(name).catch((e) => {
    process.stderr.write(`${tag}: ! openFDA error (${(e as Error).message}); continuing without label\n`);
    return null;
  });

  // narrative fields
  const mechRaw: string | undefined = label?.raw?.mechanism_of_action?.[0];
  const indRaw: string | undefined = label?.raw?.indications_and_usage?.[0];
  const ciRaw: string | undefined = label?.raw?.contraindications?.[0];
  const pkRaw: string | undefined = label?.raw?.pharmacokinetics?.[0];

  // targets + a fallback summary derived from the drug's MOA-kind classes.
  // When openFDA has no mechanism_of_action narrative we fall back to a
  // classification-style summary so the derived targets aren't wasted.
  const moaClassNames = rx.classRefs
    .filter((c) => c.kind === "moa")
    .map((c) => c.name);
  const moaTargets = deriveTargets(moaClassNames);

  const mechanism = mechRaw
    ? { summary: firstSentences(mechRaw, 1500), targets: moaTargets }
    : moaClassNames.length > 0
      ? {
          summary: `Mechanism-of-action class${moaClassNames.length > 1 ? "es" : ""}: ${moaClassNames.join("; ")}.`,
          targets: moaTargets,
        }
      : undefined;
  const indications = indRaw
    ? [{ text: firstSentences(indRaw, 1200), icd10: [] as string[], snomed: [] as string[] }]
    : [];
  const contraindications = ciRaw
    ? [{ text: firstSentences(ciRaw, 1200), severity: "contraindicated" as const }]
    : [];
  const pharmacokinetics = pkRaw ? { metabolism: firstSentences(pkRaw, 600) } : undefined;

  // Verbatim FDA label narrative sections (reference excerpts).
  const boxedRaw: string | undefined = label?.raw?.boxed_warning?.[0];
  const dosageRaw: string | undefined = label?.raw?.dosage_and_administration?.[0];
  const warningsRaw: string | undefined =
    label?.raw?.warnings_and_cautions?.[0] ?? label?.raw?.warnings?.[0];
  const adverseRaw: string | undefined = label?.raw?.adverse_reactions?.[0];
  const populationsRaw: string | undefined =
    label?.raw?.use_in_specific_populations?.[0] ?? label?.raw?.pregnancy?.[0];
  const overdoseRaw: string | undefined = label?.raw?.overdosage?.[0];

  const labelSections = {
    boxedWarning: boxedRaw ? clip(boxedRaw, 1400) : undefined,
    dosageAndAdministration: dosageRaw ? clip(dosageRaw, 1600) : undefined,
    warningsAndPrecautions: warningsRaw ? clip(warningsRaw, 1600) : undefined,
    adverseReactions: adverseRaw ? clip(adverseRaw, 1600) : undefined,
    useInSpecificPopulations: populationsRaw ? clip(populationsRaw, 1400) : undefined,
    overdosage: overdoseRaw ? clip(overdoseRaw, 1200) : undefined,
  };
  const hasLabelSections = Object.values(labelSections).some(Boolean);

  // openFDA identifier block (NDC list + UNII)
  const ndc = Array.from(
    new Set<string>((label?.raw?.openfda?.product_ndc ?? []) as string[]),
  )
    .sort()
    .slice(0, 8);
  const unii: string | undefined = label?.raw?.openfda?.unii?.[0];

  // Approval history from openFDA drugsfda (one extra call, free + no auth).
  const approvalHistory = await fetchApprovalHistory(name).catch(() => []);

  // ingredient (1:1 with drug for v0)
  const ingredientProv = makeProv(
    `https://rxnav.nlm.nih.gov/REST/rxcui/${rx.rxcui}/properties.json`,
    { rxcui: rx.rxcui, name: rx.name },
    "rxnorm",
    0.95,
  );
  const ingredient: Ingredient = {
    slug,
    name: rx.name,
    synonyms: rx.synonyms.filter((s) => s.length > 0).sort(),
    rxcui: rx.rxcui,
    drugCount: 1,
    provenance: ingredientProv,
  };

  // drug provenance: openFDA when label found, else RxNav
  const drugProv: Provenance = label
    ? {
        sourceUrl: label.url,
        sourceHash: sha256(JSON.stringify(label.raw)).slice(0, 64),
        extractedAt: EXTRACTED_AT,
        extractor: "openfda",
        confidence: 0.85,
      }
    : {
        sourceUrl: `https://rxnav.nlm.nih.gov/REST/rxcui/${rx.rxcui}/properties.json`,
        sourceHash: sha256(`rxnav:${rx.rxcui}:${rx.name}`).slice(0, 64),
        extractedAt: EXTRACTED_AT,
        extractor: "rxnorm",
        confidence: 0.95,
      };

  const drug: Drug = {
    slug,
    name: rx.name,
    synonyms: rx.synonyms.filter((s) => s.length > 0).sort(),
    jurisdiction: "US-FDA",
    ingredients: [{ slug, name: rx.name }],
    brands: rx.brands.slice(0, 12),
    classes: rx.classRefs,
    mechanism,
    indications,
    contraindications,
    dosing: [],
    pharmacokinetics,
    approvalHistory,
    labelSections: hasLabelSections ? labelSections : undefined,
    identifiers: {
      rxcui: rx.rxcui,
      ndc,
      atc: rx.atcCodes,
      unii,
    },
    provenance: drugProv,
  };

  try {
    DrugSchema.parse(drug);
    IngredientSchema.parse(ingredient);
    rx.classRecords.forEach((c) => DrugClassSchema.parse(c));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`${tag}: ✗ schema validation failed: ${msg}\n`);
    return { ok: false, reason: "schema-fail" };
  }

  const coverage: CoverageBits = {
    mechanism: !!mechanism,
    targets: moaTargets.length > 0,
    indications: indications.length > 0,
    contraindications: contraindications.length > 0,
    pharmacokinetics: !!pharmacokinetics,
    boxedWarning: !!labelSections.boxedWarning,
    dosageNarrative: !!labelSections.dosageAndAdministration,
    adverseReactions: !!labelSections.adverseReactions,
    approvalHistory: approvalHistory.length > 0,
    atc: rx.atcCodes.length > 0,
    brands: rx.brands.length > 0,
    label: !!label,
  };

  const badges = [
    `rxcui=${rx.rxcui}`,
    `brands=${rx.brands.length}`,
    `classes=${rx.classRefs.length}`,
    label ? "label=yes" : "label=no",
    mechanism ? "mech=yes" : "mech=no",
    `approvals=${approvalHistory.length}`,
    labelSections.boxedWarning ? "bw=yes" : "bw=no",
  ].join(" ");
  process.stderr.write(`${tag}: ✓ ${badges}\n`);

  return { ok: true, drug, ingredient, classes: rx.classRecords, coverage };
}

// ────────────────────────────────────────────────────────────────────────
// Emit pretty TypeScript files
// ────────────────────────────────────────────────────────────────────────

const SAFE_KEY = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function emitTs(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const pad1 = "  ".repeat(indent + 1);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => pad1 + emitTs(v, indent + 1));
    return "[\n" + items.join(",\n") + ",\n" + pad + "]";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return "{}";
    const lines = entries.map(([k, v]) => {
      const key = SAFE_KEY.test(k) ? k : JSON.stringify(k);
      return pad1 + key + ": " + emitTs(v, indent + 1);
    });
    return "{\n" + lines.join(",\n") + ",\n" + pad + "}";
  }
  throw new Error(`emitTs: unsupported value ${typeof value}`);
}

const HEADER_DRUGS = `import type { Drug } from "@/lib/schemas";

/**
 * Auto-generated by scripts/ingest/fetch-drugs.ts.
 *
 * Stage-0 drug records ingested from RxNav (RxCUI / brands / classes /
 * ATC codes / derived MOA targets), the openFDA drug label API
 * (mechanism, indications, contraindications, pharmacokinetics, plus
 * verbatim boxed-warning / dosage / adverse-reaction / warnings /
 * special-population / overdosage sections, NDC + UNII), and the
 * openFDA drugsfda API (approval history).
 *
 * Edits to this file will be overwritten on the next \`npm run ingest\`.
 * To curate a record by hand, drop it from the ingest list and move it
 * to a separate manually-edited seed file.
 *
 * Provenance:
 *   - openfda  : drug-level narrative fields (confidence 0.85)
 *   - rxnorm   : ingredients (confidence 0.95)
 *   - rxclass  : class memberships (confidence 0.95)
 *
 * IMPORTANT: This data is for development and illustrative use only.
 * It is not a clinical reference and must not be used to make medication
 * decisions.
 */
`;

const HEADER_CLASSES = `import type { DrugClass } from "@/lib/schemas";

/**
 * Auto-generated by scripts/ingest/fetch-drugs.ts. Derived from the
 * class memberships of every ingested drug (ATC, EPC, MOA, PE) via
 * RxNav RxClass.
 */
`;

const HEADER_INGREDIENTS = `import type { Ingredient } from "@/lib/schemas";

/**
 * Auto-generated by scripts/ingest/fetch-drugs.ts. One ingredient per
 * ingested drug (mono-substance v0). RxCUIs and canonical names come
 * from RxNav properties.
 */
`;

function writeFile(filename: string, body: string): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = resolve(OUT_DIR, filename);
  writeFileSync(path, body, "utf8");
  process.stderr.write(`wrote ${path}\n`);
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // PHARM_LIMIT lets dev runs target a small subset for fast iteration.
  const limit = Number.parseInt(process.env.PHARM_LIMIT ?? "", 10);
  const names = Number.isFinite(limit) && limit > 0
    ? DRUG_NAMES.slice(0, limit)
    : DRUG_NAMES;
  process.stderr.write(
    `Ingesting ${names.length} drugs from RxNav + openFDA...\n\n`,
  );

  const drugs: Drug[] = [];
  const ingredients: Ingredient[] = [];
  const classMap = new Map<string, DrugClass>(); // key = `${kind}:${slug}`
  const coverage = {
    mechanism: 0,
    targets: 0,
    indications: 0,
    contraindications: 0,
    pharmacokinetics: 0,
    boxedWarning: 0,
    dosageNarrative: 0,
    adverseReactions: 0,
    approvalHistory: 0,
    atc: 0,
    brands: 0,
    label: 0,
  };
  const skipped: { name: string; reason: string }[] = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      const res = await ingestOne(name, i, names.length);
      if (!res.ok) {
        skipped.push({ name, reason: res.reason });
      } else {
        drugs.push(res.drug);
        ingredients.push(res.ingredient);
        for (const c of res.classes) {
          const key = `${c.kind}:${c.slug}`;
          const existing = classMap.get(key);
          if (existing) {
            existing.drugCount += 1;
          } else {
            classMap.set(key, { ...c, drugCount: 1 });
          }
        }
        for (const k of Object.keys(coverage) as (keyof CoverageBits)[]) {
          if (res.coverage[k]) coverage[k] += 1;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`[${i + 1}/${names.length}] ${name}: ✗ error: ${msg}\n`);
      skipped.push({ name, reason: `error: ${msg}` });
    }
    // Be polite to upstream APIs.
    await sleep(150);
  }

  // Slug collision fix: when the same slugified name appears under multiple
  // class kinds (e.g. "proton-pump-inhibitors" as both ATC and MOA), make every
  // colliding entry's slug kind-qualified so the by-slug map and the UI keys
  // stay unique. Slugs of non-colliding classes are left untouched.
  const slugGroups = new Map<string, DrugClass[]>();
  for (const c of classMap.values()) {
    const list = slugGroups.get(c.slug) ?? [];
    list.push(c);
    slugGroups.set(c.slug, list);
  }
  const slugRewrites = new Map<string, string>(); // `${kind}:${oldSlug}` -> newSlug
  for (const [slug, group] of slugGroups) {
    if (group.length <= 1) continue;
    for (const c of group) {
      const newSlug = `${slug}-${c.kind}`;
      slugRewrites.set(`${c.kind}:${slug}`, newSlug);
      c.slug = newSlug;
    }
  }
  // Propagate slug rewrites into drug.classes
  for (const d of drugs) {
    d.classes = d.classes.map((ref) => {
      const newSlug = slugRewrites.get(`${ref.kind}:${ref.slug}`);
      return newSlug ? { ...ref, slug: newSlug } : ref;
    });
  }

  // Deterministic order
  drugs.sort((a, b) => a.slug.localeCompare(b.slug));
  for (const d of drugs) {
    d.classes.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));
  }
  ingredients.sort((a, b) => a.slug.localeCompare(b.slug));
  const classes = Array.from(classMap.values()).sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug),
  );

  // Re-validate after rewrites to make sure we did not break anything.
  for (const d of drugs) DrugSchema.parse(d);
  for (const c of classes) DrugClassSchema.parse(c);

  // Emit files
  const drugsBody = `${HEADER_DRUGS}
export const SEED_DRUGS: Drug[] = ${emitTs(drugs)};

export const SEED_DRUGS_BY_SLUG: Record<string, Drug> = Object.fromEntries(
  SEED_DRUGS.map((d) => [d.slug, d]),
);
`;

  const classesBody = `${HEADER_CLASSES}
export const SEED_CLASSES: DrugClass[] = ${emitTs(classes)};

export const SEED_CLASSES_BY_SLUG: Record<string, DrugClass> = Object.fromEntries(
  SEED_CLASSES.map((c) => [c.slug, c]),
);
`;

  const ingredientsBody = `${HEADER_INGREDIENTS}
export const SEED_INGREDIENTS: Ingredient[] = ${emitTs(ingredients)};

export const SEED_INGREDIENTS_BY_SLUG: Record<string, Ingredient> =
  Object.fromEntries(SEED_INGREDIENTS.map((i) => [i.slug, i]));
`;

  if (process.env.PHARM_DRY_RUN === "1") {
    process.stderr.write(
      `DRY_RUN: validated ${drugs.length} drugs / ${ingredients.length} ingredients / ${classes.length} classes; not writing files.\n`,
    );
  } else {
    writeFile("drugs.ts", drugsBody);
    writeFile("classes.ts", classesBody);
    writeFile("ingredients.ts", ingredientsBody);
  }

  // Final summary
  const total = names.length;
  process.stderr.write(`\n──────── ingest summary ────────\n`);
  process.stderr.write(`drugs:        ${drugs.length}/${total}\n`);
  process.stderr.write(`ingredients:  ${ingredients.length}\n`);
  process.stderr.write(`classes:      ${classes.length}\n`);
  process.stderr.write(`\ncoverage (out of ${drugs.length} successful drugs):\n`);
  process.stderr.write(`  mechanism:          ${coverage.mechanism}/${drugs.length}\n`);
  process.stderr.write(`  mechanism targets:  ${coverage.targets}/${drugs.length}\n`);
  process.stderr.write(`  indications:        ${coverage.indications}/${drugs.length}\n`);
  process.stderr.write(`  contraindications:  ${coverage.contraindications}/${drugs.length}\n`);
  process.stderr.write(`  pharmacokinetics:   ${coverage.pharmacokinetics}/${drugs.length}\n`);
  process.stderr.write(`  boxed warning:      ${coverage.boxedWarning}/${drugs.length}\n`);
  process.stderr.write(`  dosage narrative:   ${coverage.dosageNarrative}/${drugs.length}\n`);
  process.stderr.write(`  adverse reactions:  ${coverage.adverseReactions}/${drugs.length}\n`);
  process.stderr.write(`  approval history:   ${coverage.approvalHistory}/${drugs.length}\n`);
  process.stderr.write(`  ATC code:           ${coverage.atc}/${drugs.length}\n`);
  process.stderr.write(`  brand names:        ${coverage.brands}/${drugs.length}\n`);
  process.stderr.write(`  openFDA label:      ${coverage.label}/${drugs.length}\n`);
  if (skipped.length) {
    process.stderr.write(`\nskipped (${skipped.length}):\n`);
    for (const s of skipped) {
      process.stderr.write(`  - ${s.name}: ${s.reason}\n`);
    }
  }
  process.stderr.write(`\nDone.\n`);
}

main().catch((e) => {
  process.stderr.write(`\nFATAL: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
