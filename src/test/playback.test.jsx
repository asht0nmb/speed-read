import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpeedReader from '../SpeedReader.jsx';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

vi.mock('../pdf.js', () => ({
  extractWithPDFJS: vi.fn(),
  parseTOC: vi.fn(async () => []),
}));

describe('Playback', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setupReader(text = 'one two three four five') {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SpeedReader />);

    await user.click(screen.getByText('Paste text'));
    const textarea = screen.getByPlaceholderText(/Paste your text here/);
    await user.type(textarea, text);
    await user.click(screen.getByText('Start Reading'));

    await waitFor(() => {
      expect(screen.getByText(/\/ 5/)).toBeInTheDocument();
    });
    return user;
  }

  it('advances words at correct interval when playing', async () => {
    const user = await setupReader();
    // Default WPM=300, chunkSize=1 → interval = 60000/300 = 200ms
    expect(screen.getByText(/1 \/ 5/)).toBeInTheDocument();

    // Start playing
    await user.click(screen.getByText('▶'));

    // Advance by 200ms — should move to next word
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(screen.getByText(/2 \/ 5/)).toBeInTheDocument();
    });
  });

  it('applies smart pause multiplier for sentence-ending punctuation', async () => {
    // "end. next" — the word "end." should take 2.8x longer
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SpeedReader />);

    await user.click(screen.getByText('Paste text'));
    const textarea = screen.getByPlaceholderText(/Paste your text here/);
    await user.type(textarea, 'end. next word');
    await user.click(screen.getByText('Start Reading'));

    await waitFor(() => {
      expect(screen.getByText(/\/ 3/)).toBeInTheDocument();
    });

    // Start playing at WPM=300 → base=200ms, "end." delay=200*2.8=560ms
    await user.click(screen.getByText('▶'));

    // After 200ms, should still be on word 1 (because "end." has 2.8x delay)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();

    // After 560ms total, should advance
    act(() => {
      vi.advanceTimersByTime(360);
    });

    await waitFor(() => {
      expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument();
    });
  });

  it('stops playback at end of words', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SpeedReader />);

    await user.click(screen.getByText('Paste text'));
    const textarea = screen.getByPlaceholderText(/Paste your text here/);
    await user.type(textarea, 'one two three');
    await user.click(screen.getByText('Start Reading'));

    await waitFor(() => {
      expect(screen.getByText(/\/ 3/)).toBeInTheDocument();
    });

    await user.click(screen.getByText('▶'));

    // Advance enough for all words (3 words × 200ms = 600ms, plus buffer)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should be at the end and paused (▶ shown again)
    await waitFor(() => {
      expect(screen.getByText('▶')).toBeInTheDocument();
    });
  });
});
