"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  label?: string;
  className?: string;
}

export function CodeBlock({
  code,
  language = "json",
  label,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write can reject in insecure contexts or when permissions
      // are denied. Swallow silently — the user can still select the text.
    }
  }

  return (
    <div
      className={cn(
        "group/code overflow-hidden rounded-lg border border-border/80 bg-foreground/[0.03] font-mono text-sm dark:bg-foreground/[0.04]",
        className,
      )}
    >
      {label && (
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span className="truncate" translate="no">
            {label}
          </span>
          <span
            translate="no"
            className="ml-3 shrink-0 rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
          >
            {language}
          </span>
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto px-4 py-3 leading-relaxed" translate="no">
          <code className="whitespace-pre">{code}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code to clipboard"}
          aria-live="polite"
          className={cn(
            "absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md border border-border/80 bg-background/80 text-muted-foreground backdrop-blur",
            "transition-[opacity,color,background-color] duration-150 ease-out motion-reduce:transition-none",
            "opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100",
            "hover:text-foreground hover:bg-background",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
