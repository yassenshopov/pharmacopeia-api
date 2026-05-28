import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { getRepository } from "@/lib/data/repository";

export const metadata: Metadata = {
  title: "Drug classes",
  description:
    "Browse pharmacological classes — ATC, EPC, MoA, MeSH — with the drugs they contain.",
};

export default async function ClassesPage() {
  const { items: classes, pagination } = await getRepository().listClasses({
    limit: 200,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-12 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Classes</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {pagination.total} total
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Pharmacological classifications from RxClass (FDA EPC, WHO ATC, MoA,
          MeSH). Each class lists the drugs that belong to it.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/classes/${c.slug}`}
              className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-5 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1 font-semibold">
                    {c.name}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <code className="text-xs text-muted-foreground">
                    {c.slug}
                  </code>
                </div>
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {c.kind}
                </Badge>
              </div>
              {c.description && (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                  {c.description}
                </p>
              )}
              <div className="mt-4 text-xs text-muted-foreground">
                {c.drugCount} {c.drugCount === 1 ? "drug" : "drugs"}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
