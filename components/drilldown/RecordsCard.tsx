"use client";

import { useState } from "react";

import { CardHeader } from "@/components/ui/Card";
import type { DocumentRef, DrillDownContent } from "@/lib/types";

import { DocumentViewer } from "./DocumentViewer";
import { RecordsTable } from "./RecordsTable";

/**
 * The same searchable table as the drill-down panel, embedded directly in a
 * module page so a CIO can work the full list without opening anything.
 */
export function RecordsCard({
  content,
  height = "h-[34rem]",
}: {
  content: DrillDownContent;
  height?: string;
}) {
  const [preview, setPreview] = useState<{
    doc: DocumentRef;
    ownerName: string;
  } | null>(null);

  return (
    <section
      className={`relative flex ${height} flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm`}
    >
      <CardHeader title={content.title} hint={content.subtitle} />

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
    </section>
  );
}
