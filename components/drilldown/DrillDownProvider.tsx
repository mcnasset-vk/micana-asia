"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Sheet } from "@/components/ui/Sheet";
import { IconClose } from "@/components/ui/icons";
import { formatRM } from "@/lib/format";
import type { DocumentRef, DrillDownContent } from "@/lib/types";

import { DocumentViewer } from "./DocumentViewer";
import { RecordsTable } from "./RecordsTable";

interface DrillDownContextValue {
  /** Open the slide-over with a prepared record set. */
  openDrillDown: (content: DrillDownContent) => void;
  closeDrillDown: () => void;
}

const DrillDownContext = createContext<DrillDownContextValue | null>(null);

export function DrillDownProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<DrillDownContent | null>(null);
  const [preview, setPreview] = useState<{
    doc: DocumentRef;
    ownerName: string;
  } | null>(null);
  const titleId = useId();

  const openDrillDown = useCallback((next: DrillDownContent) => {
    setPreview(null);
    setContent(next);
  }, []);

  const closeDrillDown = useCallback(() => {
    setPreview(null);
    setContent(null);
  }, []);

  const value = useMemo(
    () => ({ openDrillDown, closeDrillDown }),
    [openDrillDown, closeDrillDown],
  );

  return (
    <DrillDownContext.Provider value={value}>
      {children}

      <Sheet
        open={content !== null}
        onClose={closeDrillDown}
        labelledBy={titleId}
      >
        {content ? (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-base font-semibold tracking-tight text-ink"
                >
                  {content.title}
                </h2>
                {content.subtitle ? (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {content.subtitle}
                  </p>
                ) : null}
                {typeof content.total === "number" ? (
                  <p className="mt-2 flex flex-wrap items-baseline gap-2">
                    <span className="tnum font-display text-2xl font-semibold text-ink">
                      {formatRM(content.total)}
                    </span>
                    {content.totalLabel ? (
                      <span className="text-xs text-ink-muted">
                        {content.totalLabel}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDrillDown}
                aria-label="Close details"
                className="shrink-0 rounded-lg border border-line p-1.5 text-ink-muted transition hover:bg-surface-3 hover:text-ink"
              >
                <IconClose className="size-4" />
              </button>
            </header>

            <RecordsTable
              content={content}
              onPreview={(doc, ownerName) => setPreview({ doc, ownerName })}
            />

            {preview ? (
              <DocumentViewer
                doc={preview.doc}
                ownerName={preview.ownerName}
                onClose={() => setPreview(null)}
              />
            ) : null}
          </>
        ) : null}
      </Sheet>
    </DrillDownContext.Provider>
  );
}

export function useDrillDown(): DrillDownContextValue {
  const ctx = useContext(DrillDownContext);
  if (!ctx) {
    throw new Error("useDrillDown must be used inside <DrillDownProvider>");
  }
  return ctx;
}
