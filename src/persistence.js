// ─── Content hashing ─────────────────────────────────────────────────────────

/**
 * Fast non-cryptographic fingerprint for a File object.
 * Samples bytes from the start and end to avoid reading large files fully.
 */
export async function hashFile(file, sampleSize = 8192) {
  const readChunk = async (blob) => new Uint8Array(await blob.arrayBuffer());

  const headBytes = await readChunk(file.slice(0, sampleSize));
  const tailStart = Math.max(0, file.size - sampleSize);
  const tailBytes = await readChunk(file.slice(tailStart));

  let h = 5381n;
  const fold = (bytes) => {
    for (const b of bytes) h = ((h << 5n) + h + BigInt(b)) & 0xffffffffffffffffn;
  };
  fold(headBytes);
  fold(tailBytes);
  h = ((h << 5n) + h + BigInt(file.size)) & 0xffffffffffffffffn;
  return h.toString(16).padStart(16, "0");
}

/**
 * Synchronous hash for pasted text (already in memory).
 */
export function hashText(text) {
  let h = 5381n;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5n) + h + BigInt(text.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

// ─── Bookmark persistence ────────────────────────────────────────────────────

const BOOKMARK_PREFIX = "swiftread:bookmark:";
const SETTINGS_KEY = "swiftread:settings";

export function saveBookmark(contentHash, fileName, wordIndex, wordCount) {
  try {
    localStorage.setItem(
      BOOKMARK_PREFIX + contentHash,
      JSON.stringify({ fileName, wordIndex, wordCount, savedAt: Date.now() })
    );
  } catch (_) {}
}

export function loadBookmark(contentHash) {
  try {
    const raw = localStorage.getItem(BOOKMARK_PREFIX + contentHash);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.wordIndex !== "number" || typeof data.wordCount !== "number") return null;
    return data;
  } catch (_) {
    return null;
  }
}

export function clearBookmark(contentHash) {
  try {
    localStorage.removeItem(BOOKMARK_PREFIX + contentHash);
  } catch (_) {}
}

// ─── Named pins (bookmarks) persistence ─────────────────────────────────────

const PINS_PREFIX = "swiftread:pins:";

export function savePins(contentHash, pins) {
  try {
    localStorage.setItem(PINS_PREFIX + contentHash, JSON.stringify(pins));
  } catch (_) {}
}

export function loadPins(contentHash) {
  try {
    const raw = localStorage.getItem(PINS_PREFIX + contentHash);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (p) => typeof p.wordIndex === "number" && typeof p.createdAt === "number"
    );
  } catch (_) {
    return [];
  }
}

// ─── Settings persistence ────────────────────────────────────────────────────

const DEFAULTS = { wpm: 300, chunkSize: 1, showORP: true, marginPercent: 0.08, pauseScale: 1.0, spacingThreshold: 1.2, filterCitations: true, filterReferenceSections: true, filterCaptions: false, filterPageNumbers: false };

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {}
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw);
    const chunkRaw = typeof data.chunkSize === "number" ? data.chunkSize : DEFAULTS.chunkSize;
    return {
      wpm: typeof data.wpm === "number" ? data.wpm : DEFAULTS.wpm,
      chunkSize: chunkRaw % 2 === 0 ? chunkRaw - 1 : chunkRaw,
      showORP: typeof data.showORP === "boolean" ? data.showORP : DEFAULTS.showORP,
      marginPercent: typeof data.marginPercent === "number" ? data.marginPercent : DEFAULTS.marginPercent,
      pauseScale: typeof data.pauseScale === "number" ? data.pauseScale : DEFAULTS.pauseScale,
      spacingThreshold: typeof data.spacingThreshold === "number" ? data.spacingThreshold : DEFAULTS.spacingThreshold,
      filterCitations: typeof data.filterCitations === "boolean" ? data.filterCitations : DEFAULTS.filterCitations,
      filterReferenceSections: typeof data.filterReferenceSections === "boolean" ? data.filterReferenceSections : DEFAULTS.filterReferenceSections,
      filterCaptions: typeof data.filterCaptions === "boolean" ? data.filterCaptions : DEFAULTS.filterCaptions,
      filterPageNumbers: typeof data.filterPageNumbers === "boolean" ? data.filterPageNumbers : DEFAULTS.filterPageNumbers,
    };
  } catch (_) {
    return { ...DEFAULTS };
  }
}
