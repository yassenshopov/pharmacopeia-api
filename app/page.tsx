import Link from "next/link";
import { ArrowRight, BookOpen, FlaskConical, GitBranch, Layers, Search, Sparkles } from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { getRepository } from "@/lib/data/repository";

const SAMPLE_RESPONSE = `{
  "slug": "metformin",
  "name": "Metformin",
  "jurisdiction": "US-FDA",
  "classes": [
    { "slug": "biguanide", "name": "Biguanide", "kind": "epc" }
  ],
  "mechanism": {
    "summary": "Decreases hepatic glucose production via inhibition of mitochondrial glycerophosphate dehydrogenase \u2026",
    "targets": ["AMP-activated protein kinase (AMPK)"]
  },
  "indications": [
    { "text": "Type 2 diabetes mellitus", "icd10": ["E11"] }
  ],
  "identifiers": {
    "rxcui": "6809",
    "atc": ["A10BA02"],
    "drugbank": "DB00331"
  }
}`;

const SAMPLE_FETCH = `// Fetch a single drug
const res = await fetch(
  "https://pharmacopeia.dev/api/v1/drug/metformin",
);
const drug = await res.json();`;

export default async function Home() {
  const stats = await getRepository().getStats();

  return (
    <div>
      {/* ─────────────────────────────── Hero */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
          <Badge
            variant="outline"
            className="mb-8 font-mono text-xs font-normal"
          >
            v0 · early preview
          </Badge>

          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-6 grid h-14 w-14 place-items-center rounded-lg border border-border/80 bg-foreground/5 font-mono text-2xl">
                ℞
              </div>
              <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                An open API for medications
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Drugs, classes, interactions, indications — structured,
                versioned, free. A developer-first reference layer for the
                world&apos;s pharmacopeia. Inspired by{" "}
                <a
                  href="https://pokeapi.co"
                  className="text-foreground underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  PokeAPI
                </a>
                .
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/docs"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  Read the docs
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/drugs"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Browse drugs
                </Link>
              </div>
            </div>

            {/* Stat counters */}
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-2 lg:max-w-md">
              <StatCard
                label="Drugs"
                value={stats.drugs}
                sublabel={`${stats.drugs} FDA · 0 EMA`}
              />
              <StatCard
                label="Classes"
                value={stats.classes}
                sublabel="ATC · EPC · MoA"
              />
              <StatCard
                label="Ingredients"
                value={stats.ingredients}
                sublabel="Active substances"
              />
              <StatCard
                label="Interactions"
                value={stats.interactions}
                sublabel="Curated drug pairs"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Sample */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-balance text-3xl font-semibold tracking-tight">
              One fetch away from every prescription.
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              Predictable URLs. JSON in, JSON out. Every response is validated
              with{" "}
              <a
                href="https://zod.dev"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline-offset-4 hover:underline"
              >
                Zod
              </a>{" "}
              against the same schema that generates these docs, so the shape
              never surprises you.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <CodeBlock
              code={SAMPLE_RESPONSE}
              label="GET /api/v1/drug/metformin"
              language="json"
            />
            <CodeBlock
              code={SAMPLE_FETCH}
              label="JavaScript / TypeScript"
              language="ts"
            />
          </div>

          <ul className="mt-10 grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 flex-none text-foreground" />
              Strongly-typed schema for drugs, classes, interactions, and indications.
            </li>
            <li className="flex items-start gap-2">
              <GitBranch className="mt-0.5 h-4 w-4 flex-none text-foreground" />
              Open data — every entity has a verifiable source URL and hash.
            </li>
            <li className="flex items-start gap-2">
              <BookOpen className="mt-0.5 h-4 w-4 flex-none text-foreground" />
              Generated docs from the same Zod schema that runs the API.
            </li>
          </ul>
        </div>
      </section>

      {/* ─────────────────────────────── Start here */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Start here</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            A few jumping-off points while v0 is still small.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StartCard
              href="/docs"
              icon={<BookOpen className="h-5 w-5" />}
              title="Quickstart"
              body="Make your first request in under a minute."
            />
            <StartCard
              href="/drugs"
              icon={<FlaskConical className="h-5 w-5" />}
              title="Browse drugs"
              body={`${stats.drugs} medications with mechanism, dosing, and identifiers.`}
            />
            <StartCard
              href="/classes"
              icon={<Layers className="h-5 w-5" />}
              title="Browse classes"
              body={`${stats.classes} pharmacological classes (ATC, EPC, MoA).`}
            />
            <StartCard
              href="/drugs/metformin"
              icon={<Sparkles className="h-5 w-5" />}
              title="Example: metformin"
              body="A complete drug entity with every field populated."
            />
            <StartCard
              href="/docs#interactions"
              icon={<GitBranch className="h-5 w-5" />}
              title="Check interactions"
              body="POST a list of drugs, get back severity-graded pairs."
            />
            <StartCard
              href="/docs#search"
              icon={<Search className="h-5 w-5" />}
              title="Search"
              body="Find drugs, ingredients, and classes by name, brand, or synonym."
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Closing */}
      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="max-w-2xl text-balance text-2xl font-semibold tracking-tight">
            A community project, made by and for the people who build with
            medical data.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            pharmacopeia is unaffiliated with the FDA, NIH, or any regulatory
            agency. We host structured facts (mechanism, identifiers, dosing)
            and link out to the canonical source for every field. Educational
            and informational use only.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              How to contribute
            </a>
            <Link
              href="/docs"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              Get started
            </Link>
            <a
              href="https://buymeacoffee.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              Buy me a coffee
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function StartCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-border/80 bg-card/40 p-5 transition-colors hover:bg-accent/50"
    >
      <div className="mb-4 grid h-9 w-9 place-items-center rounded-md border border-border/80 bg-foreground/5 text-foreground">
        {icon}
      </div>
      <div className="flex items-center gap-1 font-medium">
        {title}
        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
