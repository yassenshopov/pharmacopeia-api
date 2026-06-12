"use client";

import { BookOpen } from "lucide-react";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PlainSegment } from "@/lib/plain-language";

/**
 * Patient-facing summary mode. The provider holds a page-level
 * "plain language" flag (persisted to localStorage); `ProseText`
 * instances swap between the clinical and pre-simplified plain
 * variants. Both variants are computed server-side — the client only
 * picks which string to show, so toggling is instant and the swap
 * logic stays in `lib/plain-language.ts`.
 */

const STORAGE_KEY = "pharmacopeia:plain-language";

const PlainLanguageContext = createContext<{
  plain: boolean;
  setPlain: (value: boolean) => void;
}>({ plain: false, setPlain: () => {} });

export function PlainLanguageProvider({ children }: { children: ReactNode }) {
  const [plain, setPlainState] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setPlainState(true);
      }
    } catch {
      // localStorage unavailable (private mode etc.) — default stands.
    }
  }, []);

  const setPlain = useCallback((value: boolean) => {
    setPlainState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Preference just won't persist.
    }
  }, []);

  return (
    <PlainLanguageContext.Provider value={{ plain, setPlain }}>
      {children}
    </PlainLanguageContext.Provider>
  );
}

export function PlainLanguageToggle() {
  const { plain, setPlain } = useContext(PlainLanguageContext);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={plain}
      onClick={() => setPlain(!plain)}
      className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
      Plain language
      <span
        aria-hidden="true"
        className={`relative h-4 w-7 rounded-full transition-colors motion-reduce:transition-none ${
          plain ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-background transition-transform motion-reduce:transition-none ${
            plain ? "translate-x-3" : ""
          }`}
        />
      </span>
    </button>
  );
}

/**
 * Swappable prose. Renders the clinical text by default and the
 * plain-language variant when the page-level toggle is on. Glossary-
 * swapped phrases are highlighted in blue with the original clinical
 * wording on hover, so readers can always see what was simplified.
 */
export function ProseText({
  clinical,
  plain,
}: {
  clinical: string;
  plain: PlainSegment[];
}) {
  const { plain: on } = useContext(PlainLanguageContext);
  if (!on) return <>{clinical}</>;
  return (
    <>
      {plain.map((seg, i) =>
        seg.from ? (
          <span
            key={i}
            title={`Clinical term: ${seg.from}`}
            className="rounded-sm bg-sky-500/10 px-0.5 text-sky-700 underline decoration-sky-500/50 decoration-dotted underline-offset-2 dark:text-sky-300"
          >
            {seg.text}
          </span>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Banner shown only while plain mode is active. Reports the computed
 * reading grade of the simplified prose and reminds the reader that
 * sources, provenance, and the disclaimer are unchanged.
 */
export function PlainLanguageNotice({ grade }: { grade: number }) {
  const { plain } = useContext(PlainLanguageContext);
  return (
    <div aria-live="polite">
      {plain && (
        <div className="mt-6 rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-xs leading-relaxed text-sky-900 dark:text-sky-200">
          <span className="font-semibold">Plain-language mode. </span>
          Clinical wording is simplified automatically from the same FDA
          label text{grade > 0 && (
            <> (reads at about a grade {Math.round(grade)} level)</>
          )}
          . <span className="rounded-sm bg-sky-500/10 px-0.5 underline decoration-sky-500/50 decoration-dotted underline-offset-2">Highlighted phrases</span>{" "}
          were simplified — hover one to see the original clinical term.
          Nothing is added or removed from the record — provenance, sources,
          and the disclaimer below are unchanged. Educational use only, not
          medical advice.
        </div>
      )}
    </div>
  );
}
