import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Toc, type TocItem } from "@/components/toc";
import { Separator } from "@/components/ui/separator";
import {
  FAQ_CATEGORY_LABEL,
  FAQ_CATEGORY_ORDER,
  FAQ_ITEMS,
  type FaqCategory,
} from "@/lib/content/faq";
import { getRepository } from "@/lib/data/repository";
import {
  articleJsonLd,
  faqPageJsonLd,
  jsonLdScriptProps,
} from "@/lib/seo/jsonld";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo/site";

const FAQ_PATH = "/faq";
const FAQ_TITLE = "FAQ";
const FAQ_DESCRIPTION =
  "Frequently asked questions about pharmacopeia — what it is, where the data comes from, how the API works, licensing, and how to contribute.";

const FAQ_OG_IMAGE = ogImageUrl({
  title: "FAQ",
  subtitle: "Frequently asked questions",
});

export const metadata: Metadata = {
  title: FAQ_TITLE,
  description: FAQ_DESCRIPTION,
  alternates: { canonical: absoluteUrl(FAQ_PATH) },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    title: FAQ_TITLE,
    description: FAQ_DESCRIPTION,
    url: absoluteUrl(FAQ_PATH),
    images: [
      {
        url: FAQ_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — frequently asked questions`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: FAQ_TITLE,
    description: FAQ_DESCRIPTION,
    images: [FAQ_OG_IMAGE],
  },
};

const FAQ_TOC: TocItem[] = FAQ_CATEGORY_ORDER.filter((category) =>
  FAQ_ITEMS.some((item) => item.category === category),
).map((category) => ({ id: category, label: FAQ_CATEGORY_LABEL[category] }));

export default async function FaqPage() {
  const stats = await getRepository().getStats();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <script
        {...jsonLdScriptProps([
          articleJsonLd({
            title: FAQ_TITLE,
            description: FAQ_DESCRIPTION,
            url: FAQ_PATH,
            dateModified: stats.updatedAt,
          }),
          faqPageJsonLd(
            FAQ_ITEMS.map((item) => ({
              question: item.question,
              answer: item.answer,
            })),
            FAQ_PATH,
          ),
        ])}
      />

      <Breadcrumbs items={[{ label: "FAQ" }]} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <header className="mb-12">
            <h1 className="text-4xl font-semibold tracking-tight">
              Frequently asked questions
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              What pharmacopeia is, where the data comes from, and how to use
              it. Still stuck? The{" "}
              <a
                href="/docs"
                className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                docs
              </a>{" "}
              cover the API in detail.
            </p>
          </header>

          {FAQ_TOC.map((entry) => (
            <FaqSection key={entry.id} category={entry.id as FaqCategory} />
          ))}

          <Separator className="mt-16 opacity-50" />
          <p className="mt-6 text-xs text-muted-foreground">
            pharmacopeia is for educational and informational use only. Nothing
            here is medical advice. Always verify against each record&apos;s
            cited source.
          </p>
        </div>
        <Toc items={FAQ_TOC} />
      </div>
    </div>
  );
}

function FaqSection({ category }: { category: FaqCategory }) {
  const items = FAQ_ITEMS.filter((item) => item.category === category);
  if (items.length === 0) return null;

  const title = FAQ_CATEGORY_LABEL[category];

  return (
    <section
      id={category}
      className="mt-14 scroll-mt-24"
      aria-labelledby={`${category}-title`}
    >
      <div className="mb-5 flex items-baseline gap-2">
        <h2
          id={`${category}-title`}
          className="text-2xl font-semibold tracking-tight"
        >
          {title}
        </h2>
        <a
          href={`#${category}`}
          aria-label={`Permalink to ${title}`}
          className="rounded-sm font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          <span aria-hidden="true">#</span>
        </a>
      </div>

      <dl className="space-y-6">
        {items.map((item) => (
          <div
            key={item.id}
            id={item.id}
            className="scroll-mt-24 rounded-lg border border-border/80 p-5"
          >
            <dt className="flex items-baseline gap-2">
              <h3 className="text-base font-medium leading-snug text-foreground">
                {item.question}
              </h3>
              <a
                href={`#${item.id}`}
                aria-label={`Permalink to: ${item.question}`}
                className="rounded-sm font-mono text-xs text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <span aria-hidden="true">#</span>
              </a>
            </dt>
            <dd className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {item.answer.split("\n\n").map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
