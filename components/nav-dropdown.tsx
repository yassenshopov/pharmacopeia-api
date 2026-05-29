"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type NavDropdownItem = {
  href: string;
  label: string;
  description?: string;
};

export function NavDropdown({
  label,
  items,
  triggerClassName,
}: {
  label: string;
  items: ReadonlyArray<NavDropdownItem>;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        openOnHover
        delay={120}
        closeDelay={120}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-popup-open:bg-accent data-popup-open:text-foreground motion-reduce:transition-none",
          triggerClassName,
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        {/* z-index lives on the Positioner because that's the positioned
            (absolute) element — z-index on the Popup itself is a no-op and
            lets in-page stacking contexts (e.g. the hero's `z-10` wrapper)
            paint over the dropdown. */}
        <PopoverPrimitive.Positioner
          sideOffset={8}
          align="start"
          className="z-50"
        >
          <PopoverPrimitive.Popup
            className={cn(
              "w-72 rounded-lg border border-border/60 bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "motion-reduce:animate-none motion-reduce:duration-0",
            )}
          >
            {items.map((item) => (
              <PopoverPrimitive.Close
                key={item.href}
                nativeButton={false}
                render={
                  <Link
                    href={item.href}
                    className="block rounded-md px-2.5 py-2 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                  />
                }
              >
                <div className="text-sm font-medium text-foreground">
                  {item.label}
                </div>
                {item.description ? (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {item.description}
                  </div>
                ) : null}
              </PopoverPrimitive.Close>
            ))}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
