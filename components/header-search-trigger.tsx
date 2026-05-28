"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

const OPEN_EVENT = "pharmacopeia:open-search";

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const ua =
    nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent ?? "";
  return /mac|iphone|ipad|ipod/i.test(ua);
}

export function HeaderSearchTrigger() {
  const [isMac, setIsMac] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsMac(detectMac());
    setMounted(true);
  }, []);

  function openPalette() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(OPEN_EVENT));
  }

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Open search"
      aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
      className="group inline-flex h-8 items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none sm:w-56 sm:justify-between sm:pr-1.5"
    >
      <span className="inline-flex items-center gap-2">
        <Search aria-hidden="true" className="size-4" />
        <span className="hidden text-sm sm:inline">Search</span>
      </span>
      <kbd
        aria-hidden="true"
        className="hidden h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex"
      >
        {mounted ? (isMac ? <><span className="text-[12px] leading-none">⌘</span>K</> : <>Ctrl K</>) : <>⌘ K</>}
      </kbd>
    </button>
  );
}
