import type { DrugClass } from "@/lib/schemas";
import { mockProvenance } from "./provenance";

const provenance = mockProvenance({
  sourceUrl: "https://rxnav.nlm.nih.gov/REST/rxclass",
  extractor: "rxclass",
});

export const MOCK_CLASSES: DrugClass[] = [
  {
    slug: "biguanide",
    name: "Biguanide",
    kind: "epc",
    code: "N0000175722",
    description:
      "Antihyperglycemic agents that decrease hepatic glucose production and improve insulin sensitivity in peripheral tissues.",
    parent: null,
    drugCount: 1,
    provenance,
  },
  {
    slug: "ace-inhibitor",
    name: "ACE Inhibitor",
    kind: "epc",
    code: "N0000175562",
    description:
      "Drugs that inhibit angiotensin-converting enzyme, lowering blood pressure by reducing angiotensin II production.",
    parent: { slug: "antihypertensive", name: "Antihypertensive Agents" },
    drugCount: 1,
    provenance,
  },
  {
    slug: "statin",
    name: "HMG-CoA Reductase Inhibitor",
    kind: "epc",
    code: "N0000175581",
    description:
      "Lipid-lowering agents that competitively inhibit HMG-CoA reductase, the rate-limiting enzyme in cholesterol biosynthesis.",
    parent: null,
    drugCount: 1,
    provenance,
  },
  {
    slug: "thyroid-hormone",
    name: "Thyroid Hormone",
    kind: "epc",
    code: "N0000175861",
    description:
      "Synthetic or natural thyroid hormones used as replacement therapy in hypothyroidism.",
    parent: null,
    drugCount: 1,
    provenance,
  },
  {
    slug: "calcium-channel-blocker",
    name: "Calcium Channel Blocker",
    kind: "epc",
    code: "N0000175566",
    description:
      "Drugs that inhibit calcium influx through voltage-gated L-type calcium channels, producing vasodilation and reduced cardiac contractility.",
    parent: { slug: "antihypertensive", name: "Antihypertensive Agents" },
    drugCount: 1,
    provenance,
  },
  {
    slug: "proton-pump-inhibitor",
    name: "Proton Pump Inhibitor",
    kind: "epc",
    code: "N0000175751",
    description:
      "Irreversible inhibitors of the H+/K+ ATPase (proton pump) in gastric parietal cells, suppressing gastric acid secretion.",
    parent: null,
    drugCount: 1,
    provenance,
  },
  {
    slug: "ssri",
    name: "Selective Serotonin Reuptake Inhibitor",
    kind: "epc",
    code: "N0000175696",
    description:
      "Antidepressants that selectively inhibit the serotonin transporter (SERT), increasing synaptic serotonin availability.",
    parent: { slug: "antidepressant", name: "Antidepressants" },
    drugCount: 1,
    provenance,
  },
  {
    slug: "gabapentinoid",
    name: "Gabapentinoid",
    kind: "moa",
    code: "N0000182137",
    description:
      "Alpha-2-delta ligands of voltage-gated calcium channels, used as anticonvulsants and in neuropathic pain.",
    parent: null,
    drugCount: 1,
    provenance,
  },
  {
    slug: "thiazide-diuretic",
    name: "Thiazide Diuretic",
    kind: "epc",
    code: "N0000175859",
    description:
      "Diuretics that inhibit the Na+/Cl- symporter in the distal convoluted tubule, increasing sodium and water excretion.",
    parent: { slug: "antihypertensive", name: "Antihypertensive Agents" },
    drugCount: 1,
    provenance,
  },
  {
    slug: "nsaid",
    name: "Nonsteroidal Anti-inflammatory Drug",
    kind: "epc",
    code: "N0000175722",
    description:
      "Non-selective inhibitors of cyclooxygenase (COX-1 and COX-2), reducing prostaglandin synthesis and providing analgesic, antipyretic, and anti-inflammatory effects.",
    parent: null,
    drugCount: 1,
    provenance,
  },
];

export const MOCK_CLASSES_BY_SLUG: Record<string, DrugClass> = Object.fromEntries(
  MOCK_CLASSES.map((c) => [c.slug, c]),
);
