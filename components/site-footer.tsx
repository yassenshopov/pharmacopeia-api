import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-border/60 bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2 font-mono text-sm font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded-md border border-border/80 bg-foreground/5 text-sm">
              ℞
            </span>
            pharmacopeia
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            An open, developer-first reference API for medications.
            Educational and informational use only. Not for clinical
            decision-making.
          </p>
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Explore
          </div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/drugs"
                className="text-muted-foreground hover:text-foreground"
              >
                Drugs
              </Link>
            </li>
            <li>
              <Link
                href="/classes"
                className="text-muted-foreground hover:text-foreground"
              >
                Classes
              </Link>
            </li>
            <li>
              <Link
                href="/docs"
                className="text-muted-foreground hover:text-foreground"
              >
                Docs
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sources
          </div>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="https://open.fda.gov"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                openFDA
              </a>
            </li>
            <li>
              <a
                href="https://rxnav.nlm.nih.gov"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                RxNorm / RxNav
              </a>
            </li>
            <li>
              <a
                href="https://dailymed.nlm.nih.gov"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                DailyMed
              </a>
            </li>
            <li>
              <a
                href="https://go.drugbank.com/releases/latest#open-data"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                DrugBank Open
              </a>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Community
          </div>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                Contribute on GitHub
              </a>
            </li>
            <li>
              <a
                href="https://buymeacoffee.com"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                Buy me a coffee
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>© 2026 pharmacopeia.dev — community project, not affiliated with any agency</span>
          <span className="font-mono">v0.1.0-mock</span>
        </div>
      </div>
    </footer>
  );
}
