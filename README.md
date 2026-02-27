# **speed**read

Open-source speed reader using RSVP (Rapid Serial Visual Presentation). Let's you read pdf files (think books, research papers, etc) really quickly. Saves a lot of time, and is free now!

Check it out [here](https://speed-read-eight.vercel.app/)

---

## What is RSVP?

Rapid Serial Visual Presentation (RSVP) is a technique where text is displayed one word at a time at a fixed focal point. This eliminates the need for eye movements (saccades) during reading, potentially allowing for significantly faster reading speeds.

The app uses Optimal Recognition Point (ORP) highlighting - the red letter in each word indicates the point where your eye naturally focuses for fastest word recognition. This is calculated based on word length:

- 1-3 letter words: 1st letter
- 4-5 letter words: 2nd letter
- 6-9 letter words: 3rd letter
- 10+ letter words: 4th letter

---

## Features

- **RSVP display** — words shown one at a time with the ORP (Optimal Recognition Point) letter pinned to the exact center of the viewport
- **Smart pauses** — sentence endings hold 2.8×, clause punctuation 1.6× to reduce cognitive load
- **PDF support** — position-aware text extraction via PDF.js; spacing threshold slider to fix merged or split words in tricky PDFs
- **Table of Contents** — parsed from native PDF bookmarks or heuristic heading detection; click any entry to jump directly to that position
- **PDF visual view** — renders actual PDF pages to canvas; click a page to seek the reader to that position
- **Three view modes** — RSVP · Text · PDF
- **Paste tab** — paste text directly without a file
- **Bookmarks** - add bookmarks as you read
- **Persistence** - reading position saved across sessions for every distinct file
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

MIT - Use it, modify it, share it
