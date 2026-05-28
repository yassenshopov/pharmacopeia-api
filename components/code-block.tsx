"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-lg border border-border/80 bg-foreground/[0.03] font-mono text-sm dark:bg-foreground/[0.04]",
        className,
      )}
    >
      {label && (
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
            {language}
          </span>
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto px-4 py-3 leading-relaxed">
          <code className="whitespace-pre">{code}</code>
        </pre>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md border border-border/80 bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
