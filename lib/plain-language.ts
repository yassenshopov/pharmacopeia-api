/**
 * Deterministic plain-language rendering for drug-page prose.
 *
 * The patient-facing toggle swaps clinical label text for a simplified
 * version targeting roughly an 8th-grade (Flesch-Kincaid) reading
 * level. Simplification is a pure, rule-based transform — a clinical →
 * plain glossary plus sentence shortening — never a paraphrase, so the
 * output stays traceable to the same provenanced source text. No LLM,
 * no seed-data fork: both views derive from the identical record.
 */

/**
 * Clinical → plain term glossary. Multi-word phrases are listed before
 * their single-word stems and the compiler sorts longest-first, so
 * e.g. "hepatic impairment" wins over the bare "hepatic" rule.
 * Replacements preserve leading capitalization from the matched text.
 */
const GLOSSARY: ReadonlyArray<readonly [clinical: string, plain: string]> = [
  ["myocardial infarction", "heart attack"],
  ["cerebrovascular accident", "stroke"],
  ["cardiovascular", "heart and blood vessel"],
  ["adverse reactions", "side effects"],
  ["adverse reaction", "side effect"],
  ["adverse events", "side effects"],
  ["adverse event", "side effect"],
  ["hypersensitivity reactions", "allergic reactions"],
  ["hypersensitivity", "allergic reaction"],
  ["anaphylactic", "severe allergic"],
  ["anaphylaxis", "a severe allergic reaction"],
  ["contraindicated in", "not for use in"],
  ["contraindicated", "should not be used"],
  ["contraindications", "reasons not to use this medicine"],
  ["concomitantly", "at the same time"],
  ["concomitant use of", "also taking"],
  ["concomitant", "combined"],
  ["concurrently", "at the same time"],
  ["concurrent", "at the same time"],
  ["co-administration", "taking together"],
  ["coadministration", "taking together"],
  ["administered", "given"],
  ["administration", "use"],
  ["administer", "give"],
  ["discontinuation", "stopping"],
  ["discontinued", "stopped"],
  ["discontinue", "stop"],
  ["initiation", "starting"],
  ["initiate", "start"],
  ["titration", "step-by-step dose changes"],
  ["titrate", "adjust the dose"],
  ["prophylaxis", "prevention"],
  ["hepatotoxicity", "liver damage"],
  ["hepatic impairment", "liver problems"],
  ["hepatic", "liver"],
  ["hepatitis", "liver inflammation"],
  ["nephrotoxicity", "kidney damage"],
  ["nephropathy", "kidney disease"],
  ["renal impairment", "kidney problems"],
  ["renally", "by the kidneys"],
  ["renal", "kidney"],
  ["cardiac", "heart"],
  ["pulmonary", "lung"],
  ["pneumonitis", "lung inflammation"],
  ["cutaneous", "skin"],
  ["dermatologic", "skin"],
  ["gastrointestinal", "stomach and gut"],
  ["hemorrhagic", "bleeding"],
  ["hemorrhage", "serious bleeding"],
  ["thromboembolic events", "blood clots"],
  ["thromboembolism", "blood clots"],
  ["thrombosis", "a blood clot"],
  ["thrombocytopenia", "low platelet counts"],
  ["neutropenia", "low white blood cell counts"],
  ["hypertension", "high blood pressure"],
  ["hypotension", "low blood pressure"],
  ["hyperglycemia", "high blood sugar"],
  ["hypoglycemia", "low blood sugar"],
  ["hyperkalemia", "high potassium levels"],
  ["hypokalemia", "low potassium levels"],
  ["hyponatremia", "low sodium levels"],
  ["bradycardia", "a slow heart rate"],
  ["tachycardia", "a fast heart rate"],
  ["arrhythmias", "irregular heartbeats"],
  ["arrhythmia", "irregular heartbeat"],
  ["QT prolongation", "a heart rhythm problem"],
  ["pruritus", "itching"],
  ["urticaria", "hives"],
  ["angioedema", "serious swelling under the skin"],
  ["erythema", "skin redness"],
  ["edema", "swelling"],
  ["dyspnea", "trouble breathing"],
  ["dyspepsia", "indigestion"],
  ["somnolence", "sleepiness"],
  ["pyrexia", "fever"],
  ["emesis", "vomiting"],
  ["syncope", "fainting"],
  ["vertigo", "a spinning feeling"],
  ["insomnia", "trouble sleeping"],
  ["alopecia", "hair loss"],
  ["myalgia", "muscle pain"],
  ["arthralgia", "joint pain"],
  ["asthenia", "weakness"],
  ["paresthesia", "tingling or numbness"],
  ["neuropathy", "nerve damage"],
  ["ototoxicity", "hearing damage"],
  ["stomatitis", "mouth sores"],
  ["mucositis", "mouth and gut sores"],
  ["jaundice", "yellowing of the skin or eyes"],
  ["pediatric use", "use in children"],
  ["pediatric patients", "children"],
  ["geriatric patients", "older adults"],
  ["geriatric", "older adult"],
  ["nursing mothers", "breastfeeding mothers"],
  ["lactation", "breastfeeding"],
  ["embryo-fetal toxicity", "harm to an unborn baby"],
  ["fetus", "unborn baby"],
  ["teratogenic", "able to cause birth defects"],
  ["malignancies", "cancers"],
  ["malignancy", "cancer"],
  ["neoplasm", "tumor"],
  ["efficacy", "how well it works"],
  ["indicated for", "used for"],
  ["dosage", "dose"],
  ["subcutaneously", "as an injection under the skin"],
  ["subcutaneous", "under the skin"],
  ["intravenously", "into a vein"],
  ["intravenous", "into a vein"],
  ["intramuscularly", "into a muscle"],
  ["intramuscular", "into a muscle"],
  ["orally", "by mouth"],
  ["exacerbation", "worsening"],
  ["exacerbate", "worsen"],
  ["etiology", "cause"],
  ["idiopathic", "of unknown cause"],
  ["asymptomatic", "without symptoms"],
  ["symptomatic", "with symptoms"],
  ["creatinine clearance", "kidney function"],
  ["clinically significant", "important"],
  ["prior to", "before"],
  ["utilize", "use"],
  ["approximately", "about"],
  ["physician", "doctor"],
];

