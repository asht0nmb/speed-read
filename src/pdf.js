import * as pdfjsLib from "pdfjs-dist";
import { tokenize } from "./utils.js";

// Point PDF.js at its bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

// ─── PDF extraction ───────────────────────────────────────────────────────────

/**
 * Position-aware PDF text extraction.
 * Returns { text, pageBreaks, pdfDoc }
 */
export async function extractWithPDFJS(file, spacingThreshold = 1.2, marginPercent = 0.08) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  const pageBreaks = []; // [{ pageNum, wordIndex }]

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    const { height: pageHeight } = page.getViewport({ scale: 1 });

    const wordsBefore = tokenize(fullText).length;
    pageBreaks.push({ pageNum, wordIndex: wordsBefore });

    let prevItem = null;
    for (const item of content.items) {
      if (!item.str) continue;

      // Skip items in header/footer margin zones
      if (marginPercent > 0) {
        const y = item.transform[5];
        if (y > pageHeight * (1 - marginPercent) || y < pageHeight * marginPercent) continue;
      }

      // Normalize ligatures
      const str = item.str
        .replace(/ﬁ/g, "fi")
        .replace(/ﬂ/g, "fl")
        .replace(/ﬀ/g, "ff")
        .replace(/ﬃ/g, "ffi")
        .replace(/ﬄ/g, "ffl");

      if (prevItem) {
        const prevEndX = prevItem.transform[4] + (prevItem.width || 0);
        const thisStartX = item.transform[4];
        const gap = thisStartX - prevEndX;
        const charWidth =
          (prevItem.width || 0) / Math.max(prevItem.str.length, 1);

        if (gap > charWidth * spacingThreshold) {
          fullText += " ";
        }

        // Dehyphenate line breaks
        if (prevItem.hasEOL && fullText.endsWith("-")) {
          fullText = fullText.slice(0, -1);
        }
      }

      fullText += str;
      if (item.hasEOL) fullText += " ";
      prevItem = item;
    }
    fullText += " ";
  }

  return { text: fullText.trim(), pageBreaks, pdfDoc: pdf };
}

// ─── TOC extraction ───────────────────────────────────────────────────────────

export function groupIntoLines(items) {
  const byY = {};
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    if (!byY[y]) byY[y] = [];
    byY[y].push(item);
  }
  return Object.values(byY).sort((a, b) => b[0].transform[5] - a[0].transform[5]);
}

export async function flattenOutline(items, pdf, pageBreaks, depth = 0) {
  const result = [];
  for (const item of items) {
    let pageNum = 1;
    try {
      const dest =
        typeof item.dest === "string"
          ? await pdf.getDestination(item.dest)
          : item.dest;
      const pageRef = dest?.[0];
      if (pageRef) pageNum = (await pdf.getPageIndex(pageRef)) + 1;
    } catch (_) {}
    const pb =
      pageBreaks.find((p) => p.pageNum >= pageNum) || pageBreaks[0];
    result.push({
      title: item.title,
      pageNum,
      wordIndex: pb?.wordIndex ?? 0,
      depth,
    });
    if (item.items?.length) {
      result.push(
        ...(await flattenOutline(item.items, pdf, pageBreaks, depth + 1))
      );
    }
  }
  return result;
}

export async function detectHeadings(pdf, pageBreaks) {
  const headingPattern = /^(chapter|section|part|\d+\.[\d.]*)\s+\S/i;
  const allCapsMin = 3;
  const result = [];
  for (const pb of pageBreaks) {
    try {
      const page = await pdf.getPage(pb.pageNum);
      const content = await page.getTextContent();
      const lines = groupIntoLines(content.items);
      for (const line of lines) {
        const text = line.map((i) => i.str).join(" ").trim();
        if (!text || text.length > 80) continue;
        const isHeading =
          headingPattern.test(text) ||
          (text === text.toUpperCase() &&
            text.replace(/\s/g, "").length >= allCapsMin);
        if (isHeading) {
          result.push({
            title: text,
            pageNum: pb.pageNum,
            wordIndex: pb.wordIndex,
            depth: 0,
          });
        }
      }
    } catch (_) {}
  }
  return result;
}

export async function parseTOC(pdf, pageBreaks) {
  try {
    const outline = await pdf.getOutline();
    if (outline && outline.length > 0) {
      return flattenOutline(outline, pdf, pageBreaks);
    }
  } catch (_) {}
  return detectHeadings(pdf, pageBreaks);
}
