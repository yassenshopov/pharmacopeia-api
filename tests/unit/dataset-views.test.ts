import { describe, expect, it } from "vitest";
import {
  buildAtcGroups,
  buildAtcTree,
  buildBrands,
  buildMechanismGraph,
  toDrugSummary,
} from "@/lib/data/dataset-views";
import type { DrugClass } from "@/lib/schemas";
import { makeDrug, TEST_PROVENANCE } from "../helpers/fixtures";

function makeClass(overrides: Partial<DrugClass> & Pick<DrugClass, "slug" | "name" | "kind">): DrugClass {
  return {
    drugCount: 0,
    provenance: TEST_PROVENANCE,
    ...overrides,
  };
}

describe("toDrugSummary", () => {
  it("keeps identity fields and drops heavy sections", () => {
    const drug = makeDrug({
      slug: "summary-drug",
      name: "Summary Drug",
      mechanism: { summary: "Does things.", targets: [] },
      shortDescription: "A drug.",
    });
    const summary = toDrugSummary(drug);
    expect(summary).toEqual({
      slug: "summary-drug",
      name: "Summary Drug",
      synonyms: [],
      jurisdiction: "US-FDA",
      ingredients: drug.ingredients,
      brands: [],
      classes: [],
      shortDescription: "A drug.",
    });
    expect(summary).not.toHaveProperty("mechanism");
  });
});

describe("buildBrands", () => {
  it("groups case-insensitively, dedupes drugs, and sorts both levels", () => {
    const a = makeDrug({ slug: "drug-a", name: "Zeta", brands: ["Brandex", "Other"] });
    const b = makeDrug({ slug: "drug-b", name: "Alpha", brands: ["BRANDEX"] });
    const entries = buildBrands([a, b]);

    expect(entries.map((e) => e.brand)).toEqual(["Brandex", "Other"]);
    const brandex = entries[0];
    // Drugs sorted by name: Alpha before Zeta.
    expect(brandex.drugs).toEqual([
      { slug: "drug-b", name: "Alpha" },
      { slug: "drug-a", name: "Zeta" },
    ]);
  });

  it("returns an empty list for drugs without brands", () => {
    expect(buildBrands([makeDrug({ slug: "x", name: "X" })])).toEqual([]);
  });
});

describe("buildAtcGroups", () => {
  it("buckets ATC classes by first letter using WHO level-1 names", () => {
    const classes = [
      makeClass({ slug: "ace-inhibitors", name: "ACE Inhibitors", kind: "atc", code: "C09AA" }),
      makeClass({ slug: "biguanides", name: "Biguanides", kind: "atc", code: "A10BA" }),
      // Non-ATC kinds and codeless classes are excluded.
      makeClass({ slug: "some-moa", name: "Some MoA", kind: "moa" }),
      makeClass({ slug: "codeless", name: "Codeless", kind: "atc" }),
    ];
    const groups = buildAtcGroups(classes);
    expect(groups.map((g) => g.letter)).toEqual(["A", "C"]);
    expect(groups[0].name).toBe("Alimentary tract and metabolism");
    expect(groups[0].classes.map((c) => c.slug)).toEqual(["biguanides"]);
    expect(groups[1].classes.map((c) => c.slug)).toEqual(["ace-inhibitors"]);
  });
});

