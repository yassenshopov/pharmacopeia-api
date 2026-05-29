"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { NavItem } from "@/components/nav-items";
import { cn } from "@/lib/utils";

export function MobileNav({ items }: { items: ReadonlyArray<NavItem> }) {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        className="grid h-8 w-8 place-items-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none lg:hidden"
      >
        {open ? (
          <X aria-hidden="true" className="size-4" />
        ) : (
          <Menu aria-hidden="true" className="size-4" />
        )}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-30 bg-background/60 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none lg:hidden" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-x-0 top-14 z-40 mx-auto w-full max-w-6xl border-b border-border/60 bg-background px-4 pb-3 pt-2 shadow-lg outline-none sm:px-6",
            "data-open:animate-in data-open:slide-in-from-top-2 data-open:fade-in-0",
            "data-closed:animate-out data-closed:slide-out-to-top-2 data-closed:fade-out-0",
            "motion-reduce:animate-none motion-reduce:duration-0",
            "lg:hidden",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Navigation
          </DialogPrimitive.Title>
          <nav aria-label="Mobile" className="flex flex-col">
            {items.map((item) =>
              item.kind === "link" ? (
                <DialogPrimitive.Close
                  key={item.href}
                  nativeButton={false}
                  render={
                    <Link
                      href={item.href}
                      className="rounded-md px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                    />
                  }
                >
                  {item.label}
                </DialogPrimitive.Close>
              ) : (
                <div key={item.label} className="mt-1 flex flex-col">
                  <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </div>
                  {item.items.map((sub) => (
                    <DialogPrimitive.Close
                      key={sub.href}
                      nativeButton={false}
                      render={
                        <Link
                          href={sub.href}
                          className="rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                        />
                      }
                    >
                      {sub.label}
                    </DialogPrimitive.Close>
                  ))}
                </div>
              ),
            )}
            <a
              href="https://github.com/yassenshopov"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 rounded-md border-t border-border/60 px-3 pb-2 pt-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.02 3.26 9.27 7.78 10.77.57.1.78-.25.78-.55 0-.27-.01-1.18-.02-2.14-3.17.69-3.84-1.35-3.84-1.35-.52-1.33-1.27-1.68-1.27-1.68-1.03-.71.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.02 1.74 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.53-.29-5.19-1.27-5.19-5.64 0-1.25.45-2.27 1.17-3.07-.12-.29-.51-1.45.11-3.03 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.74.11 3.03.73.8 1.17 1.82 1.17 3.07 0 4.38-2.67 5.35-5.21 5.63.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.13 0 .3.21.66.79.55 4.51-1.5 7.77-5.75 7.77-10.77C23.33 5.56 18.27.5 12 .5z" />
              </svg>
              GitHub
            </a>
          </nav>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
