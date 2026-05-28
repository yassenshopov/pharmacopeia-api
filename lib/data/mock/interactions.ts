import type { Interaction } from "@/lib/schemas";
import { mockProvenance } from "./provenance";

const provenance = mockProvenance({
  sourceUrl: "https://api.fda.gov/drug/label.json",
  extractor: "openfda",
  confidence: 0.92,
});

/**
 * Canonical-ordered drug pairs (drugA < drugB lexicographically).
 *
 * These are illustrative MVP entries — the Stage-5 LLM pipeline will
 * replace this list with structured pairs extracted from the
 * "Drug Interactions" section of each FDA label.
 */
export const MOCK_INTERACTIONS: Interaction[] = [
  {
    drugA: "ibuprofen",
    drugB: "lisinopril",
    severity: "major",
    mechanism:
      "NSAIDs inhibit prostaglandin-mediated renal vasodilation, blunting ACE inhibitor antihypertensive effect and increasing risk of acute kidney injury, especially in volume-depleted patients.",
    description:
      "Concurrent use of ibuprofen and lisinopril may reduce the blood-pressure-lowering effect of lisinopril and increase the risk of acute kidney injury.",
    recommendation:
      "Avoid chronic concomitant use. Monitor renal function and blood pressure if combination is necessary.",
    evidenceSpan:
      "FDA label, Drug Interactions section: 'Nonsteroidal Anti-inflammatory Drugs including Selective Cyclooxygenase-2 Inhibitors (COX-2 Inhibitors)'",
    provenance,
  },
  {
    drugA: "hydrochlorothiazide",
    drugB: "ibuprofen",
    severity: "moderate",
    mechanism:
      "NSAIDs may attenuate diuretic and antihypertensive effects via inhibition of renal prostaglandin synthesis and sodium retention.",
    description:
      "Ibuprofen may reduce the diuretic and antihypertensive effects of hydrochlorothiazide.",
    recommendation:
      "Monitor blood pressure and renal function during concurrent use; ensure adequate hydration.",
    provenance,
  },
  {
    drugA: "ibuprofen",
    drugB: "sertraline",
    severity: "moderate",
    mechanism:
      "Combined platelet dysfunction: SSRIs impair platelet serotonin uptake while NSAIDs inhibit COX-1-mediated thromboxane synthesis. Additive bleeding risk.",
    description:
      "Concomitant use of an SSRI and an NSAID increases the risk of bleeding, particularly upper gastrointestinal bleeding.",
    recommendation:
      "Use with caution. Consider gastroprotection (e.g., PPI) if combination is required. Counsel patients on bleeding signs.",
    provenance,
  },
  {
    drugA: "amlodipine",
    drugB: "atorvastatin",
    severity: "moderate",
    mechanism:
      "Amlodipine is a moderate CYP3A4 inhibitor and may increase atorvastatin plasma concentrations, raising risk of statin-related myopathy.",
    description:
      "Amlodipine modestly increases atorvastatin exposure. The FDA recommends limiting atorvastatin to 20 mg/day when co-administered with amlodipine.",
    recommendation:
      "Limit atorvastatin to 20 mg/day in patients receiving amlodipine. Counsel patients on muscle symptoms.",
    provenance,
  },
  {
    drugA: "hydrochlorothiazide",
    drugB: "lisinopril",
    severity: "minor",
    mechanism:
      "Additive antihypertensive effect. Frequently combined intentionally; risk of first-dose hypotension if initiated together without titration.",
    description:
      "Lisinopril and hydrochlorothiazide are commonly co-prescribed and have additive blood-pressure-lowering effects.",
    recommendation:
      "Initiate at low doses and titrate gradually; monitor for hypotension, hyperkalemia, and renal function.",
    provenance,
  },
  {
    drugA: "omeprazole",
    drugB: "sertraline",
    severity: "minor",
    mechanism:
      "Omeprazole inhibits CYP2C19, modestly increasing sertraline exposure.",
    description:
      "Co-administration may produce a small increase in sertraline plasma levels with limited clinical significance for most patients.",
    recommendation:
      "No dose adjustment routinely required; monitor for serotonergic side effects.",
    provenance,
  },
];
