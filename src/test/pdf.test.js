import { describe, it, expect, vi } from 'vitest';
import { groupIntoLines, detectHeadings, flattenOutline, extractWithPDFJS } from '../pdf.js';
import { getDocument } from 'pdfjs-dist';

// ─── extractWithPDFJS margin filtering ──────────────────────────────────────

// Mock pdfjs-dist for extractWithPDFJS tests
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

describe('extractWithPDFJS margin filtering', () => {

  function makeMockPdfDoc(pages) {
    // pages: array of { items, height }
    return {
      numPages: pages.length,
      getPage: vi.fn(async (pageNum) => ({
        getTextContent: vi.fn(async () => ({
          items: pages[pageNum - 1].items,
        })),
        getViewport: vi.fn(({ scale }) => ({
          height: pages[pageNum - 1].height * scale,
        })),
      })),
    };
  }

  function makeFile(content = 'dummy') {
    return new File([content], 'test.pdf', { type: 'application/pdf' });
  }

  function setupMock(pages) {
    const doc = makeMockPdfDoc(pages);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    return doc;
  }

  it('includes all items when marginPercent is 0', async () => {
    setupMock([{
      height: 1000,
      items: [
        { str: 'header', transform: [1, 0, 0, 1, 50, 960], width: 40, hasEOL: true },
        { str: 'body', transform: [1, 0, 0, 1, 50, 500], width: 30, hasEOL: true },
        { str: 'footer', transform: [1, 0, 0, 1, 50, 30], width: 40, hasEOL: true },
      ],
    }]);

    const { text } = await extractWithPDFJS(makeFile(), 1.2, 0);
    expect(text).toContain('header');
    expect(text).toContain('body');
    expect(text).toContain('footer');
  });

  it('excludes header and footer items at default marginPercent', async () => {
    setupMock([{
      height: 1000,
      items: [
        { str: 'header', transform: [1, 0, 0, 1, 50, 950], width: 40, hasEOL: true },
        { str: 'body', transform: [1, 0, 0, 1, 50, 500], width: 30, hasEOL: true },
        { str: 'footer', transform: [1, 0, 0, 1, 50, 50], width: 40, hasEOL: true },
      ],
    }]);

    // 8% of 1000 = 80. footer y=50 < 80, header y=950 > 920
    const { text } = await extractWithPDFJS(makeFile(), 1.2, 0.08);
    expect(text).not.toContain('header');
    expect(text).toContain('body');
    expect(text).not.toContain('footer');
  });

  it('keeps items exactly at margin boundary', async () => {
    setupMock([{
      height: 1000,
      items: [
        // y=80 is NOT < 80, so it should be included (bottom boundary)
        { str: 'atbottom', transform: [1, 0, 0, 1, 50, 80], width: 50, hasEOL: true },
        // y=920 is NOT > 920, so it should be included (top boundary)
        { str: 'attop', transform: [1, 0, 0, 1, 50, 920], width: 40, hasEOL: true },
        { str: 'middle', transform: [1, 0, 0, 1, 50, 500], width: 40, hasEOL: true },
      ],
    }]);

    const { text } = await extractWithPDFJS(makeFile(), 1.2, 0.08);
    expect(text).toContain('atbottom');
    expect(text).toContain('attop');
    expect(text).toContain('middle');
  });

  it('filters more aggressively with higher marginPercent', async () => {
    setupMock([{
      height: 1000,
      items: [
        { str: 'nearTop', transform: [1, 0, 0, 1, 50, 800], width: 40, hasEOL: true },
        { str: 'center', transform: [1, 0, 0, 1, 50, 500], width: 40, hasEOL: true },
        { str: 'nearBottom', transform: [1, 0, 0, 1, 50, 200], width: 50, hasEOL: true },
      ],
    }]);

    // 25% of 1000 = 250. nearBottom y=200 < 250, nearTop y=800 > 750
    const { text } = await extractWithPDFJS(makeFile(), 1.2, 0.25);
    expect(text).not.toContain('nearTop');
    expect(text).toContain('center');
    expect(text).not.toContain('nearBottom');
  });
});

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
