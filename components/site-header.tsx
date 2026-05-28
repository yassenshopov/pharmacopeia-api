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
          <Link href="/atc" className={navLinkClass}>
            ATC
          </Link>
          <Link href="/moa" className={navLinkClass}>
            MoA
          </Link>
          <Link href="/ingredients" className={navLinkClass}>
            Ingredients
          </Link>
          <Link href="/brands" className={navLinkClass}>
            Brands
          </Link>
          <Link href="/interactions" className={navLinkClass}>
            Interactions
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
            aria-label="GitHub"
            title="GitHub"
            className="ml-1 grid h-8 w-8 place-items-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.02 3.26 9.27 7.78 10.77.57.1.78-.25.78-.55 0-.27-.01-1.18-.02-2.14-3.17.69-3.84-1.35-3.84-1.35-.52-1.33-1.27-1.68-1.27-1.68-1.03-.71.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.02 1.74 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.53-.29-5.19-1.27-5.19-5.64 0-1.25.45-2.27 1.17-3.07-.12-.29-.51-1.45.11-3.03 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.74.11 3.03.73.8 1.17 1.82 1.17 3.07 0 4.38-2.67 5.35-5.21 5.63.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.13 0 .3.21.66.79.55 4.51-1.5 7.77-5.75 7.77-10.77C23.33 5.56 18.27.5 12 .5z" />
            </svg>
          </a>
          <div className="ml-2 border-l border-border/60 pl-2">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
