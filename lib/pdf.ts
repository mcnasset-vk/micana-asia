/**
 * The PDF writer, with no dependency.
 *
 * Extracted from the invoice generator so the tenancy agreement is drawn with
 * the same machinery rather than a second copy of it. The reasoning for
 * writing PDFs by hand is the invoice tool's and still holds: a library means
 * editing package.json and the lockfile, and a document that needs only Times
 * is small enough to emit directly.
 *
 * Times-Roman and Times-Bold are two of the fourteen fonts every PDF reader
 * must provide, so nothing is embedded and the file stays a few KB. The text
 * is real text — selectable, searchable, sharp at any zoom — which a
 * screenshot-to-canvas approach would not be.
 *
 * Browser only: widths are measured with a canvas.
 */

/* A4 in points, which is the unit PDF works in. */
export const PT_PER_MM = 2.834646;
export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const RULE = 1.2;

export type Align = "left" | "right" | "center";

/**
 * Widths come from the browser rather than a table of font metrics: Times New
 * Roman is metric-compatible with the PDF's Times-Roman, and measuring at N
 * pixels gives the same ratio as N points.
 */
let measurer: CanvasRenderingContext2D | null = null;
export function widthOf(text: string, size: number, bold: boolean): number {
  if (!measurer) {
    measurer = document.createElement("canvas").getContext("2d");
  }
  if (!measurer) return text.length * size * 0.5;
  measurer.font = `${bold ? "bold " : ""}${size}px "Times New Roman", Times, serif`;
  return measurer.measureText(text).width;
}

/** WinAnsi covers these documents; anything outside it is folded to ASCII. */
export function escape(text: string): string {
  return text
    .replace(/[‐-―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

const n = (value: number) => value.toFixed(2);

export class Page {
  private ops: string[] = [];

  /** `y` is measured down from the top edge, to the text baseline. */
  text(
    value: string,
    x: number,
    y: number,
    opts: { size?: number; bold?: boolean; align?: Align } = {},
  ) {
    const body = String(value ?? "");
    if (!body) return;
    const size = opts.size ?? 11.5;
    const bold = opts.bold ?? false;
    let startX = x;
    if (opts.align === "right") startX = x - widthOf(body, size, bold);
    else if (opts.align === "center") startX = x - widthOf(body, size, bold) / 2;
    this.ops.push(
      `BT /${bold ? "F2" : "F1"} ${n(size)} Tf ${n(startX)} ${n(
        PAGE_H - y,
      )} Td (${escape(body)}) Tj ET`,
    );
  }

  /** Draws mixed-weight runs left to right. */
  runs(
    parts: { text: string; bold: boolean }[],
    x: number,
    y: number,
    size: number,
  ) {
    let cursor = x;
    for (const part of parts) {
      this.text(part.text, cursor, y, { size, bold: part.bold });
      cursor += widthOf(part.text, size, part.bold);
    }
  }

  /**
   * Wraps `value` to `width`, returning the y the caller should continue from.
   * Needed by prose, which the invoice never had — its notes are single lines.
   */
  paragraph(
    value: string,
    x: number,
    y: number,
    width: number,
    opts: { size?: number; bold?: boolean; leading?: number } = {},
  ): number {
    const size = opts.size ?? 11.5;
    const bold = opts.bold ?? false;
    const leading = opts.leading ?? size * 1.45;

    let line = "";
    let cursor = y;
    for (const word of String(value ?? "").split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && widthOf(candidate, size, bold) > width) {
        this.text(line, x, cursor, { size, bold });
        cursor += leading;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      this.text(line, x, cursor, { size, bold });
      cursor += leading;
    }
    return cursor;
  }

  rule(x1: number, y: number, x2: number, width = RULE) {
    this.ops.push(
      `${n(width)} w ${n(x1)} ${n(PAGE_H - y)} m ${n(x2)} ${n(PAGE_H - y)} l S`,
    );
  }

  rect(x: number, y: number, w: number, h: number, width = 0.6) {
    this.ops.push(
      `${n(width)} w ${n(x)} ${n(PAGE_H - y - h)} ${n(w)} ${n(h)} re S`,
    );
  }

  fill(
    x: number,
    y: number,
    w: number,
    h: number,
    rgb: [number, number, number],
  ) {
    this.ops.push(
      `${n(rgb[0])} ${n(rgb[1])} ${n(rgb[2])} rg ${n(x)} ${n(
        PAGE_H - y - h,
      )} ${n(w)} ${n(h)} re f 0 0 0 rg`,
    );
  }

  /** Places the logo XObject. PDF scales the unit square, hence the cm. */
  image(x: number, y: number, w: number, h: number) {
    this.ops.push(
      `q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(PAGE_H - y - h)} cm /Im1 Do Q`,
    );
  }

  stream(): string {
    return this.ops.join("\n");
  }
}

/**
 * Wraps numbered objects in the file header, cross-reference table and
 * trailer. The offsets are counted in characters, which is only correct
 * because the string is written out as Latin-1 by `pdfBlob`.
 */
export function assemble(objects: string[]): string {
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefAt}\n%%EOF\n`;
  return pdf;
}

/** Latin-1, so every byte of the file is one character of the string. */
export function pdfBlob(pdf: string): Blob {
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}

/** Hands a built file to the browser to save. */
export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: Safari cancels the download if the URL goes
  // away in the same one.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
