/**
 * lib/ingest/icd10.ts
 *
 * Curated keyword → ICD-10-CM crosswalk applied to indication text.
 *
 * ICD-10-CM codes are public domain in the US (maintained by CDC/NCHS),
 * so unlike SNOMED CT they can ship without licensing. The crosswalk is
 * deliberately conservative: a curated table of unambiguous condition
 * phrases mapped to unspecified-level codes. Free-text indication
 * narratives are noisy, so precision beats recall here — a missing code
 * is fine, a wrong one is not.
 *
 * These are reference cross-links for joining pharmacopeia data against
 * EHR/research datasets — never diagnostic guidance (see AGENTS.md).
 *
 * Shared by every pipeline that builds or loads drug records:
 *   - scripts/ingest/shared.ts   (record builder, both ingest pipelines)
 *   - scripts/db/seed.ts         (enriches records at load time)
 *   - lib/data/repository.ts     (static fallback, one-time at construction)
 *
 * Enrichment only ever fills an *empty* `icd10` array — codes already
 * present on a record (e.g. from a future LLM-extraction stage with
 * span-level provenance) are never overwritten.
 */

import type { Drug } from "@/lib/schemas";

export interface Icd10CrosswalkEntry {
  /** Human-readable condition label (documentation + review). */
  label: string;
  /** Case-insensitive pattern matched against indication text. */
  pattern: RegExp;
  /** ICD-10-CM codes to attach when the pattern matches. */
  codes: string[];
}

/**
 * Order matters only for readability — every matching entry contributes
 * its codes and the result is deduped. Patterns use word boundaries and
 * negative lookbehinds where a bare term would over-match (e.g. plain
 * "hypertension" must not fire on "pulmonary hypertension").
 */
