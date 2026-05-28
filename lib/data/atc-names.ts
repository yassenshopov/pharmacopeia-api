/**
 * WHO ATC intermediate-level names.
 *
 * The seed dataset (RxClass) only hands us ATC level-4 subgroups (5-char
 * codes like `C09AA`). To render a fully expandable level 1→5 tree we need
 * the WHO names for the intermediate level-2 (3-char) and level-3 (4-char)
 * codes, which RxClass does not return. These tables supply them.
 *
 * Level 1 (anatomical main groups) lives in `repository.ts` as
 * `ATC_LEVEL1`; level 4 names come from the seed class records; level 5
 * (chemical substances) is populated from the drugs in our dataset that
 * carry the corresponding level-4 ATC code.
 *
 * Source: WHO Collaborating Centre for Drug Statistics Methodology,
 * ATC/DDD Index (https://www.whocc.no/atc_ddd_index/). Reference data,
 * educational use only.
 *
 * Only the codes present in the current seed are listed; an unknown code
 * degrades gracefully to its raw code in the UI.
 */

export const ATC_LEVEL2_NAMES: Readonly<Record<string, string>> = {
  // A — Alimentary tract and metabolism
  A01: "Stomatological preparations",
  A02: "Drugs for acid related disorders",
  A03: "Drugs for functional gastrointestinal disorders",
  A04: "Antiemetics and antinauseants",
  A06: "Drugs for constipation",
  A07: "Antidiarrheals, intestinal antiinflammatory/antiinfective agents",
  A10: "Drugs used in diabetes",
  // B — Blood and blood forming organs
  B01: "Antithrombotic agents",
  B03: "Antianemic preparations",
  // C — Cardiovascular system
  C01: "Cardiac therapy",
  C02: "Antihypertensives",
  C03: "Diuretics",
  C04: "Peripheral vasodilators",
  C05: "Vasoprotectives",
  C07: "Beta blocking agents",
  C08: "Calcium channel blockers",
  C09: "Agents acting on the renin-angiotensin system",
  C10: "Lipid modifying agents",
  // D — Dermatologicals
  D01: "Antifungals for dermatological use",
  D04: "Antipruritics, incl. antihistamines, anesthetics, etc.",
  D05: "Antipsoriatics",
  D06: "Antibiotics and chemotherapeutics for dermatological use",
  D07: "Corticosteroids, dermatological preparations",
  D10: "Anti-acne preparations",
  D11: "Other dermatological preparations",
  // G — Genito-urinary system and sex hormones
  G01: "Gynecological antiinfectives and antiseptics",
  G02: "Other gynecologicals",
  G03: "Sex hormones and modulators of the genital system",
  G04: "Urologicals",
  // H — Systemic hormonal preparations, excl. sex hormones and insulins
  H01: "Pituitary and hypothalamic hormones and analogues",
  H02: "Corticosteroids for systemic use",
  H03: "Thyroid therapy",
  // J — Antiinfectives for systemic use
  J01: "Antibacterials for systemic use",
  J02: "Antimycotics for systemic use",
  J05: "Antivirals for systemic use",
  // L — Antineoplastic and immunomodulating agents
  L01: "Antineoplastic agents",
  L02: "Endocrine therapy",
  L04: "Immunosuppressants",
  // M — Musculo-skeletal system
  M01: "Antiinflammatory and antirheumatic products",
  M02: "Topical products for joint and muscular pain",
  M03: "Muscle relaxants",
  M04: "Antigout preparations",
  M05: "Drugs for treatment of bone diseases",
  // N — Nervous system
  N01: "Anesthetics",
  N02: "Analgesics",
  N03: "Antiepileptics",
  N04: "Anti-Parkinson drugs",
  N05: "Psycholeptics",
  N06: "Psychoanaleptics",
  N07: "Other nervous system drugs",
  // P — Antiparasitic products, insecticides and repellents
  P01: "Antiprotozoals",
  // R — Respiratory system
  R01: "Nasal preparations",
  R02: "Throat preparations",
  R03: "Drugs for obstructive airway diseases",
  R05: "Cough and cold preparations",
  R06: "Antihistamines for systemic use",
  // S — Sensory organs
  S01: "Ophthalmologicals",
  S02: "Otologicals",
  // V — Various
  V03: "All other therapeutic products",
  V04: "Diagnostic agents",
};

