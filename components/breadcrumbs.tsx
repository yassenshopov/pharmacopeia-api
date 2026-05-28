import Link from "next/link";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  breadcrumbJsonLd,
  jsonLdScriptProps,
  type BreadcrumbItem as BreadcrumbItemData,
} from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
  items: BreadcrumbItemData[];
  className?: string;
}

/**
 * Renders a visual breadcrumb above the page H1 and emits a matching
 * `BreadcrumbList` JSON-LD block so search engines render the same
 * trail in SERPs.
 *
 * The last item is always treated as the current page (rendered as
 * `BreadcrumbPage`, no link). All other items must have an `href`.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const fullTrail: BreadcrumbItemData[] = [
    { label: "Home", href: "/" },
    ...items,
  ];

  return (
    <>
      <Breadcrumb className={cn("mb-6", className)}>
        <BreadcrumbList className="text-xs">
          {fullTrail.map((item, idx) => {
            const isLast = idx === fullTrail.length - 1;
            return (
              <Fragment key={`${item.label}-${idx}`}>
                <BreadcrumbItem>
                  {isLast || !item.href ? (
                    <BreadcrumbPage className="text-muted-foreground">
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={<Link href={item.href} />}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {item.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <script {...jsonLdScriptProps(breadcrumbJsonLd(fullTrail))} />
    </>
  );
}
