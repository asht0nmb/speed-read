import { useState, useEffect, useRef, useCallback } from "react";

const FONTS = {
  display: "'JetBrains Mono', monospace",
  body: "'IBM Plex Sans', sans-serif",
};

const THEME = {
  bg: "#303030",
  surface: "#141414",
  surfaceHover: "#1a1a1a",
  border: "#222",
  text: "#e8e8e8",
  textDim: "#666",
  accent: "#ff6b35",
  accentDim: "rgba(255, 107, 53, 0.15)",
  focusLetter: "#ff6b35",
};

function extractTextFromPDF(arrayBuffer) {
  return new Promise((resolve) => {
    const bytes = new Uint8Array(arrayBuffer);
    let text = "";

    const content = new TextDecoder("latin1").decode(bytes);

    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    let match;

    while ((match = streamRegex.exec(content)) !== null) {
      const streamContent = match[1];
      const textOps =
        streamContent.match(/\(([^)]*)\)\s*Tj|\[(.*?)\]\s*TJ/g) || [];

      for (const op of textOps) {
        const parenMatches = op.match(/\(([^)]*)\)/g);
        if (parenMatches) {
          for (const p of parenMatches) {
            text += p.slice(1, -1);
          }
        }
        text += " ";
      }
    }

    text = text
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 50) {
      const fallback = content
        .replace(/[^\x20-\x7E\n]/g, " ")
        .replace(/\s+/g, " ")
        .match(/[A-Za-z]{2,}/g);
      if (fallback) {
        text = fallback.join(" ");
      }
    }

    resolve(text);
  });
}

async function extractWithPDFJS(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) return null;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    fullText += pageText + " ";
  }

  return fullText.trim();
}

