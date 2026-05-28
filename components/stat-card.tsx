"use client";

// Animated count-up driven by requestAnimationFrame and gated by an
// IntersectionObserver so the tween only runs when the card scrolls into
// view, with prefers-reduced-motion as an opt-out for the animation.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  sublabel?: string;
  className?: string;
}

const DURATION_MS = 1000;

export function StatCard({ label, value, sublabel, className }: StatCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const displayedRef = useRef<number>(typeof value === "number" ? value : 0);
  const hasAnimatedRef = useRef(false);

  const isNumeric = typeof value === "number";
  const [displayed, setDisplayed] = useState<number>(isNumeric ? value : 0);

  useEffect(() => {
    if (!isNumeric) return;

    const node = containerRef.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target = value;

    const setValue = (next: number) => {
      displayedRef.current = next;
      setDisplayed(next);
    };

    if (prefersReducedMotion) {
      setValue(target);
      hasAnimatedRef.current = true;
      return;
    }

    const runAnimation = () => {
      const from = hasAnimatedRef.current ? displayedRef.current : 0;
      if (!hasAnimatedRef.current) setValue(0);
      hasAnimatedRef.current = true;

      let startTime: number | null = null;
      const step = (now: number) => {
        if (startTime === null) startTime = now;
        const elapsed = now - startTime;
        const t = Math.min(elapsed / DURATION_MS, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const next = from + (target - from) * eased;
        setValue(t === 1 ? target : next);
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step);
        }
      };

      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(step);
    };

    if (hasAnimatedRef.current) {
      runAnimation();
      return () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            runAnimation();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, isNumeric]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col rounded-lg border border-border/80 bg-card/40 p-5",
        className,
      )}
    >
      <span className="font-mono text-3xl font-semibold tracking-tight">
        {isNumeric ? Math.round(displayed).toLocaleString() : value}
      </span>
      <span className="mt-1 text-sm font-medium">{label}</span>
      {sublabel && (
        <span className="mt-0.5 text-xs text-muted-foreground">{sublabel}</span>
      )}
    </div>
  );
}
