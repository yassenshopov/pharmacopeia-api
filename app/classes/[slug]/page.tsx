import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getRepository } from "@/lib/data/repository";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cls = await getRepository().getClass(slug);
  if (!cls) return { title: "Not found" };
  return { title: cls.name, description: cls.description };
}

export default async function ClassDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();
  const cls = await repo.getClass(slug);
  if (!cls) notFound();

  const { items: drugs } = await repo.listDrugs({
    classSlug: slug,
    limit: 200,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/classes" className="hover:text-foreground">
          classes
        </Link>
        <span>/</span>
        <code className="font-mono">{cls.slug}</code>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">{cls.name}</h1>
          {cls.description && (
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {cls.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="font-mono uppercase">
              {cls.kind}
            </Badge>
            {cls.code && (
              <Badge variant="outline" className="font-mono">
                {cls.code}
              </Badge>
            )}
            {cls.parent && (
              <Link href={`/classes/${cls.parent.slug}`}>
                <Badge variant="outline" className="hover:bg-accent">
                  parent · {cls.parent.name}
                </Badge>
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card/40 p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">GET</div>
          <code>/api/v1/class/{cls.slug}</code>
        </div>
      </div>

      <Separator className="my-10" />

      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Drugs in this class ({drugs.length})
      </h2>

      <ul className="grid gap-3 sm:grid-cols-2">
        {drugs.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/drugs/${d.slug}`}
              className="group flex h-full flex-col rounded-lg border border-border/80 bg-card/40 p-4 transition-colors hover:bg-accent/50"
            >
              <span className="font-semibold">{d.name}</span>
              {d.shortDescription && (
                <span className="mt-1 text-sm text-muted-foreground">
                  {d.shortDescription}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Try the API
        </h2>
        <CodeBlock
          code={`curl https://pharmacopeia.dev/api/v1/class/${cls.slug}`}
          label="cURL"
          language="bash"
        />
      </div>
    </div>
  );
}
