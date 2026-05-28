"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TocItem = {
  id: string;
  label: string;
  level?: 2 | 3;
};

interface TocProps {
  items: TocItem[];
  className?: string;
}

export function Toc({ items, className }: TocProps): React.ReactElement | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (items.length < 3) return;
    const ids = items.map((i) => i.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActiveId(first);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }

  return (
    <nav
      aria-label="On this page"
      className={cn(
        "hidden lg:sticky lg:top-24 lg:block lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto",
        className,
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </div>
      <ul className="mt-3 space-y-0.5 border-l border-border/60">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "-ml-px block rounded-sm border-l py-1 pl-3 text-xs leading-snug transition-colors motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  item.level === 3 && "pl-6",
                  isActive
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
