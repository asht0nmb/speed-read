import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TOCPanel } from '../SpeedReader.jsx';

const mockEntries = [
  { title: 'Chapter 1', pageNum: 1, wordIndex: 0, depth: 0 },
  { title: 'Section 1.1', pageNum: 1, wordIndex: 50, depth: 1 },
  { title: 'Chapter 2', pageNum: 3, wordIndex: 200, depth: 0 },
];

describe('TOCPanel', () => {
  it('renders all entry titles', () => {
    render(
      <TOCPanel
        entries={mockEntries}
        currentIndex={0}
        onSeek={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Chapter 1', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Section 1.1', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Chapter 2', { exact: false })).toBeInTheDocument();
  });

  it('shows page numbers', () => {
    render(
      <TOCPanel
        entries={mockEntries}
        currentIndex={0}
        onSeek={() => {}}
        onClose={() => {}}
      />
    );
    // Two entries are on page 1 (Chapter 1 and Section 1.1)
    const page1Elements = screen.getAllByText('p.1');
    expect(page1Elements.length).toBe(2);
    expect(screen.getByText('p.3')).toBeInTheDocument();
  });

  it('calls onSeek with correct wordIndex on click', () => {
    const onSeek = vi.fn();
    const onClose = vi.fn();
    render(
      <TOCPanel
        entries={mockEntries}
        currentIndex={0}
        onSeek={onSeek}
        onClose={onClose}
      />
    );
    // Click "Chapter 2" button
    fireEvent.click(screen.getByText('Chapter 2', { exact: false }));
    expect(onSeek).toHaveBeenCalledWith(200);
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <TOCPanel
        entries={mockEntries}
        currentIndex={0}
        onSeek={() => {}}
        onClose={onClose}
      />
    );
    // The first div is the backdrop (position: fixed, inset: 0)
    const backdrop = container.querySelector('div[style*="inset: 0"]') ||
      container.children[0];
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('highlights the current entry based on currentIndex', () => {
    // currentIndex=60 → Section 1.1 (wordIndex 50) is the most recent before 60
    const { container } = render(
      <TOCPanel
        entries={mockEntries}
        currentIndex={60}
        onSeek={() => {}}
        onClose={() => {}}
      />
    );
    // The active entry should have a left border (2px solid accent)
    const buttons = container.querySelectorAll('button');
    // Find the "Section 1.1" button — it should have border-left with accent color
    const section11Button = Array.from(buttons).find(b =>
      b.textContent.includes('Section 1.1')
    );
    expect(section11Button).toBeTruthy();
    expect(section11Button.style.borderLeft).toContain('2px solid');
    expect(section11Button.style.borderLeft).not.toContain('transparent');
  });

  it('renders Contents header', () => {
    render(
      <TOCPanel
        entries={mockEntries}
        currentIndex={0}
        onSeek={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Contents')).toBeInTheDocument();
  });
});
