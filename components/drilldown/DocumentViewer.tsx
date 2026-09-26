"use client";

import { useEffect } from "react";

import { Badge } from "@/components/ui/Badge";
import { IconClose, IconDownload } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import type { DocumentRef } from "@/lib/types";

/**
 * Preview overlay shown inside the drill-down panel.
 * PDFs render in an iframe, images inline. Esc is captured here so it closes
 * the preview rather than the whole panel.
 */
export function DocumentViewer({
  doc,
  ownerName,
  onClose,
}: {
  doc: DocumentRef;
  ownerName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    // Capture phase so this runs before the Sheet's own Escape handler.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const isImage = doc.mimeType.startsWith("image/");

  return (
    <div className="absolute inset-0 z-10 flex animate-fade-in flex-col bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{doc.category}</Badge>
            <span className="text-xs text-ink-subtle">
              {doc.sizeKb} KB · uploaded {formatDate(doc.uploadedAt)}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-sm font-semibold text-ink">
            {doc.name}
          </h3>
          <p className="truncate text-xs text-ink-muted">{ownerName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={doc.url}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-3 hover:text-ink"
          >
            <IconDownload className="size-4" />
            <span className="hidden sm:inline">Download</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line p-1.5 text-ink-muted transition hover:bg-surface-3 hover:text-ink"
            aria-label="Close document preview"
          >
            <IconClose className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-surface-3 p-3">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.url}
            alt={doc.name}
            className="mx-auto max-w-full rounded-lg border border-line bg-surface shadow-sm"
          />
        ) : (
          <iframe
            src={doc.url}
            title={doc.name}
            className="h-full min-h-[420px] w-full rounded-lg border border-line bg-surface"
          />
        )}
      </div>

      <p className="border-t border-line px-5 py-2.5 text-[0.6875rem] text-ink-subtle">
        Placeholder document. In production these are served from a private
        bucket via short-lived signed links.
      </p>
    </div>
  );
}
