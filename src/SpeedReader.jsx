import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { THEME, FONTS, tokenize, findORP, pauseMultiplier, cleanText, filterTokens } from "./utils.js";
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
  saveRecentDoc,
  loadRecentDocs,
  updateRecentDocProgress,
  removeRecentDoc,
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
  Github,
  Settings,
  Clock,
  Trash2,
  Globe,
  BookOpen,
  Link as LinkIcon,
  Type,
  FileType,
} from "lucide-react";

// ─── Demo text ────────────────────────────────────────────────────────────────

const DEMO_TEXT = `Speed reading is the art of absorbing written information faster than the average reading pace of about 250 words per minute. The technique you are experiencing right now is called Rapid Serial Visual Presentation, or RSVP. Instead of scanning your eyes across a page, words are flashed one at a time at a fixed point on screen.

Your eyes naturally land on a specific letter in each word called the Optimal Recognition Point. This app highlights that letter in orange so your brain can lock onto it instantly. Research shows that much of the time spent reading is actually consumed by eye movements called saccades, the tiny jumps your gaze makes between words. By eliminating saccades entirely, RSVP lets you process text significantly faster.

Most people find they can comfortably read at 300 to 400 words per minute with RSVP after just a few minutes of practice. Some experienced speed readers push well beyond 600 words per minute while maintaining good comprehension. The key is to relax your inner voice and let the words flow naturally without subvocalizing every syllable.

This demo text is designed to give you a feel for the reader controls. Try adjusting the speed slider below, skip forward and backward with the arrow buttons, or drop a pin to bookmark this spot. You can switch to full text view to see all the words at once and click any word to jump directly to it.

Speed reading works especially well for reviewing familiar material, scanning articles for key ideas, and powering through dense technical documents. It pairs nicely with traditional careful reading, which remains essential for poetry, legal contracts, and complex arguments that reward slow deliberation. Think of RSVP as another tool in your reading toolkit, perfect for when you need to cover ground quickly.`;

const DEMO_TOC = [
  { title: "What is Speed Reading?", pageNum: 1, wordIndex: 0, depth: 0 },
  { title: "The Optimal Recognition Point", pageNum: 1, wordIndex: 53, depth: 0 },
  { title: "Getting Started with RSVP", pageNum: 1, wordIndex: 117, depth: 0 },
];

// ─── Tutorial steps ───────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  { target: "word-display", headline: "RSVP Reading", body: "Words flash here one at a time at your chosen speed. Your eyes stay fixed at center \u2014 no scanning needed. The orange letter is the Optimal Recognition Point (ORP), the spot your brain locks onto fastest.", shortcut: null, placement: "below" },
  { target: "play-button", headline: "Play & Pause", body: "Start and stop playback.", shortcut: "Space", placement: "above" },
  { target: "back-forward", headline: "Skip Back & Forward", body: "Jump 10 words at a time.", shortcut: "\u2190 \u2192", placement: "above" },
  { target: "scrubber", headline: "Scrubber", body: "Drag to jump anywhere in the text.", shortcut: null, placement: "above" },
  { target: "progress-bar", headline: "Progress", body: null, label: "Tracks your reading progress.", shortcut: null, placement: "below" },
  { target: "wpm-slider", headline: "Reading Speed", body: "Set words-per-minute. Average is ~250 WPM \u2014 most people can push to 400\u2013500 with practice.", shortcut: "↑ ↓", placement: "above" },
  { target: "margins-slider", headline: "PDF Margins", body: null, label: "For PDFs, adjust margin cropping to exclude headers/footers.", shortcut: null, placement: "above" },
  { target: "orp-toggle", headline: "ORP Highlight", body: "Toggle the orange focus letter on or off. The ORP is the optimal point in each word for your eye to fixate.", shortcut: "O", placement: "above" },
  { target: "pin-button", headline: "Pins", body: "Drop a pin at your current position to bookmark it. Pins appear in text view with a sidebar listing all your bookmarks \u2014 click any pin to jump back to it.", shortcut: "M", placement: "above" },
  { target: "toc-button", headline: "Table of Contents", body: "For uploaded PDFs, this opens a table of contents panel. Click any heading to jump directly to that section.", shortcut: null, placement: "below" },
  { target: "view-modes", headline: "View Modes", body: "Switch between RSVP flash mode and full scrollable text. In text view, click any word to jump to it. PDF view appears when a PDF is loaded.", shortcut: "T", placement: "below" },
  { target: "settings-button", headline: "Settings", body: "Fine-tune chunk size (read multiple words at once), pause behavior at punctuation, and text filtering options.", shortcut: "S", placement: "below" },
  { target: "keyboard-hints", headline: "All Shortcuts", body: null, label: "See all keyboard shortcuts.", shortcut: "?", placement: "below" },
  { target: "close-button", headline: "New File", body: null, label: "Close and return to upload.", shortcut: null, placement: "below" },
];

// ─── Tutorial Overlay ─────────────────────────────────────────────────────────

