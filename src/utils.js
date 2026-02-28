// ─── Constants ───────────────────────────────────────────────────────────────

export const FONTS = {
  display: "'JetBrains Mono', monospace",
  body: "'IBM Plex Sans', sans-serif",
};

export const THEME = {
  bg: "#1a1a1e",
  surface: "#111114",
  border: "#2a2a30",
  text: "#f0f0f0",
  textDim: "#606070",
  accent: "#ff6b35",
  focusLetter: "#ff6b35",
  accentDim: "rgba(255,107,53,0.12)",
};

// ─── Text utilities ───────────────────────────────────────────────────────────

export function tokenize(text) {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

export function findORP(word) {
  const clean = word.replace(/[^a-zA-Z0-9]/g, "");
  const len = clean.length;
  if (len <= 1) return 0;
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

/** Smart pause multiplier for a word */
export function pauseMultiplier(word, pauseScale = 1.0) {
  let raw = 1;
  if (/[.!?]$/.test(word)) raw = 2.8;
  else if (/[,;:]$/.test(word)) raw = 1.6;
  return 1 + (raw - 1) * pauseScale;
}

// ─── Citation & clutter filtering ────────────────────────────────────────────

export function removeInlineCitations(text) {
  // Strip bracket citations: [1], [1,3], [1-5], [12,14,16]
  let result = text.replace(/\[\d[\d,\s\-\u2013\u2014]*\]/g, "");
  // Strip Unicode superscript digits
  result = result.replace(/[\u00B9\u00B2\u00B3\u2070-\u2079]+/g, "");
  return result;
}

export function removeParentheticalCitations(text) {
  // Match (Author, YYYY) patterns with optional prefixes, et al., multi-cite
  return text.replace(
    /\((?:(?:see|cf\.|e\.g\.,?)\s+)?[A-Z][a-zA-Z\u00C0-\u024F'-]+(?:(?:\s*[&,]\s*|\s+and\s+)[A-Z][a-zA-Z\u00C0-\u024F'-]+)*(?:\s+et\s+al\.?)?,?\s*(?:19|20)\d{2}(?:\s*[a-z])?(?:\s*;\s*(?:(?:see|cf\.|e\.g\.,?)\s+)?[A-Z][a-zA-Z\u00C0-\u024F'-]+(?:(?:\s*[&,]\s*|\s+and\s+)[A-Z][a-zA-Z\u00C0-\u024F'-]+)*(?:\s+et\s+al\.?)?,?\s*(?:19|20)\d{2}(?:\s*[a-z])?)*\)/g,
    ""
  );
}

export function removeReferenceSections(text) {
  // Match a line starting with a reference section keyword (case-insensitive, short line)
  const match = text.match(/\n\s*(References?|REFERENCES?|Bibliography|BIBLIOGRAPHY|Works\s+Cited|WORKS\s+CITED|Endnotes?|ENDNOTES?|Footnotes?|FOOTNOTES?|Further\s+Reading|FURTHER\s+READING)\s*\n/);
  if (!match) return text;
  // Verify the header line is short (<40 chars)
  if (match[1].length > 40) return text;
  return text.slice(0, match.index).trimEnd();
}

export function removeCaptions(text) {
  // Strip lines starting with Figure/Fig./Table/Chart/Plate + number + : or .
  return text.replace(/^[ \t]*(?:Figure|Fig\.|Table|Chart|Plate|Scheme|Appendix)\s+\d+[.:]\s*[^\n]*/gim, "");
}

export function removeStandalonePageNumbers(text) {
  // Strip isolated 1-4 digit numbers on their own line
  return text.replace(/\n\s*\d{1,4}\s*(?=\n)/g, "");
}

export function cleanText(text, options = {}) {
  let result = text;
  if (options.inlineCitations) result = removeInlineCitations(result);
  if (options.parentheticalCitations) result = removeParentheticalCitations(result);
  if (options.referenceSections) result = removeReferenceSections(result);
  if (options.captions) result = removeCaptions(result);
  if (options.pageNumbers) result = removeStandalonePageNumbers(result);
  return result;
}

export function filterTokens(words, options) {
  if (!options || !options.inlineCitations) return words;
  return words.filter((token) => {
    if (/^\[\d[\d,\-]*\]$/.test(token)) return false;
    if (/^[\u00B9\u00B2\u00B3\u2070-\u2079]+$/.test(token)) return false;
    return true;
  });
}
