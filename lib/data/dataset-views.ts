import type {
  BrandEntry,
  Drug,
  DrugClass,
  DrugSummary,
} from "@/lib/schemas";
import { atcLevel2Name, atcLevel3Name } from "./atc-names";
import type {
  AtcGroup,
  AtcTreeNode,
  MechanismGraph,
  MechanismGraphLink,
  MechanismGraphNode,
  MechanismNodeType,
} from "./repository";

/**
 * Pure, backend-agnostic computations over the full dataset. Both the
 * static seed repository and the Postgres-backed repository feed their
 * record collections through these so the derived surfaces (brands
 * crosswalk, ATC explorer, MoA graph) are byte-identical regardless of
 * backend.
 */

/**
 * WHO ATC level-1 anatomical main groups. Static, canonical, and
 * complete (14 groups). RxClass only hands us the deeper subgroups, so
 * we supply the top level ourselves to anchor the hierarchy.
 */
export const ATC_LEVEL1: ReadonlyArray<{ letter: string; name: string }> = [
  { letter: "A", name: "Alimentary tract and metabolism" },
  { letter: "B", name: "Blood and blood forming organs" },
  { letter: "C", name: "Cardiovascular system" },
  { letter: "D", name: "Dermatologicals" },
  { letter: "G", name: "Genito-urinary system and sex hormones" },
  {
    letter: "H",
    name: "Systemic hormonal preparations, excluding sex hormones and insulins",
  },
  { letter: "J", name: "Antiinfectives for systemic use" },
  { letter: "L", name: "Antineoplastic and immunomodulating agents" },
  { letter: "M", name: "Musculo-skeletal system" },
  { letter: "N", name: "Nervous system" },
  {
    letter: "P",
    name: "Antiparasitic products, insecticides and repellents",
  },
  { letter: "R", name: "Respiratory system" },
  { letter: "S", name: "Sensory organs" },
  { letter: "V", name: "Various" },
];

export function toDrugSummary(d: Drug): DrugSummary {
  return {
    slug: d.slug,
    name: d.name,
    synonyms: d.synonyms,
    jurisdiction: d.jurisdiction,
    ingredients: d.ingredients,
    brands: d.brands,
    classes: d.classes,
    shortDescription: d.shortDescription,
  };
}

