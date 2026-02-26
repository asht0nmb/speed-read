import { useState, useEffect, useRef, useCallback } from "react";
import { THEME, FONTS, tokenize, findORP, pauseMultiplier } from "./utils.js";
import { extractWithPDFJS, parseTOC } from "./pdf.js";
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
} from "./persistence.js";
import {
  Menu,
  Zap,
  AlignLeft,
  FileText,
  Keyboard,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Eye,
  Upload,
  Bookmark,
  Linkedin,
  Github
} from "lucide-react";

// ─── Sub-components ───────────────────────────────────────────────────────────

export function WordDisplay({ word, showORP, upcomingText }) {
  if (!word) return null;
  const orpIndex = findORP(word);
  const before = word.slice(0, orpIndex);
  const focus = word[orpIndex] || "";
  const after = word.slice(orpIndex + 1);

  return (
    <div style={{ position: "relative", flex: 1, width: "100%" }}>
      {/* Vertical center guide */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: `linear-gradient(to bottom, transparent, ${THEME.accent}33, transparent)`,
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}
      />
      {/* Word pinned so ORP letter sits at 50% */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% - ${orpIndex + 0.5}ch)`,
          top: "50%",
          transform: "translateY(-50%)",
          whiteSpace: "nowrap",
          fontFamily: FONTS.display,
          fontSize: "clamp(2rem, 6vw, 4.5rem)",
          letterSpacing: "0.02em",
          color: THEME.text,
        }}
      >
        {before}
        <span
          style={{
            color: showORP ? THEME.focusLetter : THEME.text,
            fontWeight: showORP ? 700 : 400,
            textShadow: showORP ? `0 0 30px ${THEME.accent}55` : "none",
          }}
        >
          {focus}
        </span>
        {after}
      </div>
      {/* Upcoming words preview to the right of the current word */}
      {upcomingText && (
        <div
          style={{
            position: "absolute",
            left: `calc(50% + ${word.length - orpIndex - 0.5 + 0.75}ch)`,
            top: "50%",
            transform: "translateY(-50%)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: `calc(50vw - ${word.length - orpIndex}ch)`,
            fontFamily: FONTS.display,
            fontSize: "clamp(2rem, 6vw, 4.5rem)",
            letterSpacing: "0.02em",
            color: THEME.textDim + "44",
            pointerEvents: "none",
          }}
        >
          {upcomingText}
        </div>
      )}
    </div>
  );
}

function Slider({ value, onChange, min, max, step, label, displayValue, onLabelClick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 130 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: FONTS.body,
          fontSize: 11,
          color: THEME.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        <span
          onClick={onLabelClick}
          style={{
            cursor: onLabelClick ? "pointer" : "default",
            textDecoration: onLabelClick ? "underline" : "none",
            textUnderlineOffset: 3,
          }}
        >
          {label}
        </span>
        <span style={{ color: THEME.accent, fontFamily: FONTS.display }}>
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          height: 4,
          appearance: "none",
          background: `linear-gradient(to right, ${THEME.accent} ${
            ((value - min) / (max - min)) * 100
          }%, ${THEME.border} ${((value - min) / (max - min)) * 100}%)`,
          borderRadius: 2,
          outline: "none",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

function IconButton({ onClick, children, active, size = 36, title, style: extraStyle }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? THEME.accentDim : "transparent",
        border: `1px solid ${active ? THEME.accent + "66" : THEME.border}`,
        borderRadius: 8,
        color: active ? THEME.accent : THEME.textDim,
        cursor: "pointer",
        transition: "all 0.15s",
        fontSize: 15,
        flexShrink: 0,
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

// ─── TOC Panel ────────────────────────────────────────────────────────────────

export function TOCPanel({ entries, currentIndex, onSeek, onClose }) {
  const currentEntry = entries.reduce((best, e) => {
    if (e.wordIndex <= currentIndex) return e;
    return best;
  }, entries[0]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 40,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 320,
          background: THEME.surface,
          borderRight: `1px solid ${THEME.border}`,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${THEME.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: THEME.textDim,
            }}
          >
            Contents
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: THEME.textDim,
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {entries.map((e, i) => {
            const isActive = e === currentEntry;
            return (
              <button
                key={i}
                onClick={() => {
                  onSeek(e.wordIndex);
                  onClose();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: `8px ${20 + e.depth * 16}px`,
                  background: isActive ? THEME.accentDim : "transparent",
                  border: "none",
                  borderLeft: isActive
                    ? `2px solid ${THEME.accent}`
                    : "2px solid transparent",
                  color: isActive ? THEME.accent : THEME.textDim,
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {e.title}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    opacity: 0.5,
                  }}
                >
                  p.{e.pageNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── PDF Page Renderer ────────────────────────────────────────────────────────

function PDFPage({ pdfDoc, pageNum, isCurrentPage, onPageClick }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
        }).promise;
      } catch (_) {}
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNum]);

  return (
    <div
      onClick={() => onPageClick(pageNum)}
      style={{
        margin: "0 auto 24px",
        maxWidth: 700,
        border: isCurrentPage
          ? `2px solid ${THEME.accent}`
          : `1px solid ${THEME.border}`,
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.2s",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
    </div>
  );
}

function PDFPages({ pdfDoc, currentPageNum, onPageClick }) {
  if (!pdfDoc) return null;
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 20px",
      }}
    >
      {Array.from({ length: pdfDoc.numPages }, (_, i) => (
        <PDFPage
          key={i + 1}
          pdfDoc={pdfDoc}
          pageNum={i + 1}
          isCurrentPage={currentPageNum === i + 1}
          onPageClick={onPageClick}
        />
      ))}
    </div>
  );
}

// ─── Keyboard Hints Panel ─────────────────────────────────────────────────────

function KeyboardHints({ onClose }) {
  const shortcuts = [
    ["Space", "Play / Pause"],
    ["← →", "Jump ±10 words"],
    ["[ ]", "Speed ±25 WPM"],
    ["R", "Restart"],
    ["T", "Toggle full text"],
    ["P", "Toggle PDF view"],
    ["O", "Toggle ORP highlight"],
    ["M", "Add pin at position"],
    ["B", "Jump to bookmark"],
    ["?", "This panel"],
    ["Esc", "Pause / close panels"],
  ];
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          background: THEME.surface,
          border: `1px solid ${THEME.border}`,
          borderRadius: 12,
          padding: "24px 32px",
          zIndex: 50,
          minWidth: 300,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: THEME.textDim,
            }}
          >
            Keyboard shortcuts
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: THEME.textDim,
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            <X size={16} />
          </button>
        </div>
        {shortcuts.map(([key, desc]) => (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 24,
              marginBottom: 10,
              fontSize: 13,
              fontFamily: FONTS.body,
            }}
          >
            <kbd
              style={{
                fontFamily: FONTS.display,
                fontSize: 12,
                color: THEME.accent,
                background: THEME.accentDim,
                border: `1px solid ${THEME.accent}44`,
                borderRadius: 4,
                padding: "2px 8px",
                whiteSpace: "nowrap",
              }}
            >
              {key}
            </kbd>
            <span style={{ color: THEME.textDim }}>{desc}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Margin Preview Modal ─────────────────────────────────────────────────────

function MarginPreview({ pdfDoc, pageNum, marginPercent, onMarginChange, onClose }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
        }).promise;
      } catch (_) {}
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNum]);

  const zonePct = `${marginPercent * 100}%`;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          background: THEME.surface,
          border: `1px solid ${THEME.border}`,
          borderRadius: 12,
          padding: "24px 32px",
          zIndex: 50,
          maxWidth: 600,
          width: "90vw",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: THEME.textDim,
            }}
          >
            Adjust Margins
          </span>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: THEME.textDim,
            }}
          >
            Page {pageNum}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: THEME.textDim,
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", display: "block" }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: zonePct,
              background: "rgba(220,50,50,0.15)",
              borderBottom: `2px dashed ${THEME.accent}`,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: zonePct,
              background: "rgba(220,50,50,0.15)",
              borderTop: `2px dashed ${THEME.accent}`,
              pointerEvents: "none",
            }}
          />
        </div>
        <Slider
          label="Margins"
          value={marginPercent}
          onChange={onMarginChange}
          min={0}
          max={0.25}
          step={0.01}
          displayValue={`${Math.round(marginPercent * 100)}%`}
        />
      </div>
    </>
  );
}

// ─── Resume Banner ───────────────────────────────────────────────────────────

function ResumeBanner({ wordIndex, totalWords, isFresh, onResume, onDismiss }) {
  const pct = Math.round((wordIndex / totalWords) * 100);
  return (
    <div
      style={{
        background: THEME.accentDim,
        borderBottom: `1px solid ${THEME.accent}44`,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexShrink: 0,
        fontFamily: FONTS.body,
        fontSize: 13,
      }}
    >
      <span style={{ color: THEME.textDim }}>
        {isFresh
          ? `Resume from ${pct}% (word ${wordIndex.toLocaleString()})`
          : `Bookmark at ${pct}% — word count changed, position may be approximate`}
      </span>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={onResume}
          style={{
            background: THEME.accent,
            border: "none",
            borderRadius: 6,
            color: "#fff",
            padding: "4px 12px",
            fontFamily: FONTS.body,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Resume
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: `1px solid ${THEME.border}`,
            borderRadius: 6,
            color: THEME.textDim,
            padding: "4px 12px",
            fontFamily: FONTS.body,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Start over
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SpeedReader() {
  // Content state
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(() => loadSettings().wpm);
  const [chunkSize, setChunkSize] = useState(() => loadSettings().chunkSize);

  // PDF
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageBreaks, setPageBreaks] = useState([]);
  const [tocEntries, setTocEntries] = useState([]);
  const [spacingThreshold, setSpacingThreshold] = useState(1.2);
  const [marginPercent, setMarginPercent] = useState(() => loadSettings().marginPercent);

  // UI state
  const [viewMode, setViewMode] = useState("rsvp"); // 'rsvp' | 'text' | 'pdf'
  const [showORP, setShowORP] = useState(() => loadSettings().showORP);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadTab, setUploadTab] = useState("file"); // 'file' | 'paste'
  const [pasteText, setPasteText] = useState("");
  const [showTOC, setShowTOC] = useState(false);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  const [showMarginPreview, setShowMarginPreview] = useState(false);

  // Persistence
  const [contentHash, setContentHash] = useState(null);
  const [pendingResume, setPendingResume] = useState(null);

  // Named pins (user bookmarks)
  const [pins, setPins] = useState([]);

  const timeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentFileRef = useRef(null);
  const saveTimerRef = useRef(null);

  // ── Playback engine (recursive setTimeout for smart pauses) ──────────────

  const scheduleNext = useCallback(
    (index) => {
      if (index >= words.length) {
        setIsPlaying(false);
        return;
      }
      const word = words[Math.min(index + chunkSize - 1, words.length - 1)];
      const baseMs = (60000 / wpm) * chunkSize;
      const delay = baseMs * pauseMultiplier(word);

      timeoutRef.current = setTimeout(() => {
        const next = index + chunkSize;
        if (next >= words.length) {
          setIsPlaying(false);
          setCurrentIndex(words.length - 1);
          return;
        }
        setCurrentIndex(next);
        scheduleNext(next);
      }, delay);
    },
    [words, wpm, chunkSize]
  );

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    if (isPlaying && words.length > 0) {
      scheduleNext(currentIndex);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [isPlaying, scheduleNext, words.length]);

  const togglePlay = useCallback(() => {
    if (currentIndex >= words.length - 1) setCurrentIndex(0);
    setIsPlaying((p) => !p);
  }, [currentIndex, words.length]);

  const restart = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
    if (contentHash) clearBookmark(contentHash);
    setPendingResume(null);
  }, [contentHash]);

  // ── Auto-save bookmark (debounced) ─────────────────────────────────────────

  useEffect(() => {
    if (!contentHash || words.length === 0 || currentIndex === 0) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveBookmark(contentHash, fileName, currentIndex, words.length);
    }, 1500);
    return () => clearTimeout(saveTimerRef.current);
  }, [contentHash, currentIndex, words.length, fileName]);

  // ── Auto-save settings ─────────────────────────────────────────────────────

  useEffect(() => {
    saveSettings({ wpm, chunkSize, showORP, marginPercent });
  }, [wpm, chunkSize, showORP, marginPercent]);

  // ── Named pins ──────────────────────────────────────────────────────────

  const addPin = useCallback(() => {
    const context = words.slice(Math.max(0, currentIndex - 5), currentIndex + 6).join(" ");
    const newPin = { wordIndex: currentIndex, context, createdAt: Date.now() };
    const updated = [...pins, newPin].sort((a, b) => a.wordIndex - b.wordIndex);
    const deduped = updated.filter(
      (p, i) => i === 0 || Math.abs(p.wordIndex - updated[i - 1].wordIndex) > 5
    );
    setPins(deduped);
    if (contentHash) savePins(contentHash, deduped);
  }, [words, currentIndex, pins, contentHash]);

  const removePin = useCallback(
    (wordIndex) => {
      const updated = pins.filter((p) => p.wordIndex !== wordIndex);
      setPins(updated);
      if (contentHash) savePins(contentHash, updated);
    },
    [pins, contentHash]
  );

  // ── File processing ───────────────────────────────────────────────────────

  const processFile = useCallback(
    async (file) => {
      setIsPlaying(false);
      setCurrentIndex(0);
      setFileName(file.name);
      setUploadError("");
      setViewMode("rsvp");
      setPdfDoc(null);
      setPageBreaks([]);
      setTocEntries([]);
      setPendingResume(null);
      setPins([]);
      currentFileRef.current = null;

      // Compute content hash for bookmarking (fast — samples only 16KB)
      const hash = await hashFile(file);
      setContentHash(hash);

      const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");

      let tokenizedWords = [];
      if (isPDF) {
        try {
          currentFileRef.current = file;
          const { text, pageBreaks: pb, pdfDoc: doc } = await extractWithPDFJS(
            file,
            spacingThreshold,
            marginPercent
          );
          if (!text || text.trim().length < 20) throw new Error("Empty extraction");
          tokenizedWords = tokenize(text);
          setRawText(text);
          setWords(tokenizedWords);
          setPageBreaks(pb);
          setPdfDoc(doc);
          parseTOC(doc, pb).then(setTocEntries).catch(() => {});
        } catch (err) {
          console.error("PDF extraction failed:", err);
          setUploadError(
            "Could not extract text from this PDF. Try a different file or switch to Paste mode."
          );
          return;
        }
      } else {
        try {
          const text = await file.text();
          if (!text || text.trim().length === 0) throw new Error("Empty");
          tokenizedWords = tokenize(text);
          setRawText(text);
          setWords(tokenizedWords);
        } catch {
          setUploadError("Could not read this file. Try a plain text or PDF file.");
          return;
        }
      }

      // Check for existing bookmark
      const bookmark = loadBookmark(hash);
      if (bookmark && bookmark.wordIndex > 0 && bookmark.wordIndex < tokenizedWords.length) {
        const drift = Math.abs(bookmark.wordCount - tokenizedWords.length) / bookmark.wordCount;
        setPendingResume({
          wordIndex: bookmark.wordIndex,
          isFresh: drift <= 0.05,
        });
      }

      // Load named pins
      setPins(loadPins(hash));
    },
    [spacingThreshold, marginPercent]
  );

  // Re-extract when spacing threshold or margin changes
  const reExtract = useCallback(
    async (threshold, margin) => {
      if (!currentFileRef.current) return;
      try {
        const { text, pageBreaks: pb, pdfDoc: doc } = await extractWithPDFJS(
          currentFileRef.current,
          threshold,
          margin
        );
        setRawText(text);
        setWords(tokenize(text));
        setPageBreaks(pb);
        setPdfDoc(doc);
        setCurrentIndex(0);
        parseTOC(doc, pb).then(setTocEntries).catch(() => {});
      } catch (err) {
        console.error("Re-extraction failed:", err);
      }
    },
    []
  );

  const handleFile = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const startFromPaste = useCallback(() => {
    if (!pasteText.trim()) {
      setUploadError("Paste some text first.");
      return;
    }
    setIsPlaying(false);
    setCurrentIndex(0);
    setFileName("Pasted text");
    setPdfDoc(null);
    setPageBreaks([]);
    setTocEntries([]);
    setViewMode("rsvp");
    setUploadError("");
    setPendingResume(null);
    setPins([]);

    const hash = "paste:" + hashText(pasteText);
    setContentHash(hash);

    const tokenizedWords = tokenize(pasteText);
    setRawText(pasteText);
    setWords(tokenizedWords);

    // Check for existing bookmark
    const bookmark = loadBookmark(hash);
    if (bookmark && bookmark.wordIndex > 0 && bookmark.wordIndex < tokenizedWords.length) {
      const drift = Math.abs(bookmark.wordCount - tokenizedWords.length) / bookmark.wordCount;
      setPendingResume({
        wordIndex: bookmark.wordIndex,
        isFresh: drift <= 0.05,
      });
    }

    // Load named pins
    setPins(loadPins(hash));
  }, [pasteText]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (words.length > 0) togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          setCurrentIndex((i) => Math.max(0, i - 10));
          break;
        case "ArrowRight":
          e.preventDefault();
          setCurrentIndex((i) => Math.min(words.length - 1, i + 10));
          break;
        case "[":
          setWpm((w) => Math.max(100, w - 25));
          break;
        case "]":
          setWpm((w) => Math.min(1000, w + 25));
          break;
        case "r":
        case "R":
          restart();
          break;
        case "t":
        case "T":
          setViewMode((m) => (m === "text" ? "rsvp" : "text"));
          break;
        case "p":
        case "P":
          if (pdfDoc) setViewMode((m) => (m === "pdf" ? "rsvp" : "pdf"));
          break;
        case "o":
        case "O":
          setShowORP((v) => !v);
          break;
        case "?":
          setShowKeyboardHints((v) => !v);
          break;
        case "b":
        case "B":
          if (pendingResume) {
            setCurrentIndex(pendingResume.wordIndex);
            setPendingResume(null);
          }
          break;
        case "m":
        case "M":
          if (words.length > 0) addPin();
          break;
        case "Escape":
          setIsPlaying(false);
          setShowTOC(false);
          setShowKeyboardHints(false);
          setShowMarginPreview(false);
          setPendingResume(null);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [words.length, togglePlay, restart, pdfDoc, pendingResume, addPin]);

  // ── Derived values ────────────────────────────────────────────────────────

  const currentChunk = words.slice(currentIndex, currentIndex + chunkSize).join(" ");
  const progress = words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0;
  const timeLeft = words.length > 0
    ? (() => {
        const baseMs = 60000 / wpm;
        let totalMs = 0;
        for (let i = currentIndex; i < words.length; i += chunkSize) {
          const lastWord = words[Math.min(i + chunkSize - 1, words.length - 1)];
          totalMs += baseMs * chunkSize * pauseMultiplier(lastWord);
        }
        return Math.ceil(totalMs / 60000);
      })()
    : 0;

  const currentPageNum =
    pageBreaks.length > 0
      ? [...pageBreaks].reverse().find((pb) => pb.wordIndex <= currentIndex)
          ?.pageNum ?? 1
      : 1;

  // ── Upload screen ─────────────────────────────────────────────────────────

  if (words.length === 0) {
    return (
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          background: THEME.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONTS.body,
          color: THEME.text,
          padding: 24,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (uploadTab === "file") setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div style={{ textAlign: "center", maxWidth: 480, width: "100%" }}>
          {/* Logo */}
          <h1
            style={{
              fontFamily: FONTS.display,
              fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
              fontWeight: 400,
              marginBottom: 8,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: THEME.accent }}>speed</span>read
          </h1>
          {/* <p
            style={{
              color: THEME.textDim,
              fontSize: 14,
              marginBottom: 36,
              fontWeight: 300,
            }}
          >
            open-source speed reader
          </p> */}

          {/* INTERACTIVE SUBTITLE */}
          <p
            style={{
              color: THEME.textDim,
              fontSize: 14,
              marginBottom: 36,
              fontWeight: 300,
              textAlign: "center",
            }}
          >
            <a
              href="https://github.com/asht0nmb/speed-read"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: THEME.textDim,
                textDecoration: "underline",
                textUnderlineOffset: 3, // Pushes the underline down slightly for a cleaner look
                transition: "color 0.15s",
                cursor: "pointer",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = THEME.accent)}
              onMouseOut={(e) => (e.currentTarget.style.color = THEME.textDim)}
            >
              open-source
            </a>{" "}
            speed reader
          </p>

          {/* Error banner */}
          {uploadError && (
            <div
              style={{
                background: "rgba(220,50,50,0.12)",
                border: "1px solid rgba(220,50,50,0.35)",
                borderRadius: 8,
                padding: "10px 16px",
                marginBottom: 20,
                color: "#ff7070",
                fontSize: 13,
                fontFamily: FONTS.body,
                textAlign: "left",
              }}
            >
              {uploadError}
            </div>
          )}

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${THEME.border}`,
              marginBottom: 24,
            }}
          >
            {["file", "paste"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setUploadTab(tab);
                  setUploadError("");
                }}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: "transparent",
                  border: "none",
                  borderBottom: uploadTab === tab
                    ? `2px solid ${THEME.accent}`
                    : "2px solid transparent",
                  color: uploadTab === tab ? THEME.accent : THEME.textDim,
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: "all 0.15s",
                  marginBottom: -1,
                }}
              >
                {tab === "file" ? "File" : "Paste text"}
              </button>
            ))}
          </div>

          {/* File tab */}
          {uploadTab === "file" && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? THEME.accent : THEME.border}`,
                  borderRadius: 16,
                  padding: "56px 40px",
                  cursor: "pointer",
                  transition: "all 0.3s",
                  background: isDragging ? THEME.accentDim : "transparent",
                }}
              >
                <div
                  style={{
                    fontSize: 36,
                    marginBottom: 16,
                    opacity: 0.6,
                    color: isDragging ? THEME.accent : THEME.textDim,
                  }}
                >
                  <Upload size={28} />
                </div>
                <p
                  style={{
                    color: THEME.textDim,
                    fontSize: 15,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  Drop a PDF or text file here
                  <br />
                  <span style={{ fontSize: 12, opacity: 0.6 }}>
                    or click to browse
                  </span>
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.html"
                onChange={handleFile}
                style={{ display: "none" }}
              />
              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  gap: 24,
                  justifyContent: "center",
                  color: THEME.textDim,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                }}
              >
                <span>PDF</span>
                <span>TXT</span>
                <span>MD</span>
              </div>
            </>
          )}

          {/* Paste tab */}
          {uploadTab === "paste" && (
            <div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your text here…"
                style={{
                  width: "100%",
                  height: 220,
                  background: THEME.surface,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 12,
                  padding: 16,
                  color: THEME.text,
                  fontFamily: FONTS.body,
                  fontSize: 14,
                  lineHeight: 1.7,
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <button
                onClick={startFromPaste}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: "12px 0",
                  background: THEME.accent,
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontFamily: FONTS.body,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Start Reading
              </button>
            </div>
          )}
        </div>
        
        <div
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            display: "flex",
            gap: 1,
            fontFamily: FONTS.body,
            fontSize: 12,
            color: THEME.textDim,
          }}
        >
          {/* LinkedIn */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span>created by</span>
            <a
              href="https://www.linkedin.com/in/ashton-meyer-bibbins/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: THEME.textDim,
                display: "flex",
                transition: "color 0.15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = THEME.accent)}
              onMouseOut={(e) => (e.currentTarget.style.color = THEME.textDim)}
            >
              ashton
              {/*<Linkedin size={16} />*/} {/* linkedin logo */}
            </a>
          </div>

          {/* GitHub */}
          {/* <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span></span>
            <a
              href="https://github.com/asht0nmb/speed-read"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: THEME.textDim,
                display: "flex",
                transition: "color 0.15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = THEME.accent)}
              onMouseOut={(e) => (e.currentTarget.style.color = THEME.textDim)}
            >
              <Github size={16} />
            </a>
          </div> */}
        </div>
      </div>
    );
  }

  // ── Reader screen ─────────────────────────────────────────────────────────

  return (
    <div
      style={{
        height: "100vh",
        background: THEME.bg,
        fontFamily: FONTS.body,
        color: THEME.text,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Overlays */}
      {showTOC && tocEntries.length > 0 && (
        <TOCPanel
          entries={tocEntries}
          currentIndex={currentIndex}
          onSeek={(idx) => {
            setCurrentIndex(idx);
            setIsPlaying(false);
          }}
          onClose={() => setShowTOC(false)}
        />
      )}
      {showKeyboardHints && (
        <KeyboardHints onClose={() => setShowKeyboardHints(false)} />
      )}
      {showMarginPreview && pdfDoc && (
        <MarginPreview
          pdfDoc={pdfDoc}
          pageNum={currentPageNum}
          marginPercent={marginPercent}
          onMarginChange={(v) => {
            setMarginPercent(v);
            reExtract(spacingThreshold, v);
          }}
          onClose={() => setShowMarginPreview(false)}
        />
      )}

      {/* Progress bar */}
      <div style={{ height: 2, background: THEME.border, flexShrink: 0 }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${THEME.accent}, ${THEME.accent}cc)`,
            transition: isPlaying ? "width 0.1s linear" : "width 0.3s ease",
          }}
        />
      </div>

      {/* Resume banner */}
      {pendingResume && (
        <ResumeBanner
          wordIndex={pendingResume.wordIndex}
          totalWords={words.length}
          isFresh={pendingResume.isFresh}
          onResume={() => {
            setCurrentIndex(pendingResume.wordIndex);
            setPendingResume(null);
          }}
          onDismiss={() => {
            setPendingResume(null);
            if (contentHash) clearBookmark(contentHash);
          }}
        />
      )}

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: `1px solid ${THEME.border}`,
          flexShrink: 0,
          gap: 12,
        }}
      >
        {/* Left: TOC + logo + file name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          {tocEntries.length > 0 && (
            <IconButton
              onClick={() => {
                setIsPlaying(false);
                setShowTOC(true);
              }}
              active={showTOC}
              title="Table of contents"
              size={30}
            >
              <Menu size={14} />
            </IconButton>
          )}
          <span style={{ fontFamily: FONTS.display, fontSize: 13 }}>
            <span style={{ color: THEME.accent }}>speed</span>read
          </span>
          <span style={{ color: THEME.textDim, fontSize: 12 }}>·</span>
          <span
            style={{
              color: THEME.textDim,
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fileName}
          </span>
        </div>

        {/* Right: view mode tabs + actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {/* View mode buttons */}
          <IconButton
            onClick={() => setViewMode("rsvp")}
            active={viewMode === "rsvp"}
            title="RSVP view"
          >
            <Zap size={16} />
          </IconButton>
          <IconButton
            onClick={() => setViewMode("text")}
            active={viewMode === "text"}
            title="Full text (T)"
          >
            <AlignLeft size={16} />
          </IconButton>
          {pdfDoc && (
            <IconButton
              onClick={() => setViewMode("pdf")}
              active={viewMode === "pdf"}
              title="PDF view (P)"
            >
              <FileText size={16} />
            </IconButton>
          )}

          <div
            style={{
              width: 1,
              background: THEME.border,
              margin: "0 4px",
            }}
          />

          <IconButton
            onClick={() => setShowKeyboardHints(true)}
            title="Keyboard shortcuts (?)"
          >
            <Keyboard size={16} />
          </IconButton>
          <IconButton
            onClick={() => {
              setWords([]);
              setRawText("");
              setFileName("");
              setCurrentIndex(0);
              setIsPlaying(false);
              setPdfDoc(null);
              setPageBreaks([]);
              setTocEntries([]);
              setContentHash(null);
              setPendingResume(null);
              setPins([]);
              currentFileRef.current = null;
            }}
            title="New file"
          >
            <X size={16} />
          </IconButton>
        </div>
      </div>

      {/* Main content area */}
      {viewMode === "text" ? (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Text content */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "40px 20px",
              maxWidth: 680,
              margin: "0 auto",
              width: "100%",
            }}
          >
            <p
              style={{
                lineHeight: 1.8,
                fontSize: 15,
                color: THEME.textDim,
                fontWeight: 300,
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {words.map((w, i) => {
                const pin = pins.find((p) => p.wordIndex === i);
                return (
                  <span
                    key={i}
                    style={{ position: "relative" }}
                    {...(pin ? { "data-word-index": i } : {})}
                  >
                    {pin && (
                      <span
                        data-testid={`pin-indicator-${i}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentIndex(pin.wordIndex);
                        }}
                        style={{
                          position: "absolute",
                          left: -16,
                          top: "0.15em",
                          color: THEME.accent,
                          cursor: "pointer",
                        }}
                      >
                        <Bookmark size={10} />
                      </span>
                    )}
                    <span
                      onClick={() => {
                        setCurrentIndex(i);
                        setViewMode("rsvp");
                      }}
                      style={{
                        cursor: "pointer",
                        color:
                          i === currentIndex
                            ? THEME.accent
                            : i < currentIndex
                            ? THEME.textDim + "66"
                            : THEME.textDim,
                        fontWeight: i === currentIndex ? 500 : 300,
                        transition: "color 0.15s",
                        borderBottom:
                          i === currentIndex
                            ? `1px solid ${THEME.accent}`
                            : "none",
                      }}
                    >
                      {w}{" "}
                    </span>
                  </span>
                );
              })}
            </p>
          </div>

          {/* Pins sidebar */}
          {pins.length > 0 && (
            <div
              style={{
                width: 220,
                borderLeft: `1px solid ${THEME.border}`,
                overflowY: "auto",
                padding: "16px 12px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: THEME.textDim,
                  marginBottom: 12,
                }}
              >
                Pins
              </div>
              {pins.map((pin) => (
                <div
                  key={pin.wordIndex}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                    marginBottom: 10,
                    padding: "6px 8px",
                    borderRadius: 6,
                    background:
                      pin.wordIndex === currentIndex
                        ? THEME.accentDim
                        : "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onClick={() => {
                    const el = document.querySelector(
                      `[data-word-index="${pin.wordIndex}"]`
                    );
                    if (el) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }
                  }}
                >
                  <Bookmark
                    size={12}
                    style={{
                      color: THEME.accent,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: THEME.textDim,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {pin.context}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: THEME.textDim + "88",
                        marginTop: 2,
                      }}
                    >
                      word {pin.wordIndex + 1}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePin(pin.wordIndex);
                    }}
                    title="Remove pin"
                    style={{
                      background: "none",
                      border: "none",
                      color: THEME.textDim,
                      cursor: "pointer",
                      padding: 2,
                      flexShrink: 0,
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "pdf" && pdfDoc ? (
        <PDFPages
          pdfDoc={pdfDoc}
          currentPageNum={currentPageNum}
          onPageClick={(pageNum) => {
            const pb = pageBreaks.find((p) => p.pageNum === pageNum);
            if (pb) {
              setCurrentIndex(pb.wordIndex);
              setIsPlaying(false);
              setViewMode("rsvp");
            }
          }}
        />
      ) : (
        // RSVP view
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            userSelect: "none",
            cursor: "pointer",
            overflow: "hidden",
          }}
          onClick={togglePlay}
        >
          <WordDisplay
            word={currentChunk}
            showORP={showORP}
            upcomingText={
              !isPlaying && currentIndex + chunkSize < words.length
                ? (() => {
                    const MAX_CHARS = 80;
                    const upcoming = words.slice(currentIndex + chunkSize);
                    let preview = "";
                    for (let i = 0; i < upcoming.length; i++) {
                      const next = preview ? preview + " " + upcoming[i] : upcoming[i];
                      if (next.length > MAX_CHARS) break;
                      preview = next;
                    }
                    return preview || null;
                  })()
                : null
            }
          />
          <div
            style={{
              flexShrink: 0,
              padding: "12px 0",
              color: THEME.textDim,
              fontSize: 12,
              fontFamily: FONTS.display,
              letterSpacing: "0.05em",
            }}
          >
            {currentIndex + 1} / {words.length}
            <span style={{ margin: "0 10px", opacity: 0.3 }}>·</span>
            {timeLeft} min left
            {pageBreaks.length > 0 && (
              <>
                <span style={{ margin: "0 10px", opacity: 0.3 }}>·</span>
                p.{currentPageNum}
              </>
            )}
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div
        style={{
          borderTop: `1px solid ${THEME.border}`,
          padding: "14px 16px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Playback row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <IconButton
              onClick={addPin}
              title="Add pin (M)"
              active={pins.some((p) => p.wordIndex === currentIndex)}
            >
              <Bookmark size={16} />
            </IconButton>
            <IconButton
              onClick={() =>
                setCurrentIndex((i) => Math.max(0, i - 10))
              }
              title="Back 10 words (←)"
            >
              <ChevronLeft size={16} />
            </IconButton>

            <button
              onClick={togglePlay}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: THEME.accent,
                border: "none",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                boxShadow: `0 0 24px ${THEME.accent}44`,
                transition: "transform 0.15s",
                flexShrink: 0,
              }}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            <IconButton
              onClick={() =>
                setCurrentIndex((i) =>
                  Math.min(words.length - 1, i + 10)
                )
              }
              title="Forward 10 words (→)"
            >
              <ChevronRight size={16} />
            </IconButton>
            <IconButton
              onClick={() => setShowORP((v) => !v)}
              active={showORP}
              title="Toggle ORP highlight (O)"
            >
              <Eye size={16} />
            </IconButton>
          </div>

          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={Math.max(0, words.length - 1)}
            value={currentIndex}
            onChange={(e) => {
              setCurrentIndex(Number(e.target.value));
              setIsPlaying(false);
            }}
            style={{
              width: "100%",
              height: 4,
              appearance: "none",
              background: `linear-gradient(to right, ${THEME.accent} ${progress}%, ${THEME.border} ${progress}%)`,
              borderRadius: 2,
              outline: "none",
              cursor: "pointer",
            }}
          />

          {/* Settings sliders */}
          <div
            style={{
              display: "flex",
              gap: 20,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Slider
              label="Speed"
              value={wpm}
              onChange={setWpm}
              min={100}
              max={1000}
              step={25}
              displayValue={`${wpm} wpm`}
            />
            <Slider
              label="Chunk"
              value={chunkSize}
              onChange={setChunkSize}
              min={1}
              max={5}
              step={1}
              displayValue={`${chunkSize}w`}
            />
            {currentFileRef.current && (
              <>
                <Slider
                  label="Spacing"
                  value={spacingThreshold}
                  onChange={(v) => {
                    setSpacingThreshold(v);
                    reExtract(v, marginPercent);
                  }}
                  min={0.3}
                  max={3.0}
                  step={0.1}
                  displayValue={spacingThreshold.toFixed(1)}
                />
                <Slider
                  label="Margins"
                  value={marginPercent}
                  onChange={(v) => {
                    setMarginPercent(v);
                    reExtract(spacingThreshold, v);
                  }}
                  min={0}
                  max={0.25}
                  step={0.01}
                  displayValue={`${Math.round(marginPercent * 100)}%`}
                  onLabelClick={() => setShowMarginPreview(true)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Global styles */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${THEME.accent};
          cursor: pointer;
          box-shadow: 0 0 8px ${THEME.accent}66;
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${THEME.accent};
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px ${THEME.accent}66;
        }
      `}</style>
    </div>
  );
}
