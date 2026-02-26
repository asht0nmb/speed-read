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
export function pauseMultiplier(word) {
  if (/[.!?]$/.test(word)) return 2.8;
  if (/[,;:]$/.test(word)) return 1.6;
  return 1;
}
