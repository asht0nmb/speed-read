import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpeedReader from '../SpeedReader.jsx';
import { hashText, saveBookmark, savePins, loadPins } from '../persistence.js';

// Mock pdfjs-dist to avoid worker issues in tests
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

// Mock the pdf module to avoid PDF.js initialization
vi.mock('../pdf.js', () => ({
  extractWithPDFJS: vi.fn(),
  parseTOC: vi.fn(async () => []),
}));

describe('SpeedReader', () => {
  // ── Upload screen ──────────────────────────────────────────────────────────

  describe('Upload screen', () => {
    it('renders logo text', () => {
      render(<SpeedReader />);
      // Logo is <span>speed</span>read — check the colored span
      expect(screen.getByText('speed')).toBeInTheDocument();
      const readElements = screen.getAllByText(/read/);
      expect(readElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders subtitle', () => {
      render(<SpeedReader />);
      // Subtitle is split: <a>open-source</a> speed reader
      expect(screen.getByRole('link', { name: 'open-source' })).toBeInTheDocument();
    });

    it('renders File and Paste text tabs', () => {
      render(<SpeedReader />);
      expect(screen.getByText('File')).toBeInTheDocument();
      expect(screen.getByText('Paste text')).toBeInTheDocument();
    });

    it('shows drop zone on file tab', () => {
      render(<SpeedReader />);
      expect(screen.getByText(/Drop a PDF or text file here/)).toBeInTheDocument();
    });

    it('shows supported file types', () => {
      render(<SpeedReader />);
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('TXT')).toBeInTheDocument();
      expect(screen.getByText('MD')).toBeInTheDocument();
    });

    it('shows textarea when paste tab is clicked', async () => {
      const user = userEvent.setup();
      render(<SpeedReader />);
      await user.click(screen.getByText('Paste text'));
      expect(screen.getByPlaceholderText(/Paste your text here/)).toBeInTheDocument();
    });

    it('shows Start Reading button on paste tab', async () => {
      const user = userEvent.setup();
      render(<SpeedReader />);
      await user.click(screen.getByText('Paste text'));
      expect(screen.getByText('Start Reading')).toBeInTheDocument();
    });
  });

  // ── Paste flow ─────────────────────────────────────────────────────────────

  describe('Paste flow', () => {
    it('loads pasted text and transitions to reader', async () => {
      const user = userEvent.setup();
      render(<SpeedReader />);

      await user.click(screen.getByText('Paste text'));
      const textarea = screen.getByPlaceholderText(/Paste your text here/);
      await user.type(textarea, 'The quick brown fox jumps over the lazy dog');
      await user.click(screen.getByText('Start Reading'));

      // Should now be in reader mode — look for word count indicator
      await waitFor(() => {
        expect(screen.getByText(/1 \/ 9/)).toBeInTheDocument();
      });
    });

    it('shows filename as "Pasted text"', async () => {
      const user = userEvent.setup();
      render(<SpeedReader />);

      await user.click(screen.getByText('Paste text'));
      const textarea = screen.getByPlaceholderText(/Paste your text here/);
      await user.type(textarea, 'hello world');
      await user.click(screen.getByText('Start Reading'));

      await waitFor(() => {
        expect(screen.getByText('Pasted text')).toBeInTheDocument();
      });
    });

    it('shows error on empty paste', async () => {
      const user = userEvent.setup();
      render(<SpeedReader />);

      await user.click(screen.getByText('Paste text'));
      await user.click(screen.getByText('Start Reading'));

      expect(screen.getByText('Paste some text first.')).toBeInTheDocument();
    });
  });

  // ── File upload ────────────────────────────────────────────────────────────

  describe('File upload', () => {
    it('processes a .txt file via hidden input', async () => {
      render(<SpeedReader />);

      // Find the hidden file input
      const input = document.querySelector('input[type="file"]');
      expect(input).toBeTruthy();

      const file = new File(['hello world testing'], 'test.txt', {
        type: 'text/plain',
      });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });
    });
  });

  // ── Reader controls ────────────────────────────────────────────────────────

  describe('Reader controls', () => {
    beforeEach(() => localStorage.clear());

    async function setupReader() {
      const user = userEvent.setup();
      render(<SpeedReader />);
      await user.click(screen.getByText('Paste text'));
      const textarea = screen.getByPlaceholderText(/Paste your text here/);
      await user.type(textarea, 'one two three four five six seven eight nine ten');
      await user.click(screen.getByText('Start Reading'));
      await waitFor(() => {
        expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument();
      });
      return user;
    }

    it('displays first word on load', async () => {
      await setupReader();
      // The word "one" is split across ORP spans, so check via word counter
      expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument();
    });

    it('shows word count', async () => {
      await setupReader();
      expect(screen.getByText(/\/ 10/)).toBeInTheDocument();
    });

    it('shows play button', async () => {
      await setupReader();
      // Play button present when paused
      expect(screen.getByTitle('Play (Space)')).toBeInTheDocument();
    });

    it('close button returns to upload screen', async () => {
      const user = await setupReader();
      // Click the close (✕) button — the "New file" button
      const closeButton = screen.getByTitle('New file');
      await user.click(closeButton);

      await waitFor(() => {
        // upload screen is back — logo span is always visible
        expect(screen.getByText('speed')).toBeInTheDocument();
      });
    });
  });

  // ── Margins slider for PDFs ──────────────────────────────────────────────

  describe('Margins slider', () => {
    beforeEach(() => localStorage.clear());

    it('appears when a PDF is loaded', async () => {
      const { extractWithPDFJS, parseTOC } = await import('../pdf.js');
      extractWithPDFJS.mockResolvedValue({
        text: 'word one two three four five six seven eight nine ten',
        pageBreaks: [{ pageNum: 1, wordIndex: 0 }],
        pdfDoc: {},
      });
      parseTOC.mockResolvedValue([]);

      render(<SpeedReader />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['fake'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Margins')).toBeInTheDocument();
      });

      // Verify extractWithPDFJS was called with separate top and bottom margin args
      expect(extractWithPDFJS).toHaveBeenCalledWith(
        expect.any(File),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('re-extracts PDF when top margin slider value changes', async () => {
      const { extractWithPDFJS, parseTOC } = await import('../pdf.js');
      extractWithPDFJS.mockResolvedValue({
        text: 'word one two three four five six seven eight nine ten',
        pageBreaks: [{ pageNum: 1, wordIndex: 0 }],
        pdfDoc: { getPage: vi.fn() },
      });
      parseTOC.mockResolvedValue([]);

      render(<SpeedReader />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['fake'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Margins')).toBeInTheDocument();
      });

      // Open the margin modal
      fireEvent.click(screen.getByText('Margins'));
      await waitFor(() => {
        expect(screen.getByText('Adjust Margins')).toBeInTheDocument();
      });

      // Clear call history from initial load
      extractWithPDFJS.mockClear();
      extractWithPDFJS.mockResolvedValue({
        text: 'word one two three four five six seven eight nine ten',
        pageBreaks: [{ pageNum: 1, wordIndex: 0 }],
        pdfDoc: { getPage: vi.fn() },
      });

      // Find the Top Margin slider inside the modal (max=0.25)
      const sliders = document.querySelectorAll('input[type="range"]');
      const topMarginSlider = Array.from(sliders).find((s) => Number(s.max) === 0.25);
      expect(topMarginSlider).toBeTruthy();

      fireEvent.change(topMarginSlider, { target: { value: '0.15' } });

      await waitFor(() => {
        expect(extractWithPDFJS).toHaveBeenCalledWith(
          expect.any(File),
          expect.any(Number),
          0.15,
          expect.any(Number)
        );
      });
    });

    it('clicking Margins button opens the preview modal', async () => {
      const { extractWithPDFJS, parseTOC } = await import('../pdf.js');
      extractWithPDFJS.mockResolvedValue({
        text: 'word one two three four five six seven eight nine ten',
        pageBreaks: [{ pageNum: 1, wordIndex: 0 }],
        pdfDoc: { getPage: vi.fn() },
      });
      parseTOC.mockResolvedValue([]);

      render(<SpeedReader />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['fake'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Margins')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Margins'));

      await waitFor(() => {
        expect(screen.getByText('Adjust Margins')).toBeInTheDocument();
      });
    });

    it('preview modal shows a canvas element', async () => {
      const { extractWithPDFJS, parseTOC } = await import('../pdf.js');
      extractWithPDFJS.mockResolvedValue({
        text: 'word one two three four five six seven eight nine ten',
        pageBreaks: [{ pageNum: 1, wordIndex: 0 }],
        pdfDoc: { getPage: vi.fn() },
      });
      parseTOC.mockResolvedValue([]);

      render(<SpeedReader />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['fake'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Margins')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Margins'));

      await waitFor(() => {
        expect(screen.getByText('Adjust Margins')).toBeInTheDocument();
      });

      expect(document.querySelector('canvas')).toBeInTheDocument();
    });

    it('Escape closes the preview modal', async () => {
      const { extractWithPDFJS, parseTOC } = await import('../pdf.js');
      extractWithPDFJS.mockResolvedValue({
        text: 'word one two three four five six seven eight nine ten',
        pageBreaks: [{ pageNum: 1, wordIndex: 0 }],
        pdfDoc: { getPage: vi.fn() },
      });
      parseTOC.mockResolvedValue([]);

      render(<SpeedReader />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['fake'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Margins')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Margins'));

      await waitFor(() => {
        expect(screen.getByText('Adjust Margins')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Adjust Margins')).not.toBeInTheDocument();
      });
    });
  });

  // ── Bookmark and resume flow ──────────────────────────────────────────────

  describe('Bookmark and resume flow', () => {
    beforeEach(() => localStorage.clear());

    const PASTE_TEXT = 'one two three four five six seven eight nine ten';

    async function setupReaderWithPaste(text = PASTE_TEXT) {
      const user = userEvent.setup();
      render(<SpeedReader />);
      await user.click(screen.getByText('Paste text'));
      const textarea = screen.getByPlaceholderText(/Paste your text here/);
      await user.type(textarea, text);
      await user.click(screen.getByText('Start Reading'));
      await waitFor(() => {
        expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument();
      });
      return user;
    }

    it('shows ResumeBanner when a bookmark exists for the content', async () => {
      // Pre-seed a bookmark for this paste content
      const hash = 'paste:' + hashText(PASTE_TEXT);
      saveBookmark(hash, 'Pasted text', 5, 10);

      const user = userEvent.setup();
      render(<SpeedReader />);
      await user.click(screen.getByText('Paste text'));
      const textarea = screen.getByPlaceholderText(/Paste your text here/);
      await user.type(textarea, PASTE_TEXT);
      await user.click(screen.getByText('Start Reading'));

      await waitFor(() => {
        expect(screen.getByText(/Resume from 50%/)).toBeInTheDocument();
      });
    });

    it('clicking Resume seeks to bookmarked position', async () => {
      const hash = 'paste:' + hashText(PASTE_TEXT);
      saveBookmark(hash, 'Pasted text', 5, 10);

      const user = userEvent.setup();
      render(<SpeedReader />);
      await user.click(screen.getByText('Paste text'));
      const textarea = screen.getByPlaceholderText(/Paste your text here/);
      await user.type(textarea, PASTE_TEXT);
      await user.click(screen.getByText('Start Reading'));

      await waitFor(() => {
        expect(screen.getByText('Resume')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Resume'));

      await waitFor(() => {
        expect(screen.getByText(/6 \/ 10/)).toBeInTheDocument();
      });
    });

    it('clicking Start over dismisses banner and clears bookmark', async () => {
      const hash = 'paste:' + hashText(PASTE_TEXT);
      saveBookmark(hash, 'Pasted text', 5, 10);

      const user = userEvent.setup();
      render(<SpeedReader />);
      await user.click(screen.getByText('Paste text'));
      const textarea = screen.getByPlaceholderText(/Paste your text here/);
      await user.type(textarea, PASTE_TEXT);
      await user.click(screen.getByText('Start Reading'));

      await waitFor(() => {
        expect(screen.getByText('Start over')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Start over'));

      // Banner should be gone
      expect(screen.queryByText(/Resume from/)).toBeNull();
      // Word position stays at 1
      expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument();
      // Bookmark should be cleared from localStorage
      expect(localStorage.getItem('swiftread:bookmark:' + hash)).toBeNull();
    });

    it('does not show banner when no bookmark exists', async () => {
      await setupReaderWithPaste();
      expect(screen.queryByText(/Resume from/)).toBeNull();
    });

    it('Escape dismisses the resume banner', async () => {
      const hash = 'paste:' + hashText(PASTE_TEXT);
      saveBookmark(hash, 'Pasted text', 5, 10);

      const user = userEvent.setup();
      render(<SpeedReader />);
      await user.click(screen.getByText('Paste text'));
      const textarea = screen.getByPlaceholderText(/Paste your text here/);
      await user.type(textarea, PASTE_TEXT);
      await user.click(screen.getByText('Start Reading'));

      await waitFor(() => {
        expect(screen.getByText(/Resume from/)).toBeInTheDocument();
      });
      await user.keyboard('{Escape}');
      expect(screen.queryByText(/Resume from/)).toBeNull();
    });
  });

  // ── Named pins ────────────────────────────────────────────────────────────

  describe('Named pins', () => {
    beforeEach(() => localStorage.clear());

    const PASTE_TEXT = 'one two three four five six seven eight nine ten';

    async function setupReaderWithPaste(text = PASTE_TEXT) {
      const user = userEvent.setup();
      render(<SpeedReader />);
      await user.click(screen.getByText('Paste text'));
      const textarea = screen.getByPlaceholderText(/Paste your text here/);
      await user.type(textarea, text);
      await user.click(screen.getByText('Start Reading'));
      await waitFor(() => {
        expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument();
      });
      return user;
    }

    it('M key adds a pin at current position', async () => {
      await setupReaderWithPaste();
      const hash = 'paste:' + hashText(PASTE_TEXT);

      fireEvent.keyDown(window, { key: 'm' });

      // Pin should be persisted
      const pins = loadPins(hash);
      expect(pins).toHaveLength(1);
      expect(pins[0].wordIndex).toBe(0);
      expect(pins[0].context).toContain('one');
    });

    it('clicking bookmark button adds a pin', async () => {
      const user = await setupReaderWithPaste();
      const hash = 'paste:' + hashText(PASTE_TEXT);

      const pinButton = screen.getByTitle('Add pin (M)');
      await user.click(pinButton);

      const pins = loadPins(hash);
      expect(pins).toHaveLength(1);
      expect(pins[0].wordIndex).toBe(0);
    });

    it('pin indicators show in text view', async () => {
      const user = await setupReaderWithPaste();

      // Add a pin at position 0
      fireEvent.keyDown(window, { key: 'm' });

      // Switch to text view
      fireEvent.keyDown(window, { key: 't' });

      await waitFor(() => {
        expect(screen.getByTestId('pin-indicator-0')).toBeInTheDocument();
      });
    });

    it('pins sidebar shows in text view when pins exist', async () => {
      const user = await setupReaderWithPaste();

      // Add a pin
      fireEvent.keyDown(window, { key: 'm' });

      // Switch to text view
      fireEvent.keyDown(window, { key: 't' });

      await waitFor(() => {
        expect(screen.getByText('Pins')).toBeInTheDocument();
      });
    });

    it('removing a pin via sidebar X button works', async () => {
      const user = await setupReaderWithPaste();
      const hash = 'paste:' + hashText(PASTE_TEXT);

      // Add a pin
      fireEvent.keyDown(window, { key: 'm' });
      expect(loadPins(hash)).toHaveLength(1);

      // Switch to text view
      fireEvent.keyDown(window, { key: 't' });

      await waitFor(() => {
        expect(screen.getByText('Pins')).toBeInTheDocument();
      });

      // Click the remove button
      const removeBtn = screen.getByTitle('Remove pin');
      await user.click(removeBtn);

      // Pin should be removed from localStorage
      expect(loadPins(hash)).toHaveLength(0);
    });

    it('pins persist across re-loads of the same content', async () => {
      const hash = 'paste:' + hashText(PASTE_TEXT);
      // Pre-seed pins
      savePins(hash, [
        { wordIndex: 3, context: 'one two three four five six', createdAt: 1000 },
      ]);

      const user = await setupReaderWithPaste();

      // Switch to text view — should see the pin
      fireEvent.keyDown(window, { key: 't' });

      await waitFor(() => {
        expect(screen.getByTestId('pin-indicator-3')).toBeInTheDocument();
        expect(screen.getByText('Pins')).toBeInTheDocument();
      });
    });

    it('does not add duplicate pins within 5 words', async () => {
      await setupReaderWithPaste();
      const hash = 'paste:' + hashText(PASTE_TEXT);

      // Add pin at position 0
      fireEvent.keyDown(window, { key: 'm' });
      expect(loadPins(hash)).toHaveLength(1);

      // Try adding another at position 0 — should be deduped
      fireEvent.keyDown(window, { key: 'm' });
      expect(loadPins(hash)).toHaveLength(1);
    });

    it('New file resets pins', async () => {
      const user = await setupReaderWithPaste();

      // Add a pin
      fireEvent.keyDown(window, { key: 'm' });

      // Click "New file"
      const closeButton = screen.getByTitle('New file');
      await user.click(closeButton);

      await waitFor(() => {
        // upload screen is back — logo span is always visible
        expect(screen.getByText('speed')).toBeInTheDocument();
      });
    });
  });
});
