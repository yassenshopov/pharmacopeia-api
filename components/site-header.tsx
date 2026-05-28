import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-mono text-sm">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-border/80 bg-foreground/5 text-base font-semibold">
            ℞
          </span>
          <span className="font-semibold tracking-tight">pharmacopeia</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            / v0 preview
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/drugs"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Drugs
          </Link>
          <Link
            href="/classes"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Classes
          </Link>
          <Link
            href="/docs"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Docs
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="ml-1 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
