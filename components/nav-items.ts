export type NavLink = {
  href: string;
  label: string;
  description?: string;
};

export type NavItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "group"; label: string; items: ReadonlyArray<NavLink> };

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { kind: "link", href: "/drugs", label: "Drugs" },
  {
    kind: "group",
    label: "Classes",
    items: [
      {
        href: "/classes",
        label: "All classes",
        description: "RxClass: FDA EPC, WHO ATC, MoA, MeSH",
      },
      {
        href: "/atc",
        label: "ATC",
        description: "WHO Anatomical Therapeutic Chemical tree",
      },
      {
        href: "/moa",
        label: "MoA",
        description: "Mechanism of action",
      },
    ],
  },
  { kind: "link", href: "/ingredients", label: "Ingredients" },
  { kind: "link", href: "/brands", label: "Brands" },
  {
    kind: "group",
    label: "Tools",
    items: [
      {
        href: "/interactions",
        label: "Interactions",
        description: "Pairwise interaction check, severity-graded",
      },
      {
        href: "/compare",
        label: "Compare",
        description: "Side-by-side drug comparison",
      },
      {
        href: "/structure-search",
        label: "Structure search",
        description: "Paste a SMILES, find the nearest drugs by Tanimoto",
      },
    ],
  },
  {
    kind: "group",
    label: "Docs",
    items: [
      {
        href: "/docs",
        label: "Documentation",
        description: "Endpoint reference, conventions, quickstart",
      },
      {
        href: "/reference",
        label: "API reference",
        description: "Interactive Scalar reference over the OpenAPI 3.1 spec",
      },
      {
        href: "/api/graphql",
        label: "GraphQL",
        description: "Field-selected GraphQL surface with GraphiQL IDE",
      },
      {
        href: "/api/v1/openapi.json",
        label: "OpenAPI spec",
        description: "Raw openapi.json — feed it to your favourite client",
      },
    ],
  },
];