export const ATC_LEVEL3_NAMES: Readonly<Record<string, string>> = {
  A01A: "Stomatological preparations",
  A02B: "Drugs for peptic ulcer and gastro-oesophageal reflux disease (GORD)",
  A03A: "Drugs for functional bowel disorders",
  A03F: "Propulsives",
  A04A: "Antiemetics and antinauseants",
  A06A: "Drugs for constipation",
  A07D: "Antipropulsives",
  A07E: "Intestinal antiinflammatory agents",
  A10A: "Insulins and analogues",
  A10B: "Blood glucose lowering drugs, excl. insulins",
  B01A: "Antithrombotic agents",
  B03A: "Iron preparations",
  B03B: "Vitamin B12 and folic acid",
  C01A: "Cardiac glycosides",
  C01B: "Antiarrhythmics, class I and III",
  C01D: "Vasodilators used in cardiac diseases",
  C01E: "Other cardiac preparations",
  C02A: "Antiadrenergic agents, centrally acting",
  C02C: "Antiadrenergic agents, peripherally acting",
  C03A: "Low-ceiling diuretics, thiazides",
  C03C: "High-ceiling diuretics",
  C03D: "Potassium-sparing agents",
  C04A: "Peripheral vasodilators",
  C05A: "Agents for treatment of hemorrhoids and anal fissures for topical use",
  C07A: "Beta blocking agents",
  C08C: "Selective calcium channel blockers with mainly vascular effects",
  C08D: "Selective calcium channel blockers with direct cardiac effects",
  C09A: "ACE inhibitors, plain",
  C09C: "Angiotensin II receptor blockers (ARBs), plain",
  C10A: "Lipid modifying agents, plain",
  D01A: "Antifungals for topical use",
  D01B: "Antifungals for systemic use",
  D04A: "Antipruritics, incl. antihistamines, anesthetics, etc.",
  D05A: "Antipsoriatics for topical use",
  D06A: "Antibiotics for topical use",
  D06B: "Chemotherapeutics for topical use",
  D07A: "Corticosteroids, plain",
  D07X: "Corticosteroids, other combinations",
  D10A: "Anti-acne preparations for topical use",
  D10B: "Anti-acne preparations for systemic use",
  D11A: "Other dermatological preparations",
  G01A: "Antiinfectives and antiseptics, excl. combinations with corticosteroids",
  G02C: "Other gynecologicals",
  G03B: "Androgens",
  G03C: "Estrogens",
  G03X: "Other sex hormones and modulators of the genital system",
  G04B: "Urologicals",
  G04C: "Drugs used in benign prostatic hypertrophy",
  H01B: "Posterior pituitary lobe hormones",
  H02C: "Antiadrenal preparations",
  H03B: "Antithyroid preparations",
  J01A: "Tetracyclines",
  J01C: "Beta-lactam antibacterials, penicillins",
  J01D: "Other beta-lactam antibacterials",
  J01E: "Sulfonamides and trimethoprim",
  J01F: "Macrolides, lincosamides and streptogramins",
  J01M: "Quinolone antibacterials",
  J01X: "Other antibacterials",
  J02A: "Antimycotics for systemic use",
  J05A: "Direct acting antivirals",
  L01B: "Antimetabolites",
  L01X: "Other antineoplastic agents",
  L02B: "Hormone antagonists and related agents",
  L04A: "Immunosuppressants",
  M01A: "Antiinflammatory and antirheumatic products, non-steroids",
  M02A: "Topical products for joint and muscular pain",
  M03B: "Muscle relaxants, centrally acting agents",
  M04A: "Antigout preparations",
  M05B: "Drugs affecting bone structure and mineralization",
  N01A: "Anesthetics, general",
  N02A: "Opioids",
  N02B: "Other analgesics and antipyretics",
  N02C: "Antimigraine preparations",
  N03A: "Antiepileptics",
  N04B: "Dopaminergic agents",
  N05A: "Antipsychotics",
  N05B: "Anxiolytics",
  N05C: "Hypnotics and sedatives",
  N06A: "Antidepressants",
  N06B: "Psychostimulants, agents used for ADHD and nootropics",
  N06D: "Anti-dementia drugs",
  N07B: "Drugs used in addictive disorders",
  P01A: "Agents against amoebiasis and other protozoal diseases",
  P01B: "Antimalarials",
  R01A: "Decongestants and other nasal preparations for topical use",
  R02A: "Throat preparations",
  R03A: "Adrenergics, inhalants",
  R03B: "Other drugs for obstructive airway diseases, inhalants",
  R03D: "Other systemic drugs for obstructive airway diseases",
  R05D: "Cough suppressants, excl. combinations with expectorants",
  R06A: "Antihistamines for systemic use",
  S01A: "Antiinfectives",
  S01B: "Antiinflammatory agents",
  S01C: "Antiinflammatory agents and antiinfectives in combination",
  S01E: "Antiglaucoma preparations and miotics",
  S01G: "Decongestants and antiallergics",
  S01X: "Other ophthalmologicals",
  S02A: "Antiinfectives",
  V03A: "All other therapeutic products",
  V04C: "Other diagnostic agents",
};

export function atcLevel2Name(code: string): string {
  return ATC_LEVEL2_NAMES[code] ?? code;
}

export function atcLevel3Name(code: string): string {
  return ATC_LEVEL3_NAMES[code] ?? code;
}
