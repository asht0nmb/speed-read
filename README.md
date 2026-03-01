# **speed**read

Open-source speed reader using RSVP (Rapid Serial Visual Presentation). Upload a PDF, EPUB, or text file — paste text — or import any article from a URL. Words are displayed one at a time with the ORP (Optimal Recognition Point) letter pinned to the exact center of the screen so your eyes never move.

**[Try it live](https://speed-read-eight.vercel.app/)**

---

## What is RSVP?

Traditional reading is slow in part because your eyes constantly jump between words — these movements are called **saccades**, and they account for a surprising amount of your reading time. RSVP eliminates saccades entirely by presenting text one word at a time at a single fixed point on screen. Your eyes stay still; the words come to you.

Most people read at 200–250 WPM on paper. With RSVP, 400-600 WPM is comfortable after a short adjustment period, and the ceiling is much higher.

## How ORP works

Research in cognitive psychology shows that your eye naturally fixates slightly left of center, called the **Optimal Recognition Point**. Speedread highlights this letter and aligns it to the exact center of the viewport, so every word lands in the position your brain processes fastest.

The ORP position depends on word length:

| Word length | ORP position |
|-------------|-------------|
| 1–3 letters | 1st letter |
| 4–5 letters | 2nd letter |
| 6–9 letters | 3rd letter |
| 10+ letters | 4th letter |

Combined with a monospace font (where every character is the same width), this keeps the focal letter perfectly centered regardless of word length.

---

## Features

### Input methods
- **File upload** — drag-and-drop or browse for PDF, EPUB, TXT, MD, and HTML files
- **Paste text** — paste directly without a file
- **Import from URL** — fetches any web article and extracts clean text via [Readability](https://github.com/mozilla/readability)

### RSVP display
- **ORP centering** — the optimal recognition point of each word is pinned to viewport center using a monospace font
- **Smart pauses** — sentence endings hold 2.8×, clause punctuation 1.6× to reduce cognitive load
- **Upcoming-words preview** — see the next few words below the current one while paused
- **Minutes remaining** — live estimate based on current WPM
- **Page tracking** — current page number displayed for PDFs

### View modes
- **RSVP** — default one-word-at-a-time display
- **Text** — scrollable word list with click-to-seek and a pins sidebar
- **PDF** — renders actual PDF pages to canvas with click-to-seek

### Navigation
- **Table of Contents** — parsed from native PDF bookmarks, EPUB navigation, or heuristic heading detection; click any entry to jump
- **Pins** — named bookmarks you place as you read (`M` key); jump back to any pin with `B`
- **Scrubber** — drag to seek through the document

### Persistence
- **Auto-saved position** — reading position saved per document so you pick up where you left off
- **Resume banner** — on reload, offers to jump back to your last position
- **Recent documents** — stores up to 20 documents with progress bars for quick re-opening
- **Settings remembered** — WPM, chunk size, theme, and other preferences persist across sessions

### Filtering
- **Citation removal** — strips inline citations like `[1]`, `(Smith, 2020)`, etc.
- **References section removal** — removes References / Bibliography sections
- **Caption removal** — removes `Figure 1:`, `Table 2:`, etc.
- **Page number removal** — removes standalone page numbers

### Customization
- **WPM** — 100 to 1000
- **Chunk size** — 1, 3, or 5 words at a time
- **Pause scale** — adjust how long punctuation pauses last
- **Spacing threshold** — tune PDF word-boundary detection for tricky layouts
- **Margin cropping** — adjustable margins with a visual canvas preview

### Other
- **14-step interactive tutorial** — SVG spotlight overlay walks new users through every feature
- **Auto-hiding controls** — UI fades out during reading, reappears on mouse movement
- **Exit confirmation** — prevents accidental navigation away from an active session

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

The upload screen has three tabs — **File**, **Paste**, and **URL**. Pick your input method, adjust WPM and chunk size, then press **Play** or **Space** to start reading. If words appear merged or split in a PDF, open **Settings** (`S`) and tune the **Spacing** slider. First-time users can click the tutorial icon to get a guided walkthrough.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` `→` | Jump ±10 words |
| `↑` `↓` | Speed ±25 WPM |
| `M` | Add pin at current position |
| `B` | Jump to bookmark / pin |
| `S` | Open settings |
| `R` | Restart |
| `T` | Toggle text view |
| `P` | Toggle PDF view |
| `O` | Toggle ORP highlight |
| `?` | Show keyboard shortcuts |
| `Esc` | Pause / close panels |

---

## Tech stack

- React 18, Vite 7, PDF.js 5, [epub.js](https://github.com/futurepress/epub.js), [@mozilla/readability](https://github.com/mozilla/readability), [Lucide icons](https://lucide.dev)
- Vitest + @testing-library/react

---

## Development

```bash
npm test          # watch mode
npm run test:run  # single run (CI)
```

---

## License

MIT — Use it, modify it, share it