function TutorialOverlay({ step, totalSteps, onNext, onBack, onSkip }) {
  const [rect, setRect] = useState(null);
  const stepDef = TUTORIAL_STEPS[step];
  const isHighlightOnly = !stepDef.body;

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(`[data-tutorial="${stepDef.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, stepDef.target]);

  if (!rect) return null;

  const pad = 8;
  const cutout = {
    x: rect.left - pad,
    y: rect.top - pad,
    w: rect.width + pad * 2,
    h: rect.height + pad * 2,
    rx: 10,
  };

  // Tooltip positioning
  const tooltipWidth = 320;
  const gap = 12;
  let tooltipStyle = {
    position: "fixed",
    zIndex: 62,
    width: tooltipWidth,
    maxWidth: "calc(100vw - 32px)",
  };

  const clampLeft = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));

  if (stepDef.placement === "above") {
    tooltipStyle.bottom = `${window.innerHeight - rect.top + gap}px`;
    tooltipStyle.left = `${clampLeft}px`;
  } else {
    const proposedTop = rect.top + rect.height + gap;
    // If tooltip would go off-screen, center it within the target instead
    if (proposedTop + 200 > window.innerHeight) {
      tooltipStyle.top = `${Math.max(16, rect.top + rect.height / 2 - 100)}px`;
    } else {
      tooltipStyle.top = `${proposedTop}px`;
    }
    tooltipStyle.left = `${clampLeft}px`;
  }

  return (
    <>
      {/* SVG mask scrim */}
      <svg
        style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none", width: "100%", height: "100%" }}
      >
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={cutout.x}
              y={cutout.y}
              width={cutout.w}
              height={cutout.h}
              rx={cutout.rx}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.6)"
          mask="url(#tutorial-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={onNext}
        />
      </svg>

      {/* Highlight border */}
      <div
        style={{
          position: "fixed",
          left: cutout.x,
          top: cutout.y,
          width: cutout.w,
          height: cutout.h,
          borderRadius: cutout.rx,
          border: `2px solid ${THEME.accent}`,
          boxShadow: `0 0 20px ${THEME.accent}44`,
          zIndex: 61,
          pointerEvents: "none",
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          ...tooltipStyle,
          background: THEME.surface,
          border: `1px solid ${THEME.border}`,
          borderRadius: 12,
          padding: isHighlightOnly ? "14px 18px" : "18px 22px",
          boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
          pointerEvents: "auto",
        }}
      >
        {/* Step counter */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            color: THEME.textDim,
            marginBottom: 6,
            letterSpacing: "0.05em",
          }}
        >
          {step + 1} / {totalSteps}
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: isHighlightOnly ? 14 : 16,
            color: THEME.text,
            marginBottom: isHighlightOnly ? 4 : 8,
            fontWeight: 500,
          }}
        >
          {stepDef.headline}
        </div>

        {/* Body or label */}
        {stepDef.body && (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: THEME.textDim,
              lineHeight: 1.6,
              marginBottom: 10,
            }}
          >
            {stepDef.body}
          </div>
        )}
        {isHighlightOnly && stepDef.label && (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              color: THEME.textDim,
              marginBottom: 8,
            }}
          >
            {stepDef.label}
          </div>
        )}

        {/* Keyboard shortcut badge */}
        {stepDef.shortcut && (
          <div style={{ marginBottom: 10 }}>
            <kbd
              style={{
                fontFamily: FONTS.display,
                fontSize: 11,
                color: THEME.accent,
                background: THEME.accentDim,
                border: `1px solid ${THEME.accent}44`,
                borderRadius: 4,
                padding: "2px 8px",
              }}
            >
              {stepDef.shortcut}
            </kbd>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          <button
            onClick={onSkip}
            style={{
              background: "none",
              border: "none",
              color: THEME.textDim,
              fontFamily: FONTS.body,
              fontSize: 12,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            Skip
          </button>
          {step > 0 && (
            <button
              onClick={onBack}
              style={{
                background: "transparent",
                border: `1px solid ${THEME.border}`,
                borderRadius: 6,
                color: THEME.textDim,
                fontFamily: FONTS.body,
                fontSize: 12,
                cursor: "pointer",
                padding: "5px 14px",
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={onNext}
            style={{
              background: THEME.accent,
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontFamily: FONTS.body,
              fontSize: 12,
              cursor: "pointer",
              padding: "5px 14px",
              fontWeight: 500,
            }}
          >
            {step === totalSteps - 1 ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

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
    ["↑ ↓", "Speed ±25 WPM"],
    ["R", "Restart"],
    ["T", "Toggle full text"],
    ["P", "Toggle PDF view"],
    ["O", "Toggle ORP highlight"],
    ["M", "Add pin at position"],
    ["B", "Jump to bookmark"],
    ["S", "Settings"],
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

// ─── Settings Modal ──────────────────────────────────────────────────────────

export function SettingsModal({
  chunkSize,
  onChunkChange,
  pauseScale,
  onPauseScaleChange,
  spacingThreshold,
  onSpacingChange,
  hasPDF,
  onClose,
  filterCitations,
  onFilterCitationsChange,
  filterReferenceSections,
  onFilterReferenceSectionsChange,
  filterCaptions,
  onFilterCaptionsChange,
  filterPageNumbers,
  onFilterPageNumbersChange,
}) {
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
            Settings
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
            fontFamily: FONTS.body,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: THEME.accent,
            marginBottom: 12,
          }}
        >
          Reading
        </div>

        <Slider
          label="Chunk"
          value={chunkSize}
          onChange={onChunkChange}
          min={1}
          max={5}
          step={2}
          displayValue={`${chunkSize} word${chunkSize > 1 ? "s" : ""}`}
        />
        <div style={{ fontFamily: FONTS.body, fontSize: 10, color: THEME.textDim, opacity: 0.6, marginTop: 2 }}>
          Words shown at once
        </div>
        <div style={{ height: 12 }} />
        <Slider
          label="Pause on punctuation"
          value={pauseScale}
          onChange={onPauseScaleChange}
          min={1.0}
          max={2.0}
          step={0.1}
          displayValue={`${pauseScale.toFixed(1)}×`}
        />
        <div style={{ fontFamily: FONTS.body, fontSize: 10, color: THEME.textDim, opacity: 0.6, marginTop: 2 }}>
          Extra delay after commas, periods, etc.
        </div>

        {hasPDF && (
          <>
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: THEME.accent,
                marginTop: 20,
                marginBottom: 12,
              }}
            >
              PDF
            </div>
            <Slider
              label="Spacing"
              value={spacingThreshold}
              onChange={onSpacingChange}
              min={0.3}
              max={3.0}
              step={0.1}
              displayValue={spacingThreshold.toFixed(1)}
            />
          </>
        )}

        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: THEME.accent,
            marginTop: 20,
            marginBottom: 12,
          }}
        >
          Filtering
        </div>

        {[
          { label: "Citations", desc: "Remove [1], (Smith, 2020), etc.", checked: filterCitations, onChange: onFilterCitationsChange },
          { label: "References", desc: "Remove References / Bibliography sections", checked: filterReferenceSections, onChange: onFilterReferenceSectionsChange },
          { label: "Captions", desc: "Remove Figure 1:, Table 2:, etc.", checked: filterCaptions, onChange: onFilterCaptionsChange },
          { label: "Page numbers", desc: "Remove standalone page numbers", checked: filterPageNumbers, onChange: onFilterPageNumbersChange },
        ].map(({ label, desc, checked, onChange }) => (
          <label
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: FONTS.body,
              fontSize: 13,
              color: THEME.text,
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              style={{ accentColor: THEME.accent, width: 16, height: 16, cursor: "pointer" }}
            />
            <span>
              {label}
              <span style={{ color: THEME.textDim, fontSize: 11, marginLeft: 6 }}>{desc}</span>
            </span>
          </label>
        ))}
      </div>
    </>
  );
}

// ─── Margin Preview Modal ─────────────────────────────────────────────────────

function MarginPreview({ pdfDoc, pageNum, marginPercent, onMarginChange, onClose }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const naturalVp = page.getViewport({ scale: 1 });

        const container = containerRef.current;
        if (!container || cancelled) return;

        const availableWidth = container.offsetWidth;
        const availableHeight = window.innerHeight * 0.6;

        const scaleByWidth = availableWidth / naturalVp.width;
        const scaleByHeight = availableHeight / naturalVp.height;
        const scale = Math.min(scaleByWidth, scaleByHeight);

        const viewport = page.getViewport({ scale });
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
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
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
          ref={containerRef}
          style={{
            overflow: "auto",
            borderRadius: 8,
            marginBottom: 16,
            flex: "1 1 auto",
            minHeight: 0,
          }}
        >
          <div style={{ position: "relative" }}>
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

// ─── EPUB extraction ─────────────────────────────────────────────────────────

async function extractWithEpub(file) {
  const ePub = (await import("epubjs")).default;
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  await book.ready;

  const spine = book.spine;
  let fullText = "";
  const pageBreaks = [];
  const tocEntries = [];

  // Extract text from spine items (chapters)
  let chapterIndex = 0;
  for (const item of spine.items) {
    const doc = await book.load(item.href);
    const wordsBefore = tokenize(fullText).length;
    pageBreaks.push({ pageNum: chapterIndex + 1, wordIndex: wordsBefore });

    const elements = doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6");
    const chapterParts = [];
    for (const el of elements) {
      const text = el.textContent.trim();
      if (text) chapterParts.push(text);
    }
    if (chapterParts.length > 0) {
      fullText += (fullText ? "\n\n" : "") + chapterParts.join("\n\n");
    }
    chapterIndex++;
  }

  // Extract TOC
  const nav = await book.loaded.navigation;
  if (nav && nav.toc) {
    const flattenNav = (items, depth = 0) => {
      for (const item of items) {
        // Find closest pageBreak by matching href
        const spineIdx = spine.items.findIndex((s) => item.href.includes(s.href));
        const pb = spineIdx >= 0 ? pageBreaks[spineIdx] : pageBreaks[0];
        tocEntries.push({
          title: item.label.trim(),
          pageNum: pb?.pageNum ?? 1,
          wordIndex: pb?.wordIndex ?? 0,
          depth,
        });
        if (item.subitems?.length) flattenNav(item.subitems, depth + 1);
      }
    };
    flattenNav(nav.toc);
  }

  book.destroy();
  return { text: fullText.trim(), pageBreaks, tocEntries };
}

// ─── URL extraction ──────────────────────────────────────────────────────────

async function fetchViaProxy(url) {
  const proxies = [
    (u) => ({ url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, parse: (r) => r.text() }),
    (u) => ({ url: `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, parse: (r) => r.text() }),
    (u) => ({ url: `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, parse: async (r) => (await r.json()).contents }),
  ];
  let lastError;
  for (const makeProxy of proxies) {
    const { url: proxyUrl, parse } = makeProxy(url);
    try {
      const resp = await fetch(proxyUrl);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const html = await parse(resp);
      if (html && html.length > 100) return html;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(lastError?.message || "All proxies failed. Try a different URL.");
}

async function fetchAndExtractURL(rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const html = await fetchViaProxy(url);

  const { Readability } = await import("@mozilla/readability");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = doc.createElement("base");
  base.href = url;
  doc.head.prepend(base);
  const article = new Readability(doc).parse();
  if (!article || !article.textContent || article.textContent.trim().length < 20) {
    throw new Error("Could not extract article content from this URL.");
  }
  return { title: article.title || url, text: article.textContent.trim() };
}

// ─── Recent Document Card ────────────────────────────────────────────────────

const FILE_TYPE_ICONS = {
  pdf: FileText,
  epub: BookOpen,
  txt: Type,
  paste: FileType,
  url: Globe,
};

function relativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function RecentDocCard({ doc, onOpen, onRemove }) {
  const Icon = FILE_TYPE_ICONS[doc.fileType] || FileText;
  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: THEME.surface,
        border: `1px solid ${THEME.border}`,
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = THEME.accent + "66";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = THEME.border;
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: THEME.accentDim,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={14} style={{ color: THEME.accent }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: THEME.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 400,
          }}
        >
          {doc.title}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
          <span style={{ fontSize: 11, color: THEME.textDim, textTransform: "uppercase" }}>
            {doc.fileType}
          </span>
          <span style={{ fontSize: 11, color: THEME.textDim }}>
            {doc.wordCount?.toLocaleString()} words
          </span>
          <span style={{ fontSize: 11, color: THEME.textDim }}>
            <Clock size={9} style={{ marginRight: 2, verticalAlign: "middle" }} />
            {relativeTime(doc.lastOpenedAt)}
          </span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            marginTop: 5,
            height: 2,
            background: THEME.border,
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${doc.progressPercent || 0}%`,
              background: THEME.accent,
              borderRadius: 1,
            }}
          />
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          background: "none",
          border: "none",
          color: THEME.textDim,
          cursor: "pointer",
          padding: 4,
          opacity: 0.4,
          transition: "opacity 0.15s",
        }}
        onMouseOver={(e) => { e.currentTarget.style.opacity = 1; }}
        onMouseOut={(e) => { e.currentTarget.style.opacity = 0.4; }}
        title="Remove"
      >
        <Trash2 size={12} />
      </button>
    </div>
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
  const [spacingThreshold, setSpacingThreshold] = useState(() => loadSettings().spacingThreshold);
  const [marginPercent, setMarginPercent] = useState(() => loadSettings().marginPercent);
  const [pauseScale, setPauseScale] = useState(() => loadSettings().pauseScale);

  // Filtering
  const [filterCitations, setFilterCitations] = useState(() => loadSettings().filterCitations);
  const [filterReferenceSections, setFilterReferenceSections] = useState(() => loadSettings().filterReferenceSections);
  const [filterCaptions, setFilterCaptions] = useState(() => loadSettings().filterCaptions);
  const [filterPageNumbers, setFilterPageNumbers] = useState(() => loadSettings().filterPageNumbers);

  // UI state
  const [viewMode, setViewMode] = useState("rsvp"); // 'rsvp' | 'text' | 'pdf'
  const [showORP, setShowORP] = useState(() => loadSettings().showORP);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadTab, setUploadTab] = useState("file"); // 'file' | 'paste' | 'url'
  const [pasteText, setPasteText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMarginPreview, setShowMarginPreview] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Persistence
  const [contentHash, setContentHash] = useState(null);
  const [pendingResume, setPendingResume] = useState(null);

  // Named pins (user bookmarks)
  const [pins, setPins] = useState([]);

  // Recent documents
  const [recentDocs, setRecentDocs] = useState(() => loadRecentDocs());

  // Auto-hide controls
  const [controlsVisible, setControlsVisible] = useState(true);
  const inactivityTimerRef = useRef(null);

  const timeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentFileRef = useRef(null);
  const saveTimerRef = useRef(null);
  const currentWordRef = useRef(null);

  // ── Playback engine (recursive setTimeout for smart pauses) ──────────────

  const scheduleNext = useCallback(
    (index) => {
      if (index >= words.length) {
        setIsPlaying(false);
        return;
      }
      const word = words[Math.min(index + chunkSize - 1, words.length - 1)];
      const baseMs = (60000 / wpm) * chunkSize;
      const delay = baseMs * pauseMultiplier(word, pauseScale);

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
    [words, wpm, chunkSize, pauseScale]
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

  const exitToHome = useCallback(() => {
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
    setTutorialActive(false);
    currentFileRef.current = null;
    setRecentDocs(loadRecentDocs());
  }, []);

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
    saveSettings({ wpm, chunkSize, showORP, marginPercent, pauseScale, spacingThreshold, filterCitations, filterReferenceSections, filterCaptions, filterPageNumbers });
  }, [wpm, chunkSize, showORP, marginPercent, pauseScale, spacingThreshold, filterCitations, filterReferenceSections, filterCaptions, filterPageNumbers]);

  // ── Auto-hide controls ──────────────────────────────────────────────────

  const handleActivity = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(inactivityTimerRef.current);
    if (isPlaying && viewMode === "rsvp") {
      inactivityTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [isPlaying, viewMode]);

  useEffect(() => {
    if (!isPlaying || viewMode !== "rsvp") {
      setControlsVisible(true);
      clearTimeout(inactivityTimerRef.current);
    } else {
      // Start hide timer when playback begins
      inactivityTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
    return () => clearTimeout(inactivityTimerRef.current);
  }, [isPlaying, viewMode]);

  // ── Auto-save recent doc progress ─────────────────────────────────────

  useEffect(() => {
    if (!contentHash || words.length === 0 || currentIndex === 0) return;
    const progressPercent = Math.round((currentIndex / words.length) * 100);
    updateRecentDocProgress(contentHash, progressPercent);
  }, [contentHash, currentIndex, words.length]);

  // ── Paragraphs for text view ──────────────────────────────────────────

  const paragraphs = useMemo(() => {
    if (!rawText) return [];
    const filterOpts = {
      inlineCitations: filterCitations,
      parentheticalCitations: filterCitations,
      referenceSections: filterReferenceSections,
      captions: filterCaptions,
      pageNumbers: filterPageNumbers,
    };
    const cleaned = cleanText(rawText, filterOpts);
    const parts = cleaned.split(/\n\n+/);
    const result = [];
    let wordOffset = 0;
    for (const part of parts) {
      const partWords = filterTokens(tokenize(part), { inlineCitations: filterCitations });
      if (partWords.length === 0) continue;
      result.push({
        startIndex: wordOffset,
        endIndex: wordOffset + partWords.length - 1,
        words: partWords,
      });
      wordOffset += partWords.length;
    }
    return result;
  }, [rawText, filterCitations, filterReferenceSections, filterCaptions, filterPageNumbers]);

  // ── Auto-scroll in text view ──────────────────────────────────────────

  useEffect(() => {
    if (viewMode === "text" && currentWordRef.current?.scrollIntoView) {
      currentWordRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, viewMode]);

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

  // ── Text filtering ──────────────────────────────────────────────────────

  const applyFilters = useCallback(
    (text) => {
      const cleaned = cleanText(text, {
        inlineCitations: filterCitations,
        parentheticalCitations: filterCitations,
        referenceSections: filterReferenceSections,
        captions: filterCaptions,
        pageNumbers: filterPageNumbers,
      });
      return filterTokens(tokenize(cleaned), { inlineCitations: filterCitations });
    },
    [filterCitations, filterReferenceSections, filterCaptions, filterPageNumbers]
  );

  // Re-filter when filter toggles change
  useEffect(() => {
    if (rawText) setWords(applyFilters(rawText));
  }, [applyFilters]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const isEPUB = file.name.endsWith(".epub");

      let tokenizedWords = [];
      if (isEPUB) {
        try {
          const result = await extractWithEpub(file);
          if (!result.text || result.text.trim().length < 20) throw new Error("Empty extraction");
          setRawText(result.text);
          tokenizedWords = applyFilters(result.text);
          setWords(tokenizedWords);
          setPageBreaks(result.pageBreaks);
          setTocEntries(result.tocEntries);
        } catch (err) {
          console.error("EPUB extraction failed:", err);
          setUploadError("Could not extract text from this EPUB. Try a different file.");
          return;
        }
      } else if (isPDF) {
        try {
          currentFileRef.current = file;
          const { text, pageBreaks: pb, pdfDoc: doc } = await extractWithPDFJS(
            file,
            spacingThreshold,
            marginPercent
          );
          if (!text || text.trim().length < 20) throw new Error("Empty extraction");
          setRawText(text);
          tokenizedWords = applyFilters(text);
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
          setRawText(text);
          tokenizedWords = applyFilters(text);
          setWords(tokenizedWords);
        } catch {
          setUploadError("Could not read this file. Try a plain text or PDF file.");
          return;
        }
      }

      // Save to recent docs
      const fileType = isEPUB ? "epub" : isPDF ? "pdf" : "txt";
      saveRecentDoc({
        id: hash,
        title: file.name,
        fileType,
        wordCount: tokenizedWords.length,
        progressPercent: 0,
        lastOpenedAt: Date.now(),
        pasteContent: null,
        url: null,
      });
      setRecentDocs(loadRecentDocs());

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
    [spacingThreshold, marginPercent, applyFilters]
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
        setWords(applyFilters(text));
        setPageBreaks(pb);
        setPdfDoc(doc);
        setCurrentIndex(0);
        parseTOC(doc, pb).then(setTocEntries).catch(() => {});
      } catch (err) {
        console.error("Re-extraction failed:", err);
      }
    },
    [applyFilters]
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

    setRawText(pasteText);
    const tokenizedWords = applyFilters(pasteText);
    setWords(tokenizedWords);

    // Save to recent docs (store paste content if < 50KB)
    saveRecentDoc({
      id: hash,
      title: pasteText.slice(0, 60).replace(/\n/g, " ") + (pasteText.length > 60 ? "…" : ""),
      fileType: "paste",
      wordCount: tokenizedWords.length,
      progressPercent: 0,
      lastOpenedAt: Date.now(),
      pasteContent: pasteText.length <= 51200 ? pasteText : null,
      url: null,
    });
    setRecentDocs(loadRecentDocs());

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
  }, [pasteText, applyFilters]);

  // ── Start from URL ─────────────────────────────────────────────────────────

  const startFromURL = useCallback(async () => {
    if (!urlInput.trim()) {
      setUploadError("Enter a URL first.");
      return;
    }
    setUrlLoading(true);
    setUploadError("");
    try {
      const { title, text } = await fetchAndExtractURL(urlInput);
      setIsPlaying(false);
      setCurrentIndex(0);
      setFileName(title);
      setPdfDoc(null);
      setPageBreaks([]);
      setTocEntries([]);
      setViewMode("rsvp");
      setPendingResume(null);
      setPins([]);
      currentFileRef.current = null;

      const hash = "url:" + hashText(urlInput.trim());
      setContentHash(hash);
      setRawText(text);
      const tokenizedWords = applyFilters(text);
      setWords(tokenizedWords);

      saveRecentDoc({
        id: hash,
        title,
        fileType: "url",
        wordCount: tokenizedWords.length,
        progressPercent: 0,
        lastOpenedAt: Date.now(),
        pasteContent: null,
        url: urlInput.trim(),
      });
      setRecentDocs(loadRecentDocs());

      const bookmark = loadBookmark(hash);
      if (bookmark && bookmark.wordIndex > 0 && bookmark.wordIndex < tokenizedWords.length) {
        const drift = Math.abs(bookmark.wordCount - tokenizedWords.length) / bookmark.wordCount;
        setPendingResume({ wordIndex: bookmark.wordIndex, isFresh: drift <= 0.05 });
      }
      setPins(loadPins(hash));
    } catch (err) {
      console.error("URL extraction failed:", err);
      setUploadError(err.message || "Could not extract article from this URL.");
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, applyFilters]);

  // ── Start demo ──────────────────────────────────────────────────────────────

  const startDemo = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setFileName("Demo");
    setPdfDoc(null);
    setPageBreaks([]);
    setViewMode("rsvp");
    setUploadError("");
    setPendingResume(null);
    setPins([]);
    setContentHash(null);

    setRawText(DEMO_TEXT);
    const tokenizedWords = applyFilters(DEMO_TEXT);
    setWords(tokenizedWords);

    // Fake TOC so the TOC button appears
    setTocEntries(DEMO_TOC);
    // Make Margins slider appear
    currentFileRef.current = true;

    setTutorialStep(0);
    setTutorialActive(true);
  }, [applyFilters]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      handleActivity();

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
        case "ArrowUp":
          setWpm((w) => Math.min(1000, w + 25));
          break;
        case "ArrowDown":
          setWpm((w) => Math.max(100, w - 25));
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
        case "s":
          setShowSettings((v) => !v);
          break;
        case "Escape":
          setIsPlaying(false);
          setShowTOC(false);
          setShowKeyboardHints(false);
          setShowSettings(false);
          setShowMarginPreview(false);
          setTutorialActive(false);
          setPendingResume(null);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [words.length, togglePlay, restart, pdfDoc, pendingResume, addPin, handleActivity]);

  // ── Derived values ────────────────────────────────────────────────────────

  const currentChunk = words.slice(currentIndex, currentIndex + chunkSize).join(" ");
  const progress = words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0;
  const timeLeft = words.length > 0
    ? (() => {
        const baseMs = 60000 / wpm;
        let totalMs = 0;
        for (let i = currentIndex; i < words.length; i += chunkSize) {
          const lastWord = words[Math.min(i + chunkSize - 1, words.length - 1)];
          totalMs += baseMs * chunkSize * pauseMultiplier(lastWord, pauseScale);
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

          {/* Try a demo */}
          <button
            onClick={startDemo}
            style={{
              background: "transparent",
              border: `1px solid ${THEME.border}`,
              borderRadius: 8,
              color: THEME.textDim,
              fontFamily: FONTS.body,
              fontSize: 13,
              cursor: "pointer",
              padding: "8px 20px",
              marginBottom: 28,
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = THEME.accent;
              e.currentTarget.style.color = THEME.accent;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = THEME.border;
              e.currentTarget.style.color = THEME.textDim;
            }}
          >
            Try a demo
          </button>

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
            {[
              { key: "file", label: "File" },
              { key: "paste", label: "Paste text" },
              { key: "url", label: "URL" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setUploadTab(key);
                  setUploadError("");
                }}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: "transparent",
                  border: "none",
                  borderBottom: uploadTab === key
                    ? `2px solid ${THEME.accent}`
                    : "2px solid transparent",
                  color: uploadTab === key ? THEME.accent : THEME.textDim,
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  marginBottom: -1,
                }}
              >
                {label}
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
                  borderRadius: 20,
                  padding: "64px 48px",
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
                  Drop a PDF, EPUB, or text file here
                  <br />
                  <span style={{ fontSize: 12, opacity: 0.6 }}>
                    or click to browse
                  </span>
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.html,.epub"
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
                <span>EPUB</span>
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

          {/* URL tab */}
          {uploadTab === "url" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") startFromURL(); }}
                  placeholder="https://example.com/article"
                  style={{
                    flex: 1,
                    background: THEME.surface,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 10,
                    padding: "12px 16px",
                    color: THEME.text,
                    fontFamily: FONTS.body,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>
              <button
                onClick={startFromURL}
                disabled={urlLoading}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  background: urlLoading ? THEME.textDim : THEME.accent,
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontFamily: FONTS.body,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: urlLoading ? "wait" : "pointer",
                  opacity: urlLoading ? 0.7 : 1,
                }}
              >
                {urlLoading ? "Importing…" : "Import Article"}
              </button>
              <div style={{ marginTop: 12, fontSize: 12, color: THEME.textDim, opacity: 0.6 }}>
                Extracts article text using Readability
              </div>
            </div>
          )}

          {/* Recent documents */}
          {recentDocs.length > 0 && (
            <div style={{ marginTop: 32, textAlign: "left" }}>
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
                Recent
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentDocs.slice(0, 5).map((doc) => (
                  <RecentDocCard
                    key={doc.id}
                    doc={doc}
                    onOpen={() => {
                      if (doc.fileType === "paste" && doc.pasteContent) {
                        setPasteText(doc.pasteContent);
                        setUploadTab("paste");
                        // Auto-start after a tick
                        setTimeout(() => {
                          // Directly start reading the paste content
                          setIsPlaying(false);
                          setCurrentIndex(0);
                          setFileName(doc.title);
                          setPdfDoc(null);
                          setPageBreaks([]);
                          setTocEntries([]);
                          setViewMode("rsvp");
                          setUploadError("");
                          setPendingResume(null);
                          setPins([]);
                          const hash = doc.id;
                          setContentHash(hash);
                          setRawText(doc.pasteContent);
                          const tokenizedWords = applyFilters(doc.pasteContent);
                          setWords(tokenizedWords);
                          saveRecentDoc({ ...doc, lastOpenedAt: Date.now() });
                          setRecentDocs(loadRecentDocs());
                          const bookmark = loadBookmark(hash);
                          if (bookmark && bookmark.wordIndex > 0 && bookmark.wordIndex < tokenizedWords.length) {
                            const drift = Math.abs(bookmark.wordCount - tokenizedWords.length) / bookmark.wordCount;
                            setPendingResume({ wordIndex: bookmark.wordIndex, isFresh: drift <= 0.05 });
                          }
                          setPins(loadPins(hash));
                        }, 0);
                      } else if (doc.fileType === "url" && doc.url) {
                        setUrlInput(doc.url);
                        setUploadTab("url");
                        // Auto-import
                        setTimeout(async () => {
                          setUrlLoading(true);
                          try {
                            const { title, text } = await fetchAndExtractURL(doc.url);
                            setIsPlaying(false);
                            setCurrentIndex(0);
                            setFileName(title);
                            setPdfDoc(null);
                            setPageBreaks([]);
                            setTocEntries([]);
                            setViewMode("rsvp");
                            setPendingResume(null);
                            setPins([]);
                            currentFileRef.current = null;
                            const hash = doc.id;
                            setContentHash(hash);
                            setRawText(text);
                            const tokenizedWords = applyFilters(text);
                            setWords(tokenizedWords);
                            saveRecentDoc({ ...doc, lastOpenedAt: Date.now() });
                            setRecentDocs(loadRecentDocs());
                            const bookmark = loadBookmark(hash);
                            if (bookmark && bookmark.wordIndex > 0 && bookmark.wordIndex < tokenizedWords.length) {
                              const drift = Math.abs(bookmark.wordCount - tokenizedWords.length) / bookmark.wordCount;
                              setPendingResume({ wordIndex: bookmark.wordIndex, isFresh: drift <= 0.05 });
                            }
                            setPins(loadPins(hash));
                          } catch (err) {
                            setUploadError(err.message || "Could not re-import URL.");
                          } finally {
                            setUrlLoading(false);
                          }
                        }, 0);
                      } else {
                        // File-type docs: user must re-select
                        setUploadTab("file");
                        fileInputRef.current?.click();
                      }
                    }}
                    onRemove={() => {
                      removeRecentDoc(doc.id);
                      setRecentDocs(loadRecentDocs());
                    }}
                  />
                ))}
              </div>
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
      onMouseMove={handleActivity}
      onTouchStart={handleActivity}
      className={!controlsVisible ? "reader-hide-cursor" : ""}
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
      {showExitConfirm && (
        <>
          <div
            onClick={() => setShowExitConfirm(false)}
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
              padding: "28px 32px",
              zIndex: 50,
              width: 300,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 16,
                color: THEME.text,
                marginBottom: contentHash && !contentHash.startsWith("paste:") ? 8 : 24,
              }}
            >
              Leave reading session?
            </div>
            {contentHash && !contentHash.startsWith("paste:") && (
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  color: THEME.textDim,
                  marginBottom: 24,
                  lineHeight: 1.5,
                }}
              >
                Your progress is saved and will resume next time.
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  background: "transparent",
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 8,
                  color: THEME.textDim,
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "8px 20px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowExitConfirm(false); exitToHome(); }}
                style={{
                  background: THEME.accent,
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "8px 20px",
                  fontWeight: 500,
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </>
      )}
      {showSettings && (
        <SettingsModal
          chunkSize={chunkSize}
          onChunkChange={setChunkSize}
          pauseScale={pauseScale}
          onPauseScaleChange={setPauseScale}
          spacingThreshold={spacingThreshold}
          onSpacingChange={(v) => {
            setSpacingThreshold(v);
            reExtract(v, marginPercent);
          }}
          hasPDF={!!currentFileRef.current}
          onClose={() => setShowSettings(false)}
          filterCitations={filterCitations}
          onFilterCitationsChange={setFilterCitations}
          filterReferenceSections={filterReferenceSections}
          onFilterReferenceSectionsChange={setFilterReferenceSections}
          filterCaptions={filterCaptions}
          onFilterCaptionsChange={setFilterCaptions}
          filterPageNumbers={filterPageNumbers}
          onFilterPageNumbersChange={setFilterPageNumbers}
        />
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
      {tutorialActive && (
        <TutorialOverlay
          step={tutorialStep}
          totalSteps={TUTORIAL_STEPS.length}
          onNext={() => {
            if (tutorialStep < TUTORIAL_STEPS.length - 1) {
              setTutorialStep(tutorialStep + 1);
            } else {
              setTutorialActive(false);
            }
          }}
          onBack={() => setTutorialStep(Math.max(0, tutorialStep - 1))}
          onSkip={() => setTutorialActive(false)}
        />
      )}

      {/* Progress bar */}
      <div data-tutorial="progress-bar" style={{ height: 3, background: THEME.border, flexShrink: 0 }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${THEME.accent}, ${THEME.accent}cc)`,
            boxShadow: `0 0 6px ${THEME.accent}44`,
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
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: controlsVisible ? "auto" : "none",
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
            <span data-tutorial="toc-button">
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
            </span>
          )}
          <span
            onClick={() => setShowExitConfirm(true)}
            style={{ fontFamily: FONTS.display, fontSize: 13, cursor: "pointer" }}
            title="New file"
          >
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
          <span data-tutorial="view-modes" style={{ display: "flex", gap: 6 }}>
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
          </span>
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

          <span data-tutorial="settings-button">
            <IconButton
              onClick={() => setShowSettings(true)}
              title="Settings (S)"
            >
              <Settings size={16} />
            </IconButton>
          </span>
          <span data-tutorial="keyboard-hints">
            <IconButton
              onClick={() => setShowKeyboardHints(true)}
              title="Keyboard shortcuts (?)"
            >
              <Keyboard size={16} />
            </IconButton>
          </span>
          <span data-tutorial="close-button">
            <IconButton
              onClick={() => setShowExitConfirm(true)}
              title="New file"
            >
              <X size={16} />
            </IconButton>
          </span>
        </div>
      </div>

      {/* Main content area — all three views rendered, toggled via opacity */}
      {/* Text view */}
      <div
        style={{
          flex: viewMode === "text" ? 1 : undefined,
          height: viewMode !== "text" ? 0 : undefined,
          overflow: viewMode === "text" ? "hidden" : "hidden",
          display: viewMode === "text" ? "flex" : "none",
        }}
      >
        <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
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
            {paragraphs.map((para, pIdx) => {
              return (
                <p
                  key={pIdx}
                  style={{
                    lineHeight: 2.0,
                    fontSize: 17,
                    color: THEME.textDim,
                    fontWeight: 400,
                    margin: 0,
                    marginBottom: 24,
                  }}
                >
                  {para.words.map((w, wIdx) => {
                    const globalIdx = para.startIndex + wIdx;
                    const pin = pins.find((p) => p.wordIndex === globalIdx);
                    const isCurrent = globalIdx === currentIndex;
                    return (
                      <span
                        key={wIdx}
                        ref={isCurrent ? currentWordRef : null}
                        style={{ position: "relative" }}
                        {...(pin ? { "data-word-index": globalIdx } : {})}
                      >
                        {pin && (
                          <span
                            data-testid={`pin-indicator-${globalIdx}`}
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
                          onClick={() => setCurrentIndex(globalIdx)}
                          onDoubleClick={() => {
                            setCurrentIndex(globalIdx);
                            setViewMode("rsvp");
                          }}
                          style={{
                            cursor: "pointer",
                            background: isCurrent ? THEME.accentDim : "transparent",
                            borderRadius: isCurrent ? 3 : 0,
                            padding: isCurrent ? "1px 3px" : 0,
                            color: isCurrent
                              ? THEME.accent
                              : globalIdx < currentIndex
                              ? THEME.textDim + "66"
                              : THEME.textDim,
                            fontWeight: isCurrent ? 500 : 400,
                            transition: "background 0.15s, color 0.15s",
                          }}
                        >
                          {w}
                        </span>{" "}
                      </span>
                    );
                  })}
                </p>
              );
            })}
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
      </div>

      {/* PDF view */}
      {viewMode === "pdf" && pdfDoc && (
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
      )}

      {/* RSVP view */}
      {viewMode === "rsvp" && (
        <div
          data-tutorial="word-display"
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

      {/* Controls bar — hidden in text view */}
      <div
        style={{
          borderTop: `1px solid ${THEME.border}`,
          padding: "14px 16px",
          flexShrink: 0,
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: controlsVisible ? "auto" : "none",
          display: viewMode === "text" ? "none" : undefined,
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
            <span data-tutorial="pin-button">
              <IconButton
                onClick={addPin}
                title="Add pin (M)"
                active={pins.some((p) => p.wordIndex === currentIndex)}
              >
                <Bookmark size={16} />
              </IconButton>
            </span>
            <span data-tutorial="back-forward">
              <IconButton
                onClick={() =>
                  setCurrentIndex((i) => Math.max(0, i - 10))
                }
                title="Back 10 words (←)"
              >
                <ChevronLeft size={16} />
              </IconButton>
            </span>

            <span data-tutorial="play-button">
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
            </span>

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
            <span data-tutorial="orp-toggle">
              <IconButton
                onClick={() => setShowORP((v) => !v)}
                active={showORP}
                title="Toggle ORP highlight (O)"
              >
                <Eye size={16} />
              </IconButton>
            </span>
          </div>

          {/* Scrubber */}
          <div data-tutorial="scrubber">
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
          </div>

          {/* Settings sliders */}
          <div
            style={{
              display: "flex",
              gap: 20,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <div data-tutorial="wpm-slider">
              <Slider
                label="Speed"
                value={wpm}
                onChange={setWpm}
                min={100}
                max={1000}
                step={25}
                displayValue={`${wpm} wpm`}
              />
            </div>
            {currentFileRef.current && (
              <div data-tutorial="margins-slider">
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global styles */}
      <style>{`
        .reader-hide-cursor { cursor: none !important; }
        .reader-hide-cursor * { cursor: none !important; }
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
