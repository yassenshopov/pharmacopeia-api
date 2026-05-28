import Link from "next/link";
import { ProvenanceBadgeSample } from "@/components/provenance-badge";

const linkClass =
  "rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

const externalRel = "noopener noreferrer";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-border/60 bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2 font-mono text-sm font-semibold">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 place-items-center rounded-md border border-border/80 bg-foreground/5 text-sm"
            >
              ℞
            </span>
            <span translate="no">pharmacopeia</span>
          </div>
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
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
        </div>

        <nav aria-label="Explore">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Explore
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/drugs" className={linkClass}>
                Drugs
              </Link>
            </li>
            <li>
              <Link href="/classes" className={linkClass}>
                Classes
              </Link>
            </li>
            <li>
              <Link href="/ingredients" className={linkClass}>
                Ingredients
              </Link>
            </li>
            <li>
              <Link href="/brands" className={linkClass}>
                Brands
              </Link>
            </li>
            <li>
              <Link href="/atc" className={linkClass}>
                ATC classification
              </Link>
            </li>
            <li>
              <Link href="/interactions" className={linkClass}>
                Interactions
              </Link>
            </li>
            <li>
              <Link href="/docs" className={linkClass}>
                Docs
              </Link>
            </li>
            <li>
              <Link href="/roadmap" className={linkClass}>
                Roadmap
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Sources">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sources
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="https://open.fda.gov"
                target="_blank"
                rel={externalRel}
                className={linkClass}
              >
                openFDA
              </a>
            </li>
            <li>
              <a
                href="https://rxnav.nlm.nih.gov"
                target="_blank"
                rel={externalRel}
                className={linkClass}
              >
                RxNorm / RxNav
              </a>
            </li>
            <li>
              <a
                href="https://dailymed.nlm.nih.gov"
                target="_blank"
                rel={externalRel}
                className={linkClass}
              >
                DailyMed
              </a>
            </li>
            <li>
              <a
                href="https://go.drugbank.com/releases/latest#open-data"
                target="_blank"
                rel={externalRel}
                className={linkClass}
              >
                DrugBank Open
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label="Community">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Community
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="https://github.com/yassenshopov"
                target="_blank"
                rel={externalRel}
                className={linkClass}
              >
                Contribute on GitHub
              </a>
            </li>
            <li>
              <a
                href="https://linkedin.com/in/yassenshopov"
                target="_blank"
                rel={externalRel}
                className={linkClass}
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                href="https://buymeacoffee.com/yassenshopov"
                target="_blank"
                rel={externalRel}
                className={linkClass}
              >
                Buy me a coffee
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <small>
            © 2026 pharmacopeia.dev — community project, not affiliated with
            any agency
          </small>
          <span className="font-mono" translate="no">
            v0.1.0-seed
          </span>
        </div>
      </div>
    </footer>
  );
}