export const ICD10_CROSSWALK: readonly Icd10CrosswalkEntry[] = [
  // ── Cardiovascular ────────────────────────────────────────────────
  {
    label: "Essential hypertension",
    pattern: /(?<!pulmonary\s)(?<!arterial\s)(?<!ocular\s)(?<!portal\s)(?<!intracranial\s)\bhypertension\b/i,
    codes: ["I10"],
  },
  {
    label: "Pulmonary arterial hypertension",
    pattern: /\bpulmonary (arterial )?hypertension\b/i,
    codes: ["I27.0"],
  },
  { label: "Heart failure", pattern: /\bheart failure\b/i, codes: ["I50.9"] },
  {
    label: "Atrial fibrillation",
    pattern: /\batrial fibrillation\b/i,
    codes: ["I48.91"],
  },
  { label: "Angina pectoris", pattern: /\bangina\b/i, codes: ["I20.9"] },
  {
    label: "Myocardial infarction",
    pattern: /\bmyocardial infarction\b/i,
    codes: ["I21.9"],
  },
  {
    label: "Cerebral infarction (stroke)",
    pattern: /\b(ischemic )?stroke\b/i,
    codes: ["I63.9"],
  },
  {
    label: "Deep vein thrombosis",
    pattern: /\bdeep vein thrombosis\b/i,
    codes: ["I82.409"],
  },
  {
    label: "Pulmonary embolism",
    pattern: /\bpulmonary embolism\b/i,
    codes: ["I26.99"],
  },
  {
    label: "Venous thromboembolism",
    pattern: /\bvenous thromboembolism\b/i,
    codes: ["I82.90"],
  },
  // ── Metabolic / endocrine ─────────────────────────────────────────
  {
    label: "Type 2 diabetes mellitus",
    pattern: /\btype\s*(2|ii)\s*diabetes\b/i,
    codes: ["E11.9"],
  },
  {
    label: "Type 1 diabetes mellitus",
    pattern: /\btype\s*(1|i)\s*diabetes\b/i,
    codes: ["E10.9"],
  },
  {
    label: "Hyperlipidemia",
    pattern: /\bhyperlipidemia\b/i,
    codes: ["E78.5"],
  },
  {
    label: "Hypercholesterolemia",
    pattern: /\bhypercholesterolemia\b/i,
    codes: ["E78.00"],
  },
  {
    label: "Hypertriglyceridemia",
    pattern: /\bhypertriglyceridemia\b/i,
    codes: ["E78.1"],
  },
  {
    label: "Mixed dyslipidemia",
    pattern: /\bmixed dyslipidemia\b/i,
    codes: ["E78.2"],
  },
  { label: "Obesity", pattern: /\bobesity\b/i, codes: ["E66.9"] },
  { label: "Hypothyroidism", pattern: /\bhypothyroidism\b/i, codes: ["E03.9"] },
  {
    label: "Hyperthyroidism",
    pattern: /\bhyperthyroidism\b/i,
    codes: ["E05.90"],
  },
  { label: "Gout", pattern: /\bgout(y arthritis)?\b/i, codes: ["M10.9"] },
  { label: "Hyperkalemia", pattern: /\bhyperkalemia\b/i, codes: ["E87.5"] },
  { label: "Hypokalemia", pattern: /\bhypokalemia\b/i, codes: ["E87.6"] },
  { label: "Hyponatremia", pattern: /\bhyponatremia\b/i, codes: ["E87.1"] },
  { label: "Hypercalcemia", pattern: /\bhypercalcemia\b/i, codes: ["E83.52"] },
  {
    label: "Vitamin D deficiency",
    pattern: /\bvitamin d deficiency\b/i,
    codes: ["E55.9"],
  },
  {
    label: "Iron deficiency",
    pattern: /\biron deficiency\b/i,
    codes: ["E61.1"],
  },
  // ── Respiratory ───────────────────────────────────────────────────
  { label: "Asthma", pattern: /\basthma\b/i, codes: ["J45.909"] },
  {
    label: "Chronic obstructive pulmonary disease",
    pattern: /\b(copd|chronic obstructive pulmonary disease)\b/i,
    codes: ["J44.9"],
  },
  {
    label: "Allergic rhinitis",
    pattern: /\ballergic rhinitis\b/i,
    codes: ["J30.9"],
  },
  { label: "Pneumonia", pattern: /\bpneumonia\b/i, codes: ["J18.9"] },
  { label: "Acute bronchitis", pattern: /\bbronchitis\b/i, codes: ["J20.9"] },
  { label: "Sinusitis", pattern: /\bsinusitis\b/i, codes: ["J32.9"] },
  { label: "Pharyngitis", pattern: /\bpharyngitis\b/i, codes: ["J02.9"] },
  { label: "Tonsillitis", pattern: /\btonsillitis\b/i, codes: ["J03.90"] },
  { label: "Common cold", pattern: /\bcommon cold\b/i, codes: ["J00"] },
  { label: "Influenza", pattern: /\binfluenza\b/i, codes: ["J11.1"] },
  // ── Mental / behavioural / neuro ──────────────────────────────────
  {
    label: "Major depressive disorder",
    pattern: /\b(major depressive disorder|major depression)\b/i,
    codes: ["F32.9"],
  },
  {
    label: "Generalized anxiety disorder",
    pattern: /\bgeneralized anxiety disorder\b/i,
    codes: ["F41.1"],
  },
  { label: "Panic disorder", pattern: /\bpanic disorder\b/i, codes: ["F41.0"] },
  {
    label: "Bipolar disorder",
    pattern: /\bbipolar (i |1 )?disorder\b/i,
    codes: ["F31.9"],
  },
  { label: "Schizophrenia", pattern: /\bschizophrenia\b/i, codes: ["F20.9"] },
  {
    label: "Obsessive-compulsive disorder",
    pattern: /\bobsessive[- ]compulsive disorder\b/i,
    codes: ["F42.9"],
  },
  {
    label: "Post-traumatic stress disorder",
    pattern: /\b(post-?traumatic stress disorder|ptsd)\b/i,
    codes: ["F43.10"],
  },
  {
    label: "Attention-deficit hyperactivity disorder",
    pattern: /\b(attention[- ]deficit|adhd)\b/i,
    codes: ["F90.9"],
  },
  {
    label: "Nicotine dependence (smoking cessation)",
    pattern: /\b(smoking cessation|nicotine dependence)\b/i,
    codes: ["F17.200"],
  },
  {
    label: "Opioid dependence",
    pattern: /\bopioid (use disorder|dependence)\b/i,
    codes: ["F11.20"],
  },
  {
    label: "Alcohol dependence",
    pattern: /\balcohol (use disorder|dependence)\b/i,
    codes: ["F10.20"],
  },
  { label: "Insomnia", pattern: /\binsomnia\b/i, codes: ["G47.00"] },
  { label: "Narcolepsy", pattern: /\bnarcolepsy\b/i, codes: ["G47.419"] },
  {
    label: "Restless legs syndrome",
    pattern: /\brestless legs? syndrome\b/i,
    codes: ["G25.81"],
  },
  {
    label: "Epilepsy / seizures",
    pattern: /\b(epilepsy|epileptic|seizures?)\b/i,
    codes: ["G40.909"],
  },
  { label: "Migraine", pattern: /\bmigraine\b/i, codes: ["G43.909"] },
  {
    label: "Parkinson's disease",
    pattern: /\bparkinson'?s? disease\b/i,
    codes: ["G20"],
  },
  {
    label: "Alzheimer's disease",
    pattern: /\balzheimer'?s? (disease|type)\b/i,
    codes: ["G30.9"],
  },
  {
    label: "Multiple sclerosis",
    pattern: /\bmultiple sclerosis\b/i,
    codes: ["G35"],
  },
  // ── Musculoskeletal / skin ────────────────────────────────────────
  {
    label: "Rheumatoid arthritis",
    pattern: /\brheumatoid arthritis\b/i,
    codes: ["M06.9"],
  },
  {
    label: "Osteoarthritis",
    pattern: /\bosteoarthritis\b/i,
    codes: ["M19.90"],
  },
  { label: "Osteoporosis", pattern: /\bosteoporosis\b/i, codes: ["M81.0"] },
  {
    label: "Psoriatic arthritis",
    pattern: /\bpsoriatic arthritis\b/i,
    codes: ["L40.50"],
  },
  {
    label: "Plaque psoriasis",
    pattern: /\b(plaque )?psoriasis\b/i,
    codes: ["L40.9"],
  },
  {
    label: "Atopic dermatitis",
    pattern: /\batopic dermatitis\b/i,
    codes: ["L20.9"],
  },
  { label: "Acne vulgaris", pattern: /\bacne\b/i, codes: ["L70.0"] },
  { label: "Cellulitis", pattern: /\bcellulitis\b/i, codes: ["L03.90"] },
  // ── Gastrointestinal ──────────────────────────────────────────────
  {
    label: "Gastroesophageal reflux disease",
    pattern: /\b(gastroesophageal reflux|gerd)\b/i,
    codes: ["K21.9"],
  },
  {
    label: "Erosive esophagitis",
    pattern: /\berosive esophagitis\b/i,
    codes: ["K21.00"],
  },
  { label: "Gastric ulcer", pattern: /\bgastric ulcers?\b/i, codes: ["K25.9"] },
  {
    label: "Duodenal ulcer",
    pattern: /\bduodenal ulcers?\b/i,
    codes: ["K26.9"],
  },
  {
    label: "Ulcerative colitis",
    pattern: /\bulcerative colitis\b/i,
    codes: ["K51.90"],
  },
  {
    label: "Crohn's disease",
    pattern: /\bcrohn'?s? disease\b/i,
    codes: ["K50.90"],
  },
  {
    label: "Irritable bowel syndrome",
    pattern: /\birritable bowel syndrome\b/i,
    codes: ["K58.9"],
  },
  { label: "Constipation", pattern: /\bconstipation\b/i, codes: ["K59.00"] },
  {
    label: "Nausea and vomiting",
    pattern: /\bnausea\b/i,
    codes: ["R11.2"],
  },
  // ── Infectious ────────────────────────────────────────────────────
  {
    label: "HIV disease",
    pattern: /\b(hiv-1|hiv)\b/i,
    codes: ["B20"],
  },
  {
    label: "Chronic hepatitis C",
    pattern: /\bhepatitis c\b/i,
    codes: ["B18.2"],
  },
  {
    label: "Chronic hepatitis B",
    pattern: /\bhepatitis b\b/i,
    codes: ["B18.1"],
  },
  {
    label: "Herpes zoster (shingles)",
    pattern: /\b(herpes zoster|shingles)\b/i,
    codes: ["B02.9"],
  },
  {
    label: "Anogenital herpesviral infection",
    pattern: /\bgenital herpes\b/i,
    codes: ["A60.9"],
  },
  {
    label: "Herpes simplex",
    pattern: /\b(herpes simplex|herpes labialis|cold sores)\b/i,
    codes: ["B00.9"],
  },
  { label: "Tuberculosis", pattern: /\btuberculosis\b/i, codes: ["A15.9"] },
  { label: "Malaria", pattern: /\bmalaria\b/i, codes: ["B54"] },
  {
    label: "Urinary tract infection",
    pattern: /\burinary tract infections?\b/i,
    codes: ["N39.0"],
  },
  { label: "Candidiasis", pattern: /\bcandidiasis\b/i, codes: ["B37.9"] },
  { label: "Onychomycosis", pattern: /\bonychomycosis\b/i, codes: ["B35.1"] },
  {
    label: "Tinea pedis (athlete's foot)",
    pattern: /\b(tinea pedis|athlete'?s foot)\b/i,
    codes: ["B35.3"],
  },
  { label: "Scabies", pattern: /\bscabies\b/i, codes: ["B86"] },
  {
    label: "Pediculosis capitis (head lice)",
    pattern: /\b(head lice|pediculosis)\b/i,
    codes: ["B85.0"],
  },
  // ── Genitourinary / reproductive ──────────────────────────────────
  {
    label: "Benign prostatic hyperplasia",
    pattern: /\bbenign prostatic hyperplasia\b/i,
    codes: ["N40.0"],
  },
  {
    label: "Erectile dysfunction",
    pattern: /\berectile dysfunction\b/i,
    codes: ["N52.9"],
  },
  {
    label: "Overactive bladder",
    pattern: /\boveractive bladder\b/i,
    codes: ["N32.81"],
  },
  {
    label: "Menopausal vasomotor symptoms",
    pattern: /\b(vasomotor symptoms|menopause|menopausal)\b/i,
    codes: ["N95.1"],
  },
  { label: "Endometriosis", pattern: /\bendometriosis\b/i, codes: ["N80.9"] },
  {
    label: "Contraception",
    pattern: /\b(contraception|prevention of pregnancy|contraceptive)\b/i,
    codes: ["Z30.9"],
  },
  {
    label: "Chronic kidney disease",
    pattern: /\bchronic kidney disease\b/i,
    codes: ["N18.9"],
  },
  // ── Eye / ear ─────────────────────────────────────────────────────
  { label: "Glaucoma", pattern: /\bglaucoma\b/i, codes: ["H40.9"] },
  {
    label: "Ocular hypertension",
    pattern: /\bocular hypertension\b/i,
    codes: ["H40.059"],
  },
  {
    label: "Conjunctivitis",
    pattern: /\bconjunctivitis\b/i,
    codes: ["H10.9"],
  },
  { label: "Otitis media", pattern: /\botitis media\b/i, codes: ["H66.90"] },
  // ── Oncology ──────────────────────────────────────────────────────
  {
    label: "Breast cancer",
    pattern: /\bbreast cancer\b/i,
    codes: ["C50.919"],
  },
  { label: "Prostate cancer", pattern: /\bprostate cancer\b/i, codes: ["C61"] },
  {
    label: "Lung cancer",
    pattern: /\b(non-?small cell )?lung cancer\b/i,
    codes: ["C34.90"],
  },
  {
    label: "Colorectal cancer",
    pattern: /\bcolorectal cancer\b/i,
    codes: ["C18.9"],
  },
  { label: "Melanoma", pattern: /\bmelanoma\b/i, codes: ["C43.9"] },
  {
    label: "Multiple myeloma",
    pattern: /\bmultiple myeloma\b/i,
    codes: ["C90.00"],
  },
  { label: "Leukemia", pattern: /\bleukemia\b/i, codes: ["C95.90"] },
  { label: "Lymphoma", pattern: /\blymphoma\b/i, codes: ["C85.90"] },
  {
    label: "Ovarian cancer",
    pattern: /\bovarian cancer\b/i,
    codes: ["C56.9"],
  },
  // ── Symptoms (OTC label staples) ──────────────────────────────────
  { label: "Fever", pattern: /\b(reduces? fever|fever reducer|antipyretic)\b/i, codes: ["R50.9"] },
  { label: "Headache", pattern: /\bheadaches?\b/i, codes: ["R51.9"] },
  { label: "Cough", pattern: /\bcough\b/i, codes: ["R05.9"] },
  { label: "Anemia", pattern: /\banemia\b/i, codes: ["D64.9"] },
  { label: "Edema", pattern: /\bedema\b/i, codes: ["R60.9"] },
  { label: "Vertigo", pattern: /\bvertigo\b/i, codes: ["R42"] },
];

/** Cap per indication: OTC labels list a dozen symptoms in one block. */
const MAX_CODES_PER_INDICATION = 8;

/**
 * Map one indication's free text to ICD-10-CM codes via the curated
 * crosswalk. Deterministic, deduped, capped, sorted for stable output.
 */
export function icd10ForText(text: string): string[] {
  const codes = new Set<string>();
  for (const entry of ICD10_CROSSWALK) {
    if (entry.pattern.test(text)) {
      for (const code of entry.codes) codes.add(code);
    }
  }
  return [...codes].sort().slice(0, MAX_CODES_PER_INDICATION);
}

/**
 * Fill empty `icd10` arrays on a drug's indications. Returns the same
 * object when nothing changed so callers can cheaply detect no-ops.
 * Codes already present (e.g. from a future span-level extraction
 * stage) are never overwritten.
 */
export function applyIcd10Crosswalk(drug: Drug): Drug {
  let changed = false;
  const indications = drug.indications.map((ind) => {
    if (ind.icd10.length > 0) return ind;
    const codes = icd10ForText(ind.text);
    if (codes.length === 0) return ind;
    changed = true;
    return { ...ind, icd10: codes };
  });
  return changed ? { ...drug, indications } : drug;
}
