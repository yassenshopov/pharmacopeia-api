import Link from "next/link";
import { HeaderSearchTrigger } from "@/components/header-search-trigger";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinkClass =
  "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          aria-label="pharmacopeia — home"
          className="flex items-center gap-2 rounded-md font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-md border border-primary/30 bg-primary/10 text-base font-semibold text-primary"
          >
            ℞
          </span>
          <span className="font-semibold tracking-tight" translate="no">
            pharmacopeia
          </span>
          <span
            className="hidden text-xs text-muted-foreground sm:inline"
            aria-hidden="true"
          >
            / v0 preview
          </span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
          <Link href="/drugs" className={navLinkClass}>
            Drugs
          </Link>
          <Link href="/classes" className={navLinkClass}>
            Classes
          </Link>
          <Link href="/docs" className={navLinkClass}>
            Docs
          </Link>
          <div className="ml-2">
            <HeaderSearchTrigger />
          </div>
          <a
            href="https://github.com/yassenshopov"
            target="_blank"
            rel="noopener noreferrer"
            className={`ml-1 ${navLinkClass}`}
          >
            GitHub
          </a>
          <div className="ml-2 border-l border-border/60 pl-2">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
