import { describe, it, expect, vi } from 'vitest';
import { groupIntoLines, detectHeadings, flattenOutline } from '../pdf.js';

// ─── groupIntoLines ──────────────────────────────────────────────────────────

describe('groupIntoLines', () => {
  it('groups items by Y-coordinate', () => {
    const items = [
      { str: 'hello', transform: [1, 0, 0, 1, 10, 100] },
      { str: 'world', transform: [1, 0, 0, 1, 60, 100] },
      { str: 'foo', transform: [1, 0, 0, 1, 10, 200] },
    ];
    const lines = groupIntoLines(items);
    expect(lines).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(groupIntoLines([])).toEqual([]);
  });

  it('sorts lines top-to-bottom (higher Y first in PDF coords)', () => {
    const items = [
      { str: 'bottom', transform: [1, 0, 0, 1, 10, 50] },
      { str: 'top', transform: [1, 0, 0, 1, 10, 200] },
    ];
    const lines = groupIntoLines(items);
    // Higher Y coordinate comes first (PDF coordinate system)
    expect(lines[0][0].str).toBe('top');
    expect(lines[1][0].str).toBe('bottom');
  });

  it('rounds Y-coordinates to group nearby items', () => {
    const items = [
      { str: 'a', transform: [1, 0, 0, 1, 10, 100.3] },
      { str: 'b', transform: [1, 0, 0, 1, 60, 100.4] },
    ];
    const lines = groupIntoLines(items);
    // Both round to 100, so they should be on the same line
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(2);
  });
});

// ─── detectHeadings ──────────────────────────────────────────────────────────

describe('detectHeadings', () => {
  function makeMockPdf(pages) {
    return {
      getPage: vi.fn(async (pageNum) => ({
        getTextContent: vi.fn(async () => ({
          items: pages[pageNum - 1] || [],
        })),
      })),
    };
  }

  it('detects ALL-CAPS headings', async () => {
    const pdf = makeMockPdf([
      [
        { str: 'INTRODUCTION', transform: [1, 0, 0, 1, 10, 700] },
        { str: 'some normal text here', transform: [1, 0, 0, 1, 10, 650] },
      ],
    ]);
    const pageBreaks = [{ pageNum: 1, wordIndex: 0 }];
    const result = await detectHeadings(pdf, pageBreaks);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].title).toBe('INTRODUCTION');
  });

  it('detects "Chapter X" pattern', async () => {
    const pdf = makeMockPdf([
      [
        { str: 'Chapter 1 The Beginning', transform: [1, 0, 0, 1, 10, 700] },
      ],
    ]);
    const pageBreaks = [{ pageNum: 1, wordIndex: 0 }];
    const result = await detectHeadings(pdf, pageBreaks);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Chapter 1 The Beginning');
  });

  it('detects numbered sections like "1.2 Title"', async () => {
    const pdf = makeMockPdf([
      [
        { str: '1.2 Methods', transform: [1, 0, 0, 1, 10, 700] },
      ],
    ]);
    const pageBreaks = [{ pageNum: 1, wordIndex: 0 }];
    const result = await detectHeadings(pdf, pageBreaks);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('1.2 Methods');
  });

  it('skips lines longer than 80 characters', async () => {
    const longText = 'A'.repeat(81);
    const pdf = makeMockPdf([
      [
        { str: longText, transform: [1, 0, 0, 1, 10, 700] },
      ],
    ]);
    const pageBreaks = [{ pageNum: 1, wordIndex: 0 }];
    const result = await detectHeadings(pdf, pageBreaks);
    expect(result).toHaveLength(0);
  });

  it('skips short ALL-CAPS words (< 3 non-space chars)', async () => {
    const pdf = makeMockPdf([
      [
        { str: 'AB', transform: [1, 0, 0, 1, 10, 700] },
      ],
    ]);
    const pageBreaks = [{ pageNum: 1, wordIndex: 0 }];
    const result = await detectHeadings(pdf, pageBreaks);
    expect(result).toHaveLength(0);
  });

  it('maps correct pageNum and wordIndex from pageBreaks', async () => {
    const pdf = makeMockPdf([
      [],
      [
        { str: 'RESULTS', transform: [1, 0, 0, 1, 10, 700] },
      ],
    ]);
    const pageBreaks = [
      { pageNum: 1, wordIndex: 0 },
      { pageNum: 2, wordIndex: 150 },
    ];
    const result = await detectHeadings(pdf, pageBreaks);
    expect(result.length).toBe(1);
    expect(result[0].pageNum).toBe(2);
    expect(result[0].wordIndex).toBe(150);
  });
});

// ─── flattenOutline ──────────────────────────────────────────────────────────

describe('flattenOutline', () => {
  it('handles single-level outline', async () => {
    const items = [
      { title: 'Chapter 1', dest: [{ num: 0 }], items: [] },
      { title: 'Chapter 2', dest: [{ num: 1 }], items: [] },
    ];
    const pdf = {
      getPageIndex: vi.fn(async () => 0),
    };
    const pageBreaks = [
      { pageNum: 1, wordIndex: 0 },
      { pageNum: 2, wordIndex: 100 },
    ];

    const result = await flattenOutline(items, pdf, pageBreaks);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Chapter 1');
    expect(result[0].depth).toBe(0);
    expect(result[1].title).toBe('Chapter 2');
  });

  it('handles nested items with incrementing depth', async () => {
    const items = [
      {
        title: 'Part 1',
        dest: [{ num: 0 }],
        items: [
          { title: 'Section 1.1', dest: [{ num: 0 }], items: [] },
        ],
      },
    ];
    const pdf = {
      getPageIndex: vi.fn(async () => 0),
    };
    const pageBreaks = [{ pageNum: 1, wordIndex: 0 }];

    const result = await flattenOutline(items, pdf, pageBreaks);
    expect(result).toHaveLength(2);
    expect(result[0].depth).toBe(0);
    expect(result[1].depth).toBe(1);
    expect(result[1].title).toBe('Section 1.1');
  });

  it('handles dest resolution failure gracefully', async () => {
    const items = [
      { title: 'Bad Dest', dest: 'nonexistent', items: [] },
    ];
    const pdf = {
      getDestination: vi.fn(async () => { throw new Error('not found'); }),
      getPageIndex: vi.fn(async () => 0),
    };
    const pageBreaks = [{ pageNum: 1, wordIndex: 0 }];

    const result = await flattenOutline(items, pdf, pageBreaks);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Bad Dest');
    expect(result[0].pageNum).toBe(1);
  });
});
