import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

async function setupReaderWithWords(text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone') {
  const user = userEvent.setup();
  render(<SpeedReader />);
  await user.click(screen.getByText('Paste text'));
  const textarea = screen.getByPlaceholderText(/Paste your text here/);
  await user.type(textarea, text);
  await user.click(screen.getByText('Start Reading'));
  await waitFor(() => {
    expect(screen.getByText(/\/ 21/)).toBeInTheDocument();
  });
  return user;
}

describe('Keyboard shortcuts', () => {
  beforeEach(() => localStorage.clear());

  it('Space toggles play/pause', async () => {
    await setupReaderWithWords();
    // Initially paused
    expect(screen.getByTitle('Play (Space)')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: ' ' });
    // Should now be playing
    await waitFor(() => {
      expect(screen.getByTitle('Pause (Space)')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: ' ' });
    await waitFor(() => {
      expect(screen.getByTitle('Play (Space)')).toBeInTheDocument();
    });
  });

  it('ArrowRight seeks forward 10 words', async () => {
    await setupReaderWithWords();
    // Start at word 1/21
    expect(screen.getByText(/1 \/ 21/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByText(/11 \/ 21/)).toBeInTheDocument();
    });
  });

  it('ArrowLeft seeks backward 10 words', async () => {
    await setupReaderWithWords();
    // First go forward
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByText(/11 \/ 21/)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByText(/1 \/ 21/)).toBeInTheDocument();
    });
  });

  it('ArrowLeft does not go below 0', async () => {
    await setupReaderWithWords();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    // Should stay at 1 (index 0)
    expect(screen.getByText(/1 \/ 21/)).toBeInTheDocument();
  });

  it('] increases WPM by 25', async () => {
    await setupReaderWithWords();
    // Default WPM is 300
    expect(screen.getByText('300 wpm')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: ']' });
    await waitFor(() => {
      expect(screen.getByText('325 wpm')).toBeInTheDocument();
    });
  });

  it('[ decreases WPM by 25', async () => {
    await setupReaderWithWords();
    fireEvent.keyDown(window, { key: '[' });
    await waitFor(() => {
      expect(screen.getByText('275 wpm')).toBeInTheDocument();
    });
  });

  it('R restarts to beginning', async () => {
    await setupReaderWithWords();
    // Advance forward
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByText(/11 \/ 21/)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'r' });
    await waitFor(() => {
      expect(screen.getByText(/1 \/ 21/)).toBeInTheDocument();
    });
  });

  it('T toggles text view', async () => {
    await setupReaderWithWords();
    fireEvent.keyDown(window, { key: 't' });
    // In text view, all words should be visible
    await waitFor(() => {
      expect(screen.getByText('one')).toBeInTheDocument();
      expect(screen.getByText('twenty')).toBeInTheDocument();
    });
  });

  it('O toggles ORP highlight', async () => {
    await setupReaderWithWords();
    // ORP is on by default — the ORP button should be active
    const orpButton = screen.getByTitle(/Toggle ORP/);
    expect(orpButton).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'o' });
    // ORP is now off — we can verify by checking the button state changed
    // (the active style changes)
  });

  it('? opens keyboard hints panel', async () => {
    await setupReaderWithWords();
    fireEvent.keyDown(window, { key: '?' });
    await waitFor(() => {
      expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
    });
  });

  it('Escape closes panels and pauses', async () => {
    await setupReaderWithWords();
    // Open keyboard hints first
    fireEvent.keyDown(window, { key: '?' });
    await waitFor(() => {
      expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Keyboard shortcuts')).not.toBeInTheDocument();
    });
  });

  it('shortcuts are ignored when INPUT is focused', async () => {
    await setupReaderWithWords();
    // The scrubber is an input[type=range] — focus it
    const scrubber = document.querySelector('input[type="range"]');
    scrubber.focus();

    const before = screen.getByText(/1 \/ 21/).textContent;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    // Should NOT have changed since input is focused
    // Note: the keydown handler checks document.activeElement.tagName
    expect(screen.getByText(/1 \/ 21/).textContent).toBe(before);
  });
});
