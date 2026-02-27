import { describe, it, expect, beforeEach } from "vitest";
import {
  hashFile,
  hashText,
  saveBookmark,
  loadBookmark,
  clearBookmark,
  saveSettings,
  loadSettings,
  savePins,
  loadPins,
} from "../persistence.js";

// ─── hashFile ────────────────────────────────────────────────────────────────

describe("hashFile", () => {
  function makeFile(content, name = "test.txt") {
    return new File([content], name, { type: "text/plain" });
  }

  it("produces the same hash for the same file", async () => {
    const file = makeFile("hello world");
    const h1 = await hashFile(file);
    const h2 = await hashFile(file);
    expect(h1).toBe(h2);
  });

  it("produces the same hash regardless of filename", async () => {
    const content = "identical content here";
    const h1 = await hashFile(makeFile(content, "a.txt"));
    const h2 = await hashFile(makeFile(content, "b.pdf"));
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different content", async () => {
    const h1 = await hashFile(makeFile("content A"));
    const h2 = await hashFile(makeFile("content B"));
    expect(h1).not.toBe(h2);
  });

  it("handles empty file without throwing", async () => {
    const h = await hashFile(makeFile(""));
    expect(typeof h).toBe("string");
    expect(h.length).toBe(16);
  });

  it("returns a 16-character hex string", async () => {
    const h = await hashFile(makeFile("some data"));
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ─── hashText ────────────────────────────────────────────────────────────────

describe("hashText", () => {
  it("produces the same hash for the same string", () => {
    expect(hashText("hello")).toBe(hashText("hello"));
  });

  it("produces different hashes for different strings", () => {
    expect(hashText("hello")).not.toBe(hashText("world"));
  });

  it("handles empty string without throwing", () => {
    const h = hashText("");
    expect(typeof h).toBe("string");
    expect(h.length).toBe(16);
  });

  it("returns a 16-character hex string", () => {
    expect(hashText("test")).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ─── saveBookmark / loadBookmark ─────────────────────────────────────────────

describe("saveBookmark / loadBookmark", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips bookmark data", () => {
    saveBookmark("abc123", "test.pdf", 1247, 84230);
    const bm = loadBookmark("abc123");
    expect(bm).not.toBeNull();
    expect(bm.fileName).toBe("test.pdf");
    expect(bm.wordIndex).toBe(1247);
    expect(bm.wordCount).toBe(84230);
    expect(typeof bm.savedAt).toBe("number");
  });

  it("returns null for unknown hash", () => {
    expect(loadBookmark("nonexistent")).toBeNull();
  });

  it("overwrites on second save", () => {
    saveBookmark("abc", "f.txt", 10, 100);
    saveBookmark("abc", "f.txt", 50, 100);
    expect(loadBookmark("abc").wordIndex).toBe(50);
  });
});

// ─── clearBookmark ───────────────────────────────────────────────────────────

describe("clearBookmark", () => {
  beforeEach(() => localStorage.clear());

  it("removes the bookmark", () => {
    saveBookmark("abc", "f.txt", 10, 100);
    clearBookmark("abc");
    expect(loadBookmark("abc")).toBeNull();
  });
});

// ─── saveSettings / loadSettings ─────────────────────────────────────────────

describe("saveSettings / loadSettings", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips settings", () => {
    saveSettings({ wpm: 450, chunkSize: 2, showORP: false, marginTop: 0.12, marginBottom: 0.05 });
    const s = loadSettings();
    expect(s.wpm).toBe(450);
    expect(s.chunkSize).toBe(2);
    expect(s.showORP).toBe(false);
    expect(s.marginTop).toBe(0.12);
    expect(s.marginBottom).toBe(0.05);
  });

  it("returns defaults when nothing stored", () => {
    const s = loadSettings();
    expect(s).toEqual({ wpm: 300, chunkSize: 1, showORP: true, marginTop: 0.08, marginBottom: 0.08 });
  });

  it("returns defaults on corrupted JSON", () => {
    localStorage.setItem("swiftread:settings", "not-json{{{");
    const s = loadSettings();
    expect(s).toEqual({ wpm: 300, chunkSize: 1, showORP: true, marginTop: 0.08, marginBottom: 0.08 });
  });

  it("migrates old marginPercent to marginTop and marginBottom", () => {
    localStorage.setItem(
      "swiftread:settings",
      JSON.stringify({ wpm: 400, chunkSize: 1, showORP: true, marginPercent: 0.12 })
    );
    const s = loadSettings();
    expect(s.marginTop).toBe(0.12);
    expect(s.marginBottom).toBe(0.12);
  });

  it("defaults marginTop and marginBottom when loading old settings without margin keys", () => {
    saveSettings({ wpm: 400, chunkSize: 1, showORP: true });
    const s = loadSettings();
    expect(s.marginTop).toBe(0.08);
    expect(s.marginBottom).toBe(0.08);
  });
});

// ─── savePins / loadPins ────────────────────────────────────────────────────

describe("savePins / loadPins", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips pin data", () => {
    const pins = [
      { wordIndex: 10, context: "some context words here", createdAt: 1000 },
      { wordIndex: 50, context: "other context", createdAt: 2000 },
    ];
    savePins("hash1", pins);
    const loaded = loadPins("hash1");
    expect(loaded).toEqual(pins);
  });

  it("returns empty array for unknown hash", () => {
    expect(loadPins("nonexistent")).toEqual([]);
  });

  it("returns empty array on corrupted JSON", () => {
    localStorage.setItem("swiftread:pins:bad", "not-json{{{");
    expect(loadPins("bad")).toEqual([]);
  });

  it("filters out invalid entries", () => {
    localStorage.setItem(
      "swiftread:pins:test",
      JSON.stringify([
        { wordIndex: 10, context: "ok", createdAt: 1000 },
        { wordIndex: "bad", context: "nope", createdAt: 2000 },
        { context: "missing wordIndex", createdAt: 3000 },
      ])
    );
    const loaded = loadPins("test");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].wordIndex).toBe(10);
  });

  it("overwrites on second save", () => {
    savePins("h", [{ wordIndex: 1, context: "a", createdAt: 100 }]);
    savePins("h", [{ wordIndex: 2, context: "b", createdAt: 200 }]);
    const loaded = loadPins("h");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].wordIndex).toBe(2);
  });

  it("returns empty array when stored value is not an array", () => {
    localStorage.setItem("swiftread:pins:obj", JSON.stringify({ not: "array" }));
    expect(loadPins("obj")).toEqual([]);
  });
});