export function buildBrands(drugs: Drug[]): BrandEntry[] {
  const map = new Map<string, { brand: string; drugs: Map<string, string> }>();
  for (const d of drugs) {
    for (const brand of d.brands) {
      const key = brand.toLowerCase();
      let entry = map.get(key);
      if (!entry) {
        entry = { brand, drugs: new Map() };
        map.set(key, entry);
      }
      entry.drugs.set(d.slug, d.name);
    }
  }
  return [...map.values()]
    .map((e) => ({
      brand: e.brand,
      drugs: [...e.drugs.entries()]
        .map(([slug, name]) => ({ slug, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.brand.localeCompare(b.brand));
}

export function buildAtcGroups(classes: DrugClass[]): AtcGroup[] {
  const byLetter = new Map<string, DrugClass[]>();
  for (const c of classes) {
    if (c.kind !== "atc" || !c.code) continue;
    const letter = c.code[0].toUpperCase();
    const list = byLetter.get(letter) ?? [];
    list.push(c);
    byLetter.set(letter, list);
  }
  const groups: AtcGroup[] = [];
  for (const { letter, name } of ATC_LEVEL1) {
    const classList = byLetter.get(letter);
    if (!classList || classList.length === 0) continue;
    classList.sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
    groups.push({ letter, name, classes: classList });
  }
  return groups;
}

export function buildAtcTree(
  drugs: Drug[],
  classes: DrugClass[],
): AtcTreeNode[] {
  // Level-4 substances first: which drugs carry which level-4 code.
  const drugsByL4 = new Map<string, { slug: string; name: string }[]>();
  for (const d of drugs) {
    const codes = new Set<string>();
    for (const c of d.classes) {
      if (c.kind === "atc" && c.code) codes.add(c.code);
    }
    for (const code of d.identifiers.atc) codes.add(code);
    for (const code of codes) {
      const list = drugsByL4.get(code) ?? [];
      list.push({ slug: d.slug, name: d.name });
      drugsByL4.set(code, list);
    }
  }

  const l1Name = new Map(ATC_LEVEL1.map((g) => [g.letter, g.name]));
  const roots = new Map<string, AtcTreeNode>();

  const ensure = (
    map: Map<string, AtcTreeNode>,
    code: string,
    level: 1 | 2 | 3 | 4,
    name: string,
    slug?: string,
  ): AtcTreeNode => {
    let node = map.get(code);
    if (!node) {
      node = { code, level, name, slug, children: [], drugCount: 0 };
      map.set(code, node);
    }
    return node;
  };

  const childMap = (parent: AtcTreeNode): Map<string, AtcTreeNode> => {
    // Lazily index this parent's children by code for O(1) lookup.
    const m = new Map<string, AtcTreeNode>();
    for (const child of parent.children) m.set(child.code, child);
    return m;
  };

  for (const cls of classes) {
    if (cls.kind !== "atc" || !cls.code || cls.code.length < 5) continue;
    const code = cls.code;
    const l1 = code[0];
    const l2 = code.slice(0, 3);
    const l3 = code.slice(0, 4);

    const l1Node = ensure(roots, l1, 1, l1Name.get(l1) ?? l1);
    const l2Map = childMap(l1Node);
    const before2 = l2Map.size;
    const l2Node = ensure(l2Map, l2, 2, atcLevel2Name(l2));
    if (l2Map.size !== before2) l1Node.children.push(l2Node);

    const l3Map = childMap(l2Node);
    const before3 = l3Map.size;
    const l3Node = ensure(l3Map, l3, 3, atcLevel3Name(l3));
    if (l3Map.size !== before3) l2Node.children.push(l3Node);

    const l4Node: AtcTreeNode = {
      code,
      level: 4,
      name: cls.name,
      slug: cls.slug,
      drugCount: 0,
      children: [],
    };
    l3Node.children.push(l4Node);

    const substances = drugsByL4.get(code) ?? [];
    substances.sort((a, b) => a.name.localeCompare(b.name));
    for (const s of substances) {
      l4Node.children.push({
        code: s.slug,
        level: 5,
        name: s.name,
        slug: s.slug,
        drugCount: 1,
        children: [],
      });
    }
    l4Node.drugCount = substances.length;
  }

  // Roll drug counts up the tree and sort every level by code/name.
  const finalize = (node: AtcTreeNode): number => {
    if (node.level === 5) return 1;
    let total = 0;
    for (const child of node.children) total += finalize(child);
    if (node.level === 4) total = node.drugCount;
    else node.drugCount = total;
    node.children.sort((a, b) =>
      node.level >= 4
        ? a.name.localeCompare(b.name)
        : a.code.localeCompare(b.code),
    );
    return total;
  };

  const result = [...roots.values()];
  for (const root of result) finalize(root);
  result.sort((a, b) => a.code.localeCompare(b.code));
  return result;
}

export function buildMechanismGraph(drugs: Drug[]): MechanismGraph {
  const nodes = new Map<string, MechanismGraphNode>();
  const linkSet = new Set<string>();
  const links: MechanismGraphLink[] = [];

  const addNode = (
    id: string,
    type: MechanismNodeType,
    label: string,
    extra?: { slug?: string; group?: string },
  ) => {
    let node = nodes.get(id);
    if (!node) {
      node = { id, type, label, degree: 0, ...extra };
      nodes.set(id, node);
    }
    return node;
  };

  const addLink = (
    source: string,
    target: string,
    kind: MechanismGraphLink["kind"],
  ) => {
    const key = `${source}|${target}`;
    if (linkSet.has(key)) return;
    linkSet.add(key);
    links.push({ source, target, kind });
    const s = nodes.get(source);
    const t = nodes.get(target);
    if (s) s.degree += 1;
    if (t) t.degree += 1;
  };

  for (const d of drugs) {
    const atcLetter = d.classes.find((c) => c.kind === "atc" && c.code)
      ?.code?.[0];
    const drugId = `drug:${d.slug}`;
    addNode(drugId, "drug", d.name, { slug: d.slug, group: atcLetter });

    for (const c of d.classes) {
      if (c.kind !== "moa") continue;
      const moaId = `moa:${c.slug}`;
      addNode(moaId, "moa", c.name, { slug: c.slug });
      addLink(drugId, moaId, "member");
    }

    for (const target of d.mechanism?.targets ?? []) {
      const clean = target.trim();
      if (!clean) continue;
      const targetId = `target:${clean.toLowerCase()}`;
      addNode(targetId, "target", clean);
      addLink(drugId, targetId, "target");
    }
  }

  return { nodes: [...nodes.values()], links };
}
