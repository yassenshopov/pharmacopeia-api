/**
 * scripts/ingest/curated-names.ts
 *
 * The hand-curated core list of widely-prescribed US medications. Used
 * by the curated TS-seed ingest (fetch-drugs.ts) and ranked first by
 * the programmatic 5,000+ drug universe (build-universe.ts) so partial
 * scale runs cover the highest-value records before the long tail.
 */

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
export const CURATED_DRUG_NAMES: ReadonlyArray<string> = [
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
