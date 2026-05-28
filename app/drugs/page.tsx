import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { getRepository } from "@/lib/data/repository";

export const metadata: Metadata = {
  title: "Drugs",
  description:
    "Browse all medications in the pharmacopeia. Each drug has mechanism, indications, dosing, identifiers, and provenance.",
};

export default async function DrugsPage() {
  const { items: drugs, pagination } = await getRepository().listDrugs({
    limit: 200,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-12 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Drugs</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {pagination.total} total
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Every entry includes its active ingredient, brand names,
          pharmacological class, indications, and crosswalks to RxNorm,
          DrugBank, ChEMBL, and ATC.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {drugs.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/drugs/${d.slug}`}
              className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-5 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1 font-semibold">
                    {d.name}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <code className="text-xs text-muted-foreground">
                    {d.slug}
                  </code>
                </div>
                {d.classes[0] && (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {d.classes[0].name}
                  </Badge>
                )}
              </div>
              {d.shortDescription && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {d.shortDescription}
                </p>
              )}
              {d.brands.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  {d.brands.slice(0, 4).map((b) => (
                    <span
                      key={b}
                      className="rounded-sm border border-border/60 px-1.5 py-0.5"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