const COMPILED_GLOSSARY = [...GLOSSARY]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([clinical, plain]) => ({
    pattern: new RegExp(`\\b${clinical}\\b`, "gi"),
    plain,
  }));

function matchCase(plain: string, matched: string): string {
  const first = matched.charAt(0);
  const second = matched.charAt(1);
  const isTitleCase =
    first === first.toUpperCase() &&
    first !== first.toLowerCase() &&
    // All-caps acronyms ("QT") signal nothing about sentence position.
    (second === "" || second === second.toLowerCase());
  if (isTitleCase) {
    return plain.charAt(0).toUpperCase() + plain.slice(1);
  }
  return plain;
}

/**
 * One run of simplified prose. Segments with `from` set were
 * glossary-swapped — `from` holds the original clinical wording so the
 * UI can highlight the substitution and surface the source term.
 */
export interface PlainSegment {
  text: string;
  from?: string;
}

/**
 * Rule-based plain-language pass over clinical prose: glossary
 * substitution plus splitting semicolon-chained clauses into separate
 * sentences (shorter sentences are the other half of the reading-level
 * drop). Deterministic and meaning-preserving by construction. Returns
 * segments so swapped phrases stay individually addressable.
 */
export function simplifyClinicalSegments(text: string): PlainSegment[] {
  // Sentence splitting and whitespace collapse run first, on the raw
  // clinical text, so the split still fires when the word after a
  // semicolon is itself about to be glossary-swapped.
  const prepared = text
    .replace(/;\s+([a-z])/g, (_, c: string) => `. ${c.toUpperCase()}`)
    .replace(/\s+/g, " ")
    .trim();
  let segments: PlainSegment[] = [{ text: prepared }];
  for (const { pattern, plain } of COMPILED_GLOSSARY) {
    const next: PlainSegment[] = [];
    for (const seg of segments) {
      if (seg.from) {
        next.push(seg);
        continue;
      }
      let last = 0;
      for (const m of seg.text.matchAll(pattern)) {
        const index = m.index ?? 0;
        if (index > last) next.push({ text: seg.text.slice(last, index) });
        next.push({ text: matchCase(plain, m[0]), from: m[0] });
        last = index + m[0].length;
      }
      if (last < seg.text.length) next.push({ text: seg.text.slice(last) });
    }
    segments = next;
  }
  return segments;
}

/** Flat-string variant of `simplifyClinicalSegments` (grade scoring). */
export function simplifyClinicalText(text: string): string {
  return simplifyClinicalSegments(text)
    .map((seg) => seg.text)
    .join("")
    .trim();
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^l]e|ed|es)$/, "");
  const groups = trimmed.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

/**
 * Flesch-Kincaid grade level. Heuristic syllable counting — good
 * enough to report "about an 8th-grade reading level", not a
 * linguistics-grade metric.
 */
export function fleschKincaidGrade(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (sentences.length === 0 || words.length === 0) return 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const grade =
    0.39 * (words.length / sentences.length) +
    11.8 * (syllables / words.length) -
    15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}