describe("buildAtcTree", () => {
  const classes = [
    makeClass({ slug: "ace-inhibitors", name: "ACE inhibitors, plain", kind: "atc", code: "C09AA" }),
    makeClass({ slug: "arbs", name: "ARBs, plain", kind: "atc", code: "C09CA" }),
  ];
  const drugs = [
    makeDrug({
      slug: "lisinopril-like",
      name: "Lisinopril-like",
      classes: [{ slug: "ace-inhibitors", name: "ACE inhibitors, plain", kind: "atc", code: "C09AA" }],
    }),
    makeDrug({
      slug: "enalapril-like",
      name: "Enalapril-like",
      identifiers: { ndc: [], atc: ["C09AA"] },
    }),
  ];

  it("builds levels 1→5 and rolls drug counts up the tree", () => {
    const tree = buildAtcTree(drugs, classes);
    expect(tree).toHaveLength(1);

    const root = tree[0];
    expect(root).toMatchObject({ code: "C", level: 1, drugCount: 2 });

    const l2 = root.children[0];
    expect(l2).toMatchObject({ code: "C09", level: 2 });

    const l3 = l2.children[0];
    expect(l3).toMatchObject({ code: "C09A", level: 3 });

    const l4s = l2.children.flatMap((n) => n.children);
    const ace = l4s.find((n) => n.code === "C09AA");
    expect(ace).toMatchObject({
      level: 4,
      slug: "ace-inhibitors",
      drugCount: 2,
    });
    // Level-5 substances sorted by name.
    expect(ace?.children.map((c) => c.name)).toEqual([
      "Enalapril-like",
      "Lisinopril-like",
    ]);

    // A class with no member drugs still appears, with zero count.
    const arbs = l4s.find((n) => n.code === "C09CA");
    expect(arbs).toMatchObject({ level: 4, drugCount: 0 });
  });

  it("ignores classes whose code is shorter than level 4", () => {
    const shallow = [makeClass({ slug: "cardio", name: "Cardio", kind: "atc", code: "C09" })];
    expect(buildAtcTree([], shallow)).toEqual([]);
  });
});

describe("buildMechanismGraph", () => {
  const moaRef = {
    slug: "ace-inhibitor-moa",
    name: "ACE Inhibitor MoA",
    kind: "moa",
  } as const;
  const drugs = [
    makeDrug({
      slug: "drug-one",
      name: "Drug One",
      classes: [
        { ...moaRef },
        { slug: "c09aa", name: "ATC class", kind: "atc", code: "C09AA" },
      ],
      mechanism: { summary: "Inhibits ACE.", targets: ["ACE", " ace "] },
    }),
    makeDrug({
      slug: "drug-two",
      name: "Drug Two",
      classes: [{ ...moaRef }],
      mechanism: { summary: "Also inhibits ACE.", targets: ["ACE"] },
    }),
  ];

  it("builds namespaced nodes, deduped case-insensitive targets, and degree counts", () => {
    const graph = buildMechanismGraph(drugs);
    const ids = graph.nodes.map((n) => n.id);
    expect(ids).toContain("drug:drug-one");
    expect(ids).toContain("drug:drug-two");
    expect(ids).toContain("moa:ace-inhibitor-moa");
    // "ACE" and " ace " collapse to one target node.
    expect(ids.filter((id) => id.startsWith("target:"))).toEqual([
      "target:ace",
    ]);

    const moa = graph.nodes.find((n) => n.id === "moa:ace-inhibitor-moa");
    expect(moa?.degree).toBe(2);
    const target = graph.nodes.find((n) => n.id === "target:ace");
    expect(target?.degree).toBe(2);

    // Drug one: member link + target link (dupe target link skipped).
    const one = graph.nodes.find((n) => n.id === "drug:drug-one");
    expect(one?.degree).toBe(2);
    expect(one?.group).toBe("C");

    expect(graph.links).toHaveLength(4);
    const kinds = new Set(graph.links.map((l) => l.kind));
    expect(kinds).toEqual(new Set(["member", "target"]));
  });

  it("skips non-moa classes and blank targets", () => {
    const graph = buildMechanismGraph([
      makeDrug({
        slug: "lonely",
        name: "Lonely",
        classes: [{ slug: "epc-class", name: "EPC", kind: "epc" }],
        mechanism: { summary: "???", targets: ["  "] },
      }),
    ]);
    expect(graph.nodes.map((n) => n.id)).toEqual(["drug:lonely"]);
    expect(graph.links).toEqual([]);
  });
});
