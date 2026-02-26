# **speed**read

Open-source speed reader using RSVP (Rapid Serial Visual Presentation).

---

## Features

- **RSVP display** — words shown one at a time with the ORP (Optimal Recognition Point) letter pinned to the exact center of the viewport
- **Smart pauses** — sentence endings hold 2.8×, clause punctuation 1.6× to reduce cognitive load
- **PDF support** — position-aware text extraction via PDF.js; spacing threshold slider to fix merged or split words in tricky PDFs
- **Table of Contents** — parsed from native PDF bookmarks or heuristic heading detection; click any entry to jump directly to that position
- **PDF visual view** — renders actual PDF pages to canvas; click a page to seek the reader to that position
- **Three view modes** — RSVP · Text · PDF
- **Paste tab** — paste text directly without a file
- **Drag-and-drop or browse** — accepts PDF, TXT, MD, and HTML files

---

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # production build
npm run preview  # preview production build
```

---

## Usage

Drop or pick a file (or switch to the Paste tab), adjust WPM (100–1000) and chunk size (1–5 words), then press **Play** or **Space** to start. If words appear merged or split in a PDF, use the **Spacing** slider to tune the word-boundary detection threshold.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` `→` | Jump ±10 words |
| `[` `]` | Speed ±25 WPM |
| `R` | Restart |
| `T` | Toggle text view |
| `P` | Toggle PDF view |
| `O` | Toggle ORP highlight |
| `?` | Show keyboard shortcuts |
| `Esc` | Pause / close panels |

---

## Tech stack

- React 18, Vite 5, PDF.js 3.11.174
- Vitest + @testing-library/react

---

## Development

```bash
npm test          # watch mode
npm run test:run  # single run (CI)
```

---

## License

MIT
