import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpeedReader from '../SpeedReader.jsx';

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
      expect(screen.getByText('swift')).toBeInTheDocument();
      // "read" appears in both logo and subtitle, so use getAllByText
      const readElements = screen.getAllByText(/read/);
      expect(readElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders subtitle', () => {
      render(<SpeedReader />);
      expect(screen.getByText('open-source speed reader')).toBeInTheDocument();
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
      // Play button shows ▶ when paused
      expect(screen.getByText('▶')).toBeInTheDocument();
    });

    it('close button returns to upload screen', async () => {
      const user = await setupReader();
      // Click the close (✕) button — the "New file" button
      const closeButton = screen.getByTitle('New file');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.getByText('open-source speed reader')).toBeInTheDocument();
      });
    });
  });
});