function tokenize(text) {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

function findORP(word) {
  const len = word.replace(/[^a-zA-Z0-9]/g, "").length;
  if (len <= 1) return 0;
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

function WordDisplay({ word }) {
  if (!word) return null;
  const orpIndex = findORP(word);

  const before = word.slice(0, orpIndex);
  const focus = word[orpIndex] || "";
  const after = word.slice(orpIndex + 1);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", minHeight: 80 }}>
      <div
        style={{
          position: "absolute",
          top: -8,
          bottom: -8,
          left: "50%",
          width: 2,
          background: `linear-gradient(to bottom, transparent, ${THEME.accent}44, transparent)`,
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", fontFamily: FONTS.display, fontSize: "clamp(2rem, 6vw, 4.5rem)", fontWeight: 400, letterSpacing: "0.02em" }}>
        <span style={{ color: THEME.text, textAlign: "right", minWidth: "3ch", display: "inline-block", direction: "rtl", unicodeBidi: "bidi-override" }}>
          {before.split("").reverse().join("")}
        </span>
        <span style={{ color: THEME.focusLetter, fontWeight: 700, textShadow: `0 0 30px ${THEME.accent}66` }}>
          {focus}
        </span>
        <span style={{ color: THEME.text, textAlign: "left", minWidth: "6ch", display: "inline-block" }}>
          {after}
        </span>
      </div>
    </div>
  );
}

function Slider({ value, onChange, min, max, step, label, displayValue }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONTS.body, fontSize: 11, color: THEME.textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        <span>{label}</span>
        <span style={{ color: THEME.accent, fontFamily: FONTS.display }}>{displayValue}</span>
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
          background: `linear-gradient(to right, ${THEME.accent} ${((value - min) / (max - min)) * 100}%, ${THEME.border} ${((value - min) / (max - min)) * 100}%)`,
          borderRadius: 2,
          outline: "none",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

function IconButton({ onClick, children, active, size = 36, title }) {
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
        border: `1px solid ${active ? THEME.accent + "44" : THEME.border}`,
        borderRadius: 8,
        color: active ? THEME.accent : THEME.textDim,
        cursor: "pointer",
        transition: "all 0.2s",
        fontSize: 16,
      }}
    >
      {children}
    </button>
  );
}

export default function SpeedReader() {
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [chunkSize, setChunkSize] = useState(1);
  const [showText, setShowText] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [rawText, setRawText] = useState("");

  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);
  const textViewRef = useRef(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      setPdfjsLoaded(true);
    };
    document.head.appendChild(script);

    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=IBM+Plex+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const processFile = useCallback(
    async (file) => {
      setIsPlaying(false);
      setCurrentIndex(0);
      setFileName(file.name);

      let text = "";

      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        if (pdfjsLoaded) {
          try {
            text = await extractWithPDFJS(file);
          } catch (e) {
            console.warn("PDF.js failed, trying fallback:", e);
          }
        }
        if (!text || text.length < 50) {
          const buf = await file.arrayBuffer();
          text = await extractTextFromPDF(buf);
        }
      } else {
        text = await file.text();
      }

      if (!text || text.trim().length === 0) {
        alert("Could not extract text from this file. Try a different PDF or a plain text file.");
        return;
      }

      setRawText(text);
      setWords(tokenize(text));
    },
    [pdfjsLoaded]
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

  useEffect(() => {
    if (isPlaying && words.length > 0) {
      const msPerWord = 60000 / wpm;
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + chunkSize;
          if (next >= words.length) {
            setIsPlaying(false);
            return words.length - 1;
          }
          return next;
        });
      }, msPerWord);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, wpm, chunkSize, words.length]);

  const togglePlay = () => {
    if (currentIndex >= words.length - 1) setCurrentIndex(0);
    setIsPlaying(!isPlaying);
  };

  const restart = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const currentChunk = words.slice(currentIndex, currentIndex + chunkSize).join(" ");
  const progress = words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0;
  const timeLeft = words.length > 0 ? Math.ceil((words.length - currentIndex) / wpm) : 0;

  // Upload screen
  if (words.length === 0) {
    return (
      <div
        style={{
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
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <h1
            style={{
              fontFamily: FONTS.display,
              fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
              fontWeight: 400,
              marginBottom: 8,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: THEME.accent }}>swift</span>read
          </h1>
          <p style={{ color: THEME.textDim, fontSize: 14, marginBottom: 48, fontWeight: 300 }}>
            open-source speed reader
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? THEME.accent : THEME.border}`,
              borderRadius: 16,
              padding: "60px 40px",
              cursor: "pointer",
              transition: "all 0.3s",
              background: isDragging ? THEME.accentDim : "transparent",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.6 }}>↑</div>
            <p style={{ color: THEME.textDim, fontSize: 15, lineHeight: 1.6 }}>
              Drop a PDF or text file here
              <br />
              <span style={{ fontSize: 12, opacity: 0.6 }}>or click to browse</span>
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.html,.epub"
            onChange={handleFile}
            style={{ display: "none" }}
          />

          <div style={{ marginTop: 48, display: "flex", gap: 24, justifyContent: "center", color: THEME.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em" }}>
            <span>PDF</span>
            <span>TXT</span>
            <span>MD</span>
          </div>
        </div>
      </div>
    );
  }

  // Reader screen
  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, fontFamily: FONTS.body, color: THEME.text, display: "flex", flexDirection: "column" }}>
      {/* Progress bar */}
      <div style={{ height: 2, background: THEME.border }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${THEME.accent}, ${THEME.accent}cc)`,
            transition: isPlaying ? "width 0.1s linear" : "width 0.3s ease",
          }}
        />
      </div>

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: FONTS.display, fontSize: 14 }}>
            <span style={{ color: THEME.accent }}>swift</span>read
          </span>
          <span style={{ color: THEME.textDim, fontSize: 12 }}>·</span>
          <span style={{ color: THEME.textDim, fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <IconButton onClick={() => setShowText(!showText)} active={showText} title="Full text">
            ¶
          </IconButton>
          <IconButton
            onClick={() => {
              setWords([]);
              setRawText("");
              setFileName("");
              setCurrentIndex(0);
              setIsPlaying(false);
            }}
            title="New file"
          >
            ✕
          </IconButton>
        </div>
      </div>

      {/* Main content */}
      {showText ? (
        <div
          ref={textViewRef}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "40px 20px",
            maxWidth: 680,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <p style={{ lineHeight: 1.8, fontSize: 15, color: THEME.textDim, fontWeight: 300, whiteSpace: "pre-wrap" }}>
            {words.map((w, i) => (
              <span
                key={i}
                onClick={() => {
                  setCurrentIndex(i);
                  setShowText(false);
                }}
                style={{
                  cursor: "pointer",
                  color: i === currentIndex ? THEME.accent : i < currentIndex ? THEME.textDim + "88" : THEME.textDim,
                  fontWeight: i === currentIndex ? 500 : 300,
                  transition: "color 0.15s",
                  borderBottom: i === currentIndex ? `1px solid ${THEME.accent}` : "none",
                }}
              >
                {w}{" "}
              </span>
            ))}
          </p>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            userSelect: "none",
          }}
          onClick={togglePlay}
        >
          <WordDisplay word={currentChunk} />
          <div style={{ marginTop: 32, color: THEME.textDim, fontSize: 12, fontFamily: FONTS.display }}>
            {currentIndex + 1} / {words.length}
            <span style={{ margin: "0 12px", opacity: 0.3 }}>·</span>
            {timeLeft} min left
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ borderTop: `1px solid ${THEME.border}`, padding: "16px 20px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Playback controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <IconButton onClick={restart} title="Restart">⟲</IconButton>
            <IconButton
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 10))}
              title="Back 10 words"
            >
              ⟵
            </IconButton>

            <button
              onClick={togglePlay}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: THEME.accent,
                border: "none",
                color: THEME.bg,
                fontSize: 20,
                cursor: "pointer",
                boxShadow: `0 0 24px ${THEME.accent}44`,
                transition: "transform 0.15s",
              }}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>

            <IconButton
              onClick={() => setCurrentIndex(Math.min(words.length - 1, currentIndex + 10))}
              title="Forward 10 words"
            >
              ⟶
            </IconButton>
            <IconButton onClick={() => setShowText(!showText)} active={showText} title="Full text">
              ☰
            </IconButton>
          </div>

          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={words.length - 1}
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

          {/* Settings */}
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
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
              displayValue={`${chunkSize} word${chunkSize > 1 ? "s" : ""}`}
            />
          </div>
        </div>
      </div>

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
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${THEME.border}; border-radius: 3px; }
      `}</style>
    </div>
  );
}
