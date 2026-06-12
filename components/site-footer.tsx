import Link from "next/link";
import { ArrowUpRight, Coffee, FileJson, Rss } from "lucide-react";

import { ProvenanceBadgeSample } from "@/components/provenance-badge";

/**
 * Brand marks. lucide-react dropped GitHub/LinkedIn icons over
 * trademark concerns, so we inline the SVG paths. Matches the GitHub
 * mark already inlined in <SiteHeader />.
 */
function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.02 3.26 9.27 7.78 10.77.57.1.78-.25.78-.55 0-.27-.01-1.18-.02-2.14-3.17.69-3.84-1.35-3.84-1.35-.52-1.33-1.27-1.68-1.27-1.68-1.03-.71.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.02 1.74 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.53-.29-5.19-1.27-5.19-5.64 0-1.25.45-2.27 1.17-3.07-.12-.29-.51-1.45.11-3.03 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.74.11 3.03.73.8 1.17 1.82 1.17 3.07 0 4.38-2.67 5.35-5.21 5.63.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.13 0 .3.21.66.79.55 4.51-1.5 7.77-5.75 7.77-10.77C23.33 5.56 18.27.5 12 .5z" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

const linkClass =
  "rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

const headingClass =
  "mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/80";

const externalRel = "noopener noreferrer";

type FooterLink = {
  href: string;
  label: string;
  /** Render as <a> instead of <Link>. Use for non-page routes (file
   * downloads, raw JSON, external feeds) where a hard navigation is
   * the honest behavior. */
  raw?: boolean;
};

const exploreLinks: ReadonlyArray<FooterLink> = [
  { href: "/drugs", label: "Drugs" },
  { href: "/classes", label: "Classes" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/brands", label: "Brands" },
  { href: "/conditions", label: "Conditions" },
  { href: "/reactions", label: "Reactions" },
  { href: "/atc", label: "ATC tree" },
  { href: "/moa", label: "Mechanisms" },
  { href: "/interactions", label: "Interactions" },
  { href: "/compare", label: "Compare" },
  { href: "/structure-search", label: "Structure search" },
];

const developerLinks: ReadonlyArray<FooterLink> = [
  { href: "/docs", label: "Documentation" },
  { href: "/reference", label: "API reference" },
  { href: "/api/graphql", label: "GraphQL" },
  { href: "/api/v1/openapi.json", label: "OpenAPI 3.1 spec", raw: true },
  { href: "/data", label: "Bulk data" },
  { href: "/changelog", label: "Changelog" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/faq", label: "FAQ" },
  { href: "/glossary", label: "Glossary" },
];

const sourceLinks: ReadonlyArray<FooterLink> = [
  { href: "https://open.fda.gov", label: "openFDA" },
  { href: "https://rxnav.nlm.nih.gov", label: "RxNorm / RxNav" },
  { href: "https://dailymed.nlm.nih.gov", label: "DailyMed" },
  {
    href: "https://go.drugbank.com/releases/latest#open-data",
    label: "DrugBank Open",
  },
];

type Social = {
  href: string;
  label: string;
  external: boolean;
  icon: React.ReactNode;
};

const socialLinks: ReadonlyArray<Social> = [
  {
    href: "https://github.com/yassenshopov",
    label: "GitHub",
    external: true,
    icon: <GithubIcon className="h-4 w-4" />,
  },
  {
    href: "/feed.xml",
    label: "RSS feed",
    external: false,
    icon: <Rss className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/api/v1/openapi.json",
    label: "OpenAPI 3.1 spec",
    external: false,
    icon: <FileJson className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "https://linkedin.com/in/yassenshopov",
    label: "LinkedIn",
    external: true,
    icon: <LinkedinIcon className="h-4 w-4" />,
  },
  {
    href: "https://buymeacoffee.com/yassenshopov",
    label: "Buy me a coffee",
    external: true,
    icon: <Coffee className="h-4 w-4" aria-hidden="true" />,
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">
          {/* ─── Brand ─────────────────────────────────────────────────── */}
          <div className="sm:col-span-2 lg:col-span-5">
            <Link
              href="/"
              aria-label="pharmacopeia — home"
              className="inline-flex items-center gap-2 rounded-md font-mono text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span
                aria-hidden="true"
                className="grid h-7 w-7 place-items-center rounded-md border border-primary/30 bg-primary/10 text-base font-semibold text-primary"
              >
                ℞
              </span>
              <span translate="no">pharmacopeia</span>
              <span
                className="text-xs font-normal text-muted-foreground"
                aria-hidden="true"
              >
                / v0 preview
              </span>
            </Link>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
              An open, developer-first reference API for medications.
              Educational and informational use only. Not for clinical
              decision-making.
            </p>
            <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted-foreground">
              AI-extracted content is marked with{" "}
              <ProvenanceBadgeSample
                kind="ai-extracted"
                label="AI-extracted"
                className="align-middle"
              />
              ; cite the linked source for any clinical use.
            </p>

            <ul
              aria-label="Social and feeds"
              className="mt-6 flex flex-wrap items-center gap-2"
            >
              {socialLinks.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    aria-label={s.label}
                    title={s.label}
                    target={s.external ? "_blank" : undefined}
                    rel={s.external ? externalRel : undefined}
                    className="grid h-9 w-9 place-items-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                  >
                    {s.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ─── Explore ───────────────────────────────────────────────── */}
          <nav aria-label="Explore" className="lg:col-span-2">
            <h2 className={headingClass}>Explore</h2>
            <ul className="space-y-2 text-sm">
              {exploreLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* ─── Developers ────────────────────────────────────────────── */}
          <nav aria-label="Developers" className="lg:col-span-2">
            <h2 className={headingClass}>Developers</h2>
            <ul className="space-y-2 text-sm">
              {developerLinks.map((l) => (
                <li key={l.href}>
                  {l.raw ? (
                    <a href={l.href} className={linkClass}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* ─── Sources ───────────────────────────────────────────────── */}
          <nav
            aria-label="Sources"
            className="sm:col-span-2 lg:col-span-3"
          >
            <h2 className={headingClass}>Sources</h2>
            <ul className="space-y-2 text-sm">
              {sourceLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel={externalRel}
                    className={`${linkClass} inline-flex items-center gap-1.5`}
                  >
                    {l.label}
                    <ArrowUpRight
                      className="h-3 w-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-prose text-xs leading-relaxed text-muted-foreground">
              Every record carries{" "}
              <Link
                href="/docs"
                className="rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                provenance
              </Link>
              : source URL, hash, extractor, and confidence.
            </p>
          </nav>
        </div>
      </div>

      {/* ─── Bottom bar ──────────────────────────────────────────────── */}
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col-reverse items-start justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <small>
            © 2026 pharmacopeia.dev — community project, not affiliated with
            any agency.
          </small>
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-2 py-0.5"
              aria-label="API status: operational"
              title="All systems operational"
            >
              <span aria-hidden="true" className="relative grid h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              </span>
              <span>operational</span>
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5"
              title="Current jurisdiction"
            >
              US-FDA
            </span>
            <span translate="no">v0.1.0-seed</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
