import type { Drug } from "@/lib/schemas";
import { mockProvenance } from "./provenance";

/**
 * Hand-curated mock data for the 10 most-prescribed drugs in the US.
 *
 * Sourced from openFDA labels, RxNorm, RxClass, and DrugBank Open Subset.
 * Treated as illustrative MVP data — every field will be replaced by the
 * LLM extraction pipeline in Stage 1.
 *
 * IMPORTANT: This data is for development and illustrative use only.
 * It is not a clinical reference and must not be used to make medication
 * decisions.
 */

const fdaLabel = (slug: string) =>
  `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${slug}`;

export const MOCK_DRUGS: Drug[] = [
  // ─────────────────────────────────────────────────────────────────── 1
  {
    slug: "metformin",
    name: "Metformin",
    synonyms: ["metformin hydrochloride", "metformin HCl"],
    jurisdiction: "US-FDA",
    ingredients: [
      {
        slug: "metformin-hydrochloride",
        name: "Metformin Hydrochloride",
        strength: "500 mg",
      },
    ],
    brands: ["Glucophage", "Fortamet", "Glumetza", "Riomet"],
    classes: [{ slug: "biguanide", name: "Biguanide", kind: "epc" }],
    shortDescription:
      "First-line oral antihyperglycemic agent for type 2 diabetes mellitus.",
    mechanism: {
      summary:
        "Decreases hepatic glucose production via inhibition of mitochondrial glycerophosphate dehydrogenase, decreases intestinal absorption of glucose, and improves insulin sensitivity by increasing peripheral glucose uptake.",
      targets: [
        "Mitochondrial glycerophosphate dehydrogenase",
        "AMP-activated protein kinase (AMPK)",
      ],
    },
    indications: [
      {
        text: "Type 2 diabetes mellitus, as monotherapy or in combination",
        icd10: ["E11"],
      },
      {
        text: "Prediabetes / impaired glucose tolerance (off-label)",
        icd10: ["R73.03"],
      },
    ],
    contraindications: [
      {
        text: "Severe renal impairment (eGFR < 30 mL/min/1.73m²)",
        severity: "contraindicated",
      },
      {
        text: "Acute or chronic metabolic acidosis, including diabetic ketoacidosis",
        severity: "contraindicated",
      },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "Type 2 diabetes",
        dose: "500 mg",
        frequency: "twice daily with meals",
        maxDose: "2,550 mg/day (immediate release)",
        notes:
          "Titrate up by 500 mg weekly to minimize gastrointestinal side effects.",
      },
    ],
    pharmacokinetics: {
      halfLife: "4–9 hours",
      tMax: "2–3 hours",
      bioavailability: "50–60% (fasting)",
      proteinBinding: "Negligible",
      metabolism: "Not metabolized",
      excretion: "Renal (≈ 90% unchanged)",
    },
    approvalHistory: [
      {
        date: "1995-03-03",
        applicationNumber: "NDA020357",
        type: "NDA",
        sponsor: "Bristol-Myers Squibb",
      },
    ],
    patientSummary:
      "Metformin lowers blood sugar in people with type 2 diabetes by reducing how much sugar your liver makes and by helping your body use insulin better. It is taken by mouth, usually with meals to reduce stomach upset.",
    identifiers: {
      rxcui: "6809",
      ndc: ["0087-6060", "0087-6071"],
      atc: ["A10BA02"],
      drugbank: "DB00331",
      chembl: "CHEMBL1431",
      pubchem: "4091",
      unii: "9100L32L2N",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("metformin"),
      extractor: "openfda",
    }),
  },

  // ─────────────────────────────────────────────────────────────────── 2
  {
    slug: "lisinopril",
    name: "Lisinopril",
    synonyms: ["MK-521"],
    jurisdiction: "US-FDA",
    ingredients: [
      { slug: "lisinopril", name: "Lisinopril", strength: "10 mg" },
    ],
    brands: ["Prinivil", "Zestril", "Qbrelis"],
    classes: [{ slug: "ace-inhibitor", name: "ACE Inhibitor", kind: "epc" }],
    shortDescription:
      "Long-acting ACE inhibitor for hypertension, heart failure, and post-MI cardioprotection.",
    mechanism: {
      summary:
        "Competitively inhibits angiotensin-converting enzyme (ACE), preventing conversion of angiotensin I to angiotensin II. Decreases vasoconstriction and aldosterone secretion, lowering blood pressure.",
      targets: ["Angiotensin-converting enzyme (ACE)"],
    },
    indications: [
      { text: "Essential hypertension", icd10: ["I10"] },
      { text: "Heart failure with reduced ejection fraction", icd10: ["I50.2"] },
      { text: "Acute myocardial infarction (within 24 hours)", icd10: ["I21"] },
    ],
    contraindications: [
      {
        text: "History of angioedema related to previous ACE inhibitor therapy",
        severity: "contraindicated",
      },
      {
        text: "Concurrent use with aliskiren in patients with diabetes",
        severity: "contraindicated",
      },
      { text: "Pregnancy (all trimesters)", severity: "contraindicated" },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "Hypertension",
        dose: "10 mg",
        frequency: "once daily",
        maxDose: "80 mg/day",
        notes: "Initial 5 mg if combined with a diuretic.",
      },
    ],
    pharmacokinetics: {
      halfLife: "≈ 12 hours (effective)",
      tMax: "6–8 hours",
      bioavailability: "≈ 25%",
      proteinBinding: "None",
      metabolism: "Not metabolized",
      excretion: "Renal (unchanged)",
    },
    approvalHistory: [
      {
        date: "1987-12-29",
        applicationNumber: "NDA019558",
        type: "NDA",
        sponsor: "Merck",
      },
    ],
    patientSummary:
      "Lisinopril lowers blood pressure by relaxing your blood vessels. It is taken by mouth once a day and may take a few weeks to reach full effect. A dry, persistent cough is a common side effect.",
    identifiers: {
      rxcui: "29046",
      ndc: ["0071-0526", "0071-0527"],
      atc: ["C09AA03"],
      drugbank: "DB00722",
      chembl: "CHEMBL1237",
      pubchem: "5362119",
      unii: "E7199S1YWR",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("lisinopril"),
      extractor: "openfda",
    }),
  },

  // ─────────────────────────────────────────────────────────────────── 3
  {
    slug: "atorvastatin",
    name: "Atorvastatin",
    synonyms: ["atorvastatin calcium", "CI-981"],
    jurisdiction: "US-FDA",
    ingredients: [
      {
        slug: "atorvastatin-calcium",
        name: "Atorvastatin Calcium",
        strength: "20 mg",
      },
    ],
    brands: ["Lipitor"],
    classes: [
      { slug: "statin", name: "HMG-CoA Reductase Inhibitor", kind: "epc" },
    ],
    shortDescription:
      "HMG-CoA reductase inhibitor (statin) used to reduce LDL cholesterol and cardiovascular risk.",
    mechanism: {
      summary:
        "Competitively inhibits HMG-CoA reductase, the rate-limiting enzyme in hepatic cholesterol biosynthesis. Up-regulates LDL receptors, increasing LDL clearance from plasma.",
      targets: ["HMG-CoA reductase"],
    },
    indications: [
      {
        text: "Primary hypercholesterolemia and mixed dyslipidemia",
        icd10: ["E78.0", "E78.2"],
      },
      {
        text: "Primary prevention of cardiovascular disease in high-risk patients",
        icd10: ["Z79.899"],
      },
    ],
    contraindications: [
      { text: "Active liver disease", severity: "contraindicated" },
      { text: "Pregnancy and lactation", severity: "contraindicated" },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "Hypercholesterolemia",
        dose: "10–20 mg",
        frequency: "once daily",
        maxDose: "80 mg/day",
        notes: "May be taken without regard to meals; any time of day.",
      },
    ],
    pharmacokinetics: {
      halfLife: "14 hours (active metabolites 20–30 hours)",
      tMax: "1–2 hours",
      bioavailability: "≈ 14%",
      proteinBinding: "≥ 98%",
      metabolism: "Hepatic (CYP3A4)",
      excretion: "Biliary",
    },
    approvalHistory: [
      {
        date: "1996-12-17",
        applicationNumber: "NDA020702",
        type: "NDA",
        sponsor: "Parke-Davis",
      },
    ],
    patientSummary:
      "Atorvastatin lowers 'bad' (LDL) cholesterol and reduces your risk of heart attack and stroke. It is taken by mouth once a day. Tell your clinician about any unexplained muscle pain.",
    identifiers: {
      rxcui: "83367",
      ndc: ["0071-0155", "0071-0156"],
      atc: ["C10AA05"],
      drugbank: "DB01076",
      chembl: "CHEMBL1487",
      pubchem: "60823",
      unii: "A0JWA85V8F",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("atorvastatin"),
      extractor: "openfda",
    }),
  },

  // ─────────────────────────────────────────────────────────────────── 4
  {
    slug: "levothyroxine",
    name: "Levothyroxine",
    synonyms: ["L-thyroxine", "T4"],
    jurisdiction: "US-FDA",
    ingredients: [
      {
        slug: "levothyroxine-sodium",
        name: "Levothyroxine Sodium",
        strength: "100 mcg",
      },
    ],
    brands: ["Synthroid", "Levoxyl", "Tirosint", "Unithroid"],
    classes: [{ slug: "thyroid-hormone", name: "Thyroid Hormone", kind: "epc" }],
    shortDescription:
      "Synthetic T4 thyroid hormone used as replacement therapy in primary, secondary, and tertiary hypothyroidism.",
    mechanism: {
      summary:
        "Exogenous T4 that is converted peripherally to active T3. Binds nuclear thyroid hormone receptors to regulate metabolism, growth, and development.",
      targets: ["Thyroid hormone receptors α and β"],
    },
    indications: [
      { text: "Primary hypothyroidism", icd10: ["E03.9"] },
      { text: "Pituitary TSH suppression in thyroid cancer", icd10: ["C73"] },
    ],
    contraindications: [
      { text: "Untreated adrenal insufficiency", severity: "contraindicated" },
      { text: "Acute myocardial infarction", severity: "major" },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "Hypothyroidism",
        dose: "1.6 mcg/kg",
        frequency: "once daily on empty stomach",
        notes:
          "Administer 30–60 minutes before breakfast; separate from calcium and iron supplements by 4 hours.",
      },
    ],
    pharmacokinetics: {
      halfLife: "6–7 days (T4)",
      tMax: "2–4 hours",
      bioavailability: "40–80% (fasting)",
      proteinBinding: "> 99% (TBG, transthyretin, albumin)",
      metabolism: "Hepatic (deiodination to T3)",
      excretion: "Biliary and renal",
    },
    approvalHistory: [
      {
        date: "2002-07-24",
        applicationNumber: "NDA021402",
        type: "NDA",
        sponsor: "AbbVie",
      },
    ],
    patientSummary:
      "Levothyroxine replaces the thyroid hormone your body is not producing. Take it once daily on an empty stomach with water, at least 30 minutes before food, coffee, or other medications.",
    identifiers: {
      rxcui: "10582",
      ndc: ["0074-7068", "0074-4341"],
      atc: ["H03AA01"],
      drugbank: "DB00451",
      chembl: "CHEMBL1351",
      pubchem: "5819",
      unii: "9J765S329G",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("levothyroxine"),
      extractor: "openfda",
    }),
  },

  // ─────────────────────────────────────────────────────────────────── 5
  {
    slug: "amlodipine",
    name: "Amlodipine",
    synonyms: ["amlodipine besylate"],
    jurisdiction: "US-FDA",
    ingredients: [
      {
        slug: "amlodipine-besylate",
        name: "Amlodipine Besylate",
        strength: "5 mg",
      },
    ],
    brands: ["Norvasc", "Katerzia"],
    classes: [
      {
        slug: "calcium-channel-blocker",
        name: "Calcium Channel Blocker",
        kind: "epc",
      },
    ],
    shortDescription:
      "Long-acting dihydropyridine calcium channel blocker for hypertension and chronic stable angina.",
    mechanism: {
      summary:
        "Inhibits L-type voltage-gated calcium channels in vascular smooth muscle, producing peripheral vasodilation and reducing systemic vascular resistance.",
      targets: ["L-type voltage-gated calcium channel (CACNA1C)"],
    },
    indications: [
      { text: "Essential hypertension", icd10: ["I10"] },
      { text: "Chronic stable angina", icd10: ["I20.8"] },
      { text: "Vasospastic (Prinzmetal) angina", icd10: ["I20.1"] },
    ],
    contraindications: [
      { text: "Severe aortic stenosis", severity: "major" },
      {
        text: "Cardiogenic shock or hemodynamically unstable heart failure",
        severity: "contraindicated",
      },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "Hypertension",
        dose: "5 mg",
        frequency: "once daily",
        maxDose: "10 mg/day",
        notes: "May be titrated upward over 7–14 days.",
      },
    ],
    pharmacokinetics: {
      halfLife: "30–50 hours",
      tMax: "6–12 hours",
      bioavailability: "64–90%",
      proteinBinding: "≈ 93%",
      metabolism: "Hepatic (CYP3A4)",
      excretion: "Renal (60% as metabolites)",
    },
    approvalHistory: [
      {
        date: "1992-07-31",
        applicationNumber: "NDA019787",
        type: "NDA",
        sponsor: "Pfizer",
      },
    ],
    patientSummary:
      "Amlodipine relaxes your blood vessels to lower blood pressure and reduce chest pain. It is taken once a day and may cause mild ankle swelling.",
    identifiers: {
      rxcui: "17767",
      ndc: ["0069-1530", "0069-1540"],
      atc: ["C08CA01"],
      drugbank: "DB00381",
      chembl: "CHEMBL1491",
      pubchem: "2162",
      unii: "1J444QC288",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("amlodipine"),
      extractor: "openfda",
    }),
  },

  // ─────────────────────────────────────────────────────────────────── 6
  {
    slug: "omeprazole",
    name: "Omeprazole",
    synonyms: ["H 168/68"],
    jurisdiction: "US-FDA",
    ingredients: [
      { slug: "omeprazole", name: "Omeprazole", strength: "20 mg" },
    ],
    brands: ["Prilosec", "Losec", "Omesec"],
    classes: [
      {
        slug: "proton-pump-inhibitor",
        name: "Proton Pump Inhibitor",
        kind: "epc",
      },
    ],
    shortDescription:
      "Proton pump inhibitor for gastric acid suppression in GERD, peptic ulcer disease, and Zollinger-Ellison syndrome.",
    mechanism: {
      summary:
        "Irreversibly inhibits the H+/K+ ATPase (proton pump) in gastric parietal cells, profoundly suppressing both basal and stimulated acid secretion.",
      targets: ["Gastric H+/K+ ATPase"],
    },
    indications: [
      { text: "Gastroesophageal reflux disease (GERD)", icd10: ["K21.9"] },
      { text: "Duodenal and gastric ulcers", icd10: ["K26", "K25"] },
      { text: "Zollinger-Ellison syndrome", icd10: ["E16.4"] },
      {
        text: "Helicobacter pylori eradication (combination therapy)",
        icd10: ["B96.81"],
      },
    ],
    contraindications: [
      {
        text: "Concomitant use with rilpivirine-containing products",
        severity: "contraindicated",
      },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "GERD",
        dose: "20 mg",
        frequency: "once daily before breakfast",
        maxDose: "40 mg/day for severe esophagitis",
        notes: "Use lowest effective dose for the shortest duration.",
      },
    ],
    pharmacokinetics: {
      halfLife: "0.5–1 hour (effect persists 24+ hours due to irreversible binding)",
      tMax: "0.5–3.5 hours",
      bioavailability: "30–40%",
      proteinBinding: "≈ 95%",
      metabolism: "Hepatic (CYP2C19, CYP3A4)",
      excretion: "Renal (≈ 77% as metabolites)",
    },
    approvalHistory: [
      {
        date: "1989-09-14",
        applicationNumber: "NDA019810",
        type: "NDA",
        sponsor: "AstraZeneca",
      },
    ],
    patientSummary:
      "Omeprazole reduces stomach acid to treat heartburn, ulcers, and reflux. Take it before breakfast, ideally for the shortest time needed.",
    identifiers: {
      rxcui: "7646",
      ndc: ["0186-0606", "0186-0640"],
      atc: ["A02BC01"],
      drugbank: "DB00338",
      chembl: "CHEMBL1503",
      pubchem: "4594",
      unii: "KG60484QX9",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("omeprazole"),
      extractor: "openfda",
    }),
  },

  // ─────────────────────────────────────────────────────────────────── 7
  {
    slug: "sertraline",
    name: "Sertraline",
    synonyms: ["sertraline hydrochloride", "CP-51,974-1"],
    jurisdiction: "US-FDA",
    ingredients: [
      {
        slug: "sertraline-hydrochloride",
        name: "Sertraline Hydrochloride",
        strength: "50 mg",
      },
    ],
    brands: ["Zoloft", "Lustral"],
    classes: [
      {
        slug: "ssri",
        name: "Selective Serotonin Reuptake Inhibitor",
        kind: "epc",
      },
    ],
    shortDescription:
      "SSRI antidepressant indicated for major depressive disorder, OCD, panic disorder, PTSD, social anxiety, and PMDD.",
    mechanism: {
      summary:
        "Selectively inhibits the serotonin transporter (SERT) in presynaptic neurons, increasing synaptic serotonin availability. Minimal effect on norepinephrine and dopamine reuptake.",
      targets: ["Serotonin transporter (SERT / SLC6A4)"],
    },
    indications: [
      { text: "Major depressive disorder", icd10: ["F32", "F33"] },
      { text: "Obsessive-compulsive disorder", icd10: ["F42"] },
      { text: "Panic disorder", icd10: ["F41.0"] },
      { text: "Post-traumatic stress disorder", icd10: ["F43.10"] },
      { text: "Social anxiety disorder", icd10: ["F40.10"] },
      { text: "Premenstrual dysphoric disorder", icd10: ["N94.3"] },
    ],
    contraindications: [
      {
        text: "Concurrent use with MAO inhibitors (within 14 days)",
        severity: "contraindicated",
      },
      { text: "Concurrent pimozide use", severity: "contraindicated" },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "Major depressive disorder",
        dose: "50 mg",
        frequency: "once daily",
        maxDose: "200 mg/day",
        notes: "Titrate at intervals of at least 1 week.",
      },
    ],
    pharmacokinetics: {
      halfLife: "≈ 26 hours",
      tMax: "4–8 hours",
      bioavailability: "≈ 44%",
      proteinBinding: "≈ 98%",
      metabolism: "Hepatic (CYP2B6, CYP2C19, CYP2C9, CYP3A4)",
      excretion: "Renal and fecal",
    },
    approvalHistory: [
      {
        date: "1991-12-30",
        applicationNumber: "NDA019839",
        type: "NDA",
        sponsor: "Pfizer",
      },
    ],
    patientSummary:
      "Sertraline treats depression, anxiety, and related conditions by raising serotonin in the brain. Effects build over 2–6 weeks. Do not stop suddenly.",
    identifiers: {
      rxcui: "36437",
      ndc: ["0049-4900", "0049-4910"],
      atc: ["N06AB06"],
      drugbank: "DB01104",
      chembl: "CHEMBL809",
      pubchem: "68617",
      unii: "QUC7NX6WMB",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("sertraline"),
      extractor: "openfda",
    }),
  },

  // ─────────────────────────────────────────────────────────────────── 8
  {
    slug: "gabapentin",
    name: "Gabapentin",
    synonyms: ["1-(aminomethyl)cyclohexaneacetic acid"],
    jurisdiction: "US-FDA",
    ingredients: [
      { slug: "gabapentin", name: "Gabapentin", strength: "300 mg" },
    ],
    brands: ["Neurontin", "Gralise", "Horizant"],
    classes: [
      { slug: "gabapentinoid", name: "Gabapentinoid", kind: "moa" },
    ],
    shortDescription:
      "Alpha-2-delta calcium channel ligand used for partial seizures, postherpetic neuralgia, and off-label neuropathic pain.",
    mechanism: {
      summary:
        "Binds the α2δ-1 subunit of voltage-gated calcium channels, reducing presynaptic calcium influx and decreasing release of excitatory neurotransmitters (glutamate, substance P, norepinephrine).",
      targets: ["Voltage-gated calcium channel α2δ-1 subunit"],
    },
    indications: [
      {
        text: "Adjunctive therapy for partial-onset seizures",
        icd10: ["G40.209"],
      },
      { text: "Postherpetic neuralgia", icd10: ["B02.29"] },
      { text: "Restless legs syndrome (extended-release)", icd10: ["G25.81"] },
    ],
    contraindications: [
      {
        text: "Known hypersensitivity to gabapentin or any product component",
        severity: "major",
      },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "Postherpetic neuralgia",
        dose: "300 mg",
        frequency: "TID",
        maxDose: "1,800 mg/day",
        notes:
          "Start 300 mg on day 1, 300 mg BID on day 2, 300 mg TID on day 3.",
      },
    ],
    pharmacokinetics: {
      halfLife: "5–7 hours",
      tMax: "2–3 hours",
      bioavailability: "Saturable, decreases with dose (≈ 60% at 300 mg)",
      proteinBinding: "< 3%",
      metabolism: "Not metabolized",
      excretion: "Renal (unchanged)",
    },
    approvalHistory: [
      {
        date: "1993-12-30",
        applicationNumber: "NDA020235",
        type: "NDA",
        sponsor: "Parke-Davis",
      },
    ],
    patientSummary:
      "Gabapentin treats nerve pain and certain seizures. Doses must be adjusted in kidney disease. Common side effects include drowsiness and dizziness.",
    identifiers: {
      rxcui: "25480",
      ndc: ["0071-0805", "0071-0806"],
      atc: ["N03AX12"],
      drugbank: "DB00996",
      chembl: "CHEMBL940",
      pubchem: "3446",
      unii: "6CW7F3G59X",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("gabapentin"),
      extractor: "openfda",
    }),
  },

  // ─────────────────────────────────────────────────────────────────── 9
  {
    slug: "hydrochlorothiazide",
    name: "Hydrochlorothiazide",
    synonyms: ["HCTZ"],
    jurisdiction: "US-FDA",
    ingredients: [
      {
        slug: "hydrochlorothiazide",
        name: "Hydrochlorothiazide",
        strength: "25 mg",
      },
    ],
    brands: ["Microzide", "Esidrix"],
    classes: [
      { slug: "thiazide-diuretic", name: "Thiazide Diuretic", kind: "epc" },
    ],
    shortDescription:
      "Thiazide diuretic for hypertension and edema. Inhibits the Na+/Cl- symporter in the distal convoluted tubule.",
    mechanism: {
      summary:
        "Inhibits the sodium-chloride symporter (NCC) in the distal convoluted tubule, increasing sodium, chloride, and water excretion and reducing plasma volume.",
      targets: ["Sodium-chloride symporter (SLC12A3)"],
    },
    indications: [
      { text: "Essential hypertension", icd10: ["I10"] },
      {
        text: "Edema associated with heart failure or cirrhosis",
        icd10: ["I50", "K70.31"],
      },
    ],
    contraindications: [
      {
        text: "Anuria or severe renal impairment (eGFR < 30 mL/min/1.73m²)",
        severity: "contraindicated",
      },
      {
        text: "Known hypersensitivity to thiazides or sulfonamide-derived drugs",
        severity: "major",
      },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "Hypertension",
        dose: "12.5–25 mg",
        frequency: "once daily",
        maxDose: "50 mg/day",
        notes: "Doses above 25 mg/day rarely add benefit but increase adverse effects.",
      },
    ],
    pharmacokinetics: {
      halfLife: "6–15 hours",
      tMax: "1–5 hours",
      bioavailability: "60–80%",
      proteinBinding: "≈ 40%",
      metabolism: "Not metabolized",
      excretion: "Renal (unchanged)",
    },
    approvalHistory: [
      {
        date: "1959-02-19",
        applicationNumber: "NDA011928",
        type: "NDA",
        sponsor: "Merck",
      },
    ],
    patientSummary:
      "Hydrochlorothiazide is a water pill that lowers blood pressure and reduces swelling. Take it in the morning. Your clinician may monitor potassium and kidney function.",
    identifiers: {
      rxcui: "5487",
      ndc: ["0054-0480", "0054-3208"],
      atc: ["C03AA03"],
      drugbank: "DB00999",
      chembl: "CHEMBL435",
      pubchem: "3639",
      unii: "0J48LPH2TH",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("hydrochlorothiazide"),
      extractor: "openfda",
    }),
  },

  // ─────────────────────────────────────────────────────────────────── 10
  {
    slug: "ibuprofen",
    name: "Ibuprofen",
    synonyms: ["α-methyl-4-(2-methylpropyl)benzeneacetic acid"],
    jurisdiction: "US-FDA",
    ingredients: [{ slug: "ibuprofen", name: "Ibuprofen", strength: "200 mg" }],
    brands: ["Advil", "Motrin", "Nuprin"],
    classes: [
      {
        slug: "nsaid",
        name: "Nonsteroidal Anti-inflammatory Drug",
        kind: "epc",
      },
    ],
    shortDescription:
      "Non-selective NSAID with analgesic, antipyretic, and anti-inflammatory activity via COX inhibition.",
    mechanism: {
      summary:
        "Non-selectively inhibits cyclooxygenase (COX-1 and COX-2), reducing prostaglandin synthesis. Decreases peripheral and central sensitization to pain and lowers fever via hypothalamic effect.",
      targets: ["COX-1 (PTGS1)", "COX-2 (PTGS2)"],
    },
    indications: [
      { text: "Mild to moderate pain", icd10: ["R52"] },
      { text: "Fever", icd10: ["R50.9"] },
      { text: "Primary dysmenorrhea", icd10: ["N94.4"] },
      {
        text: "Symptomatic relief of osteoarthritis and rheumatoid arthritis",
        icd10: ["M15", "M06"],
      },
    ],
    contraindications: [
      {
        text: "History of asthma, urticaria, or allergic-type reaction after NSAIDs",
        severity: "contraindicated",
      },
      {
        text: "Use during coronary artery bypass graft (CABG) surgery",
        severity: "contraindicated",
      },
      { text: "Third trimester of pregnancy", severity: "contraindicated" },
    ],
    dosing: [
      {
        route: "oral",
        population: "adult",
        condition: "Pain or fever",
        dose: "200–400 mg",
        frequency: "every 4–6 hours as needed",
        maxDose: "1,200 mg/day OTC; 3,200 mg/day Rx",
        notes: "Take with food or milk to reduce GI upset.",
      },
    ],
    pharmacokinetics: {
      halfLife: "1.8–2 hours",
      tMax: "1–2 hours",
      bioavailability: "80–100%",
      proteinBinding: "> 99%",
      metabolism: "Hepatic (CYP2C9)",
      excretion: "Renal (as metabolites)",
    },
    approvalHistory: [
      {
        date: "1974-09-19",
        applicationNumber: "NDA017463",
        type: "NDA",
        sponsor: "Boots / Upjohn",
      },
    ],
    patientSummary:
      "Ibuprofen relieves pain, reduces fever, and treats inflammation. Take it with food to lower the chance of stomach upset. Use the lowest dose for the shortest time.",
    identifiers: {
      rxcui: "5640",
      ndc: ["0573-0164", "0573-0165"],
      atc: ["M01AE01"],
      drugbank: "DB01050",
      chembl: "CHEMBL521",
      pubchem: "3672",
      unii: "WK2XYI10QM",
    },
    provenance: mockProvenance({
      sourceUrl: fdaLabel("ibuprofen"),
      extractor: "openfda",
    }),
  },
];

export const MOCK_DRUGS_BY_SLUG: Record<string, Drug> = Object.fromEntries(
  MOCK_DRUGS.map((d) => [d.slug, d]),
);
