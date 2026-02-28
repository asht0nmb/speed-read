import { describe, it, expect } from 'vitest';
import { tokenize, findORP, pauseMultiplier, removeInlineCitations, removeParentheticalCitations, removeReferenceSections, removeCaptions, removeStandalonePageNumbers, cleanText, filterTokens } from '../utils.js';

// ─── tokenize ────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('splits basic whitespace-separated text', () => {
    expect(tokenize('hello world foo')).toEqual(['hello', 'world', 'foo']);
  });

  it('handles multiple spaces', () => {
    expect(tokenize('hello   world')).toEqual(['hello', 'world']);
  });

  it('handles mixed whitespace (tabs, newlines)', () => {
    expect(tokenize('hello\tworld\nfoo')).toEqual(['hello', 'world', 'foo']);
  });

  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(tokenize('   \t\n  ')).toEqual([]);
  });

  it('handles single word', () => {
    expect(tokenize('hello')).toEqual(['hello']);
  });

  it('preserves punctuation', () => {
    expect(tokenize('hello, world!')).toEqual(['hello,', 'world!']);
  });

  it('preserves hyphenated words', () => {
    expect(tokenize('well-known self-aware')).toEqual(['well-known', 'self-aware']);
  });
});

// ─── findORP ─────────────────────────────────────────────────────────────────

describe('findORP', () => {
  it('returns 0 for single character', () => {
    expect(findORP('a')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(findORP('')).toBe(0);
  });

  it('returns 0 for 2-3 character words', () => {
    expect(findORP('ab')).toBe(0);
    expect(findORP('the')).toBe(0);
  });

  it('returns 1 for 4-5 character words', () => {
    expect(findORP('word')).toBe(1);
    expect(findORP('hello')).toBe(1);
  });

  it('returns 2 for 6-9 character words', () => {
    expect(findORP('garden')).toBe(2);
    expect(findORP('beautiful')).toBe(2);
  });

  it('returns 3 for 10+ character words', () => {
    expect(findORP('programming')).toBe(3);
    expect(findORP('extraordinary')).toBe(3);
  });

  it('strips punctuation before computing length', () => {
    // "hi!" has clean length 2 → 0
    expect(findORP('hi!')).toBe(0);
    // "hello," has clean length 5 → 1
    expect(findORP('hello,')).toBe(1);
  });

  it('handles all-punctuation input', () => {
    // clean length 0 → 0
    expect(findORP('...')).toBe(0);
    expect(findORP('!?')).toBe(0);
  });

  it('handles numbers in words', () => {
    // "abc123" has clean length 6 → 2
    expect(findORP('abc123')).toBe(2);
  });
});

// ─── pauseMultiplier ─────────────────────────────────────────────────────────

describe('pauseMultiplier', () => {
  it('returns 2.8 for sentence-ending period', () => {
    expect(pauseMultiplier('end.')).toBe(2.8);
  });

  it('returns 2.8 for exclamation mark', () => {
    expect(pauseMultiplier('wow!')).toBe(2.8);
  });

  it('returns 2.8 for question mark', () => {
    expect(pauseMultiplier('what?')).toBe(2.8);
  });

  it('returns 1.6 for comma', () => {
    expect(pauseMultiplier('however,')).toBe(1.6);
  });

  it('returns 1.6 for semicolon', () => {
    expect(pauseMultiplier('here;')).toBe(1.6);
  });

  it('returns 1.6 for colon', () => {
    expect(pauseMultiplier('note:')).toBe(1.6);
  });

  it('returns 1 for normal words', () => {
    expect(pauseMultiplier('hello')).toBe(1);
    expect(pauseMultiplier('world')).toBe(1);
  });

  it('returns 1 for empty string', () => {
    expect(pauseMultiplier('')).toBe(1);
  });

  it('only checks trailing punctuation', () => {
    // Mid-word punctuation doesn't trigger
    expect(pauseMultiplier('e.g')).toBe(1);
    expect(pauseMultiplier("it's")).toBe(1);
  });

  it('returns 1 for all words when pauseScale is 0', () => {
    expect(pauseMultiplier('end.', 0)).toBe(1);
    expect(pauseMultiplier('however,', 0)).toBe(1);
    expect(pauseMultiplier('hello', 0)).toBe(1);
  });

  it('halves the pause effect when pauseScale is 0.5', () => {
    // sentence-end: 1 + (2.8 - 1) * 0.5 = 1.9
    expect(pauseMultiplier('end.', 0.5)).toBeCloseTo(1.9);
    // mid-sentence: 1 + (1.6 - 1) * 0.5 = 1.3
    expect(pauseMultiplier('however,', 0.5)).toBeCloseTo(1.3);
  });

  it('returns default values when pauseScale is 1.0', () => {
    expect(pauseMultiplier('end.', 1.0)).toBeCloseTo(2.8);
    expect(pauseMultiplier('however,', 1.0)).toBeCloseTo(1.6);
    expect(pauseMultiplier('hello', 1.0)).toBe(1);
  });

  it('doubles the pause effect when pauseScale is 2.0', () => {
    // sentence-end: 1 + (2.8 - 1) * 2 = 4.6
    expect(pauseMultiplier('end.', 2.0)).toBeCloseTo(4.6);
    // mid-sentence: 1 + (1.6 - 1) * 2 = 2.2
    expect(pauseMultiplier('however,', 2.0)).toBeCloseTo(2.2);
  });
});

// ─── removeInlineCitations ──────────────────────────────────────────────────

describe('removeInlineCitations', () => {
  it('strips [1] from text', () => {
    expect(removeInlineCitations('This is a fact [1] and more.')).toBe('This is a fact  and more.');
  });

  it('strips [1,3] multi-cite', () => {
    expect(removeInlineCitations('Results [1,3] show.')).toBe('Results  show.');
  });

  it('strips [1-5] range citation', () => {
    expect(removeInlineCitations('Studies [1-5] confirm.')).toBe('Studies  confirm.');
  });

  it('strips [12,14,16] multiple numbers', () => {
    expect(removeInlineCitations('Data [12,14,16] suggests.')).toBe('Data  suggests.');
  });

  it('strips Unicode superscript digits', () => {
    expect(removeInlineCitations('This fact¹²³ is proven.')).toBe('This fact is proven.');
  });

  it('preserves [word] (alphabetic content in brackets)', () => {
    expect(removeInlineCitations('Use [sic] here.')).toBe('Use [sic] here.');
  });

  it('preserves text around removed citations', () => {
    const result = removeInlineCitations('Before [1] after');
    expect(result).toContain('Before');
    expect(result).toContain('after');
  });

  it('handles text with no citations (passthrough)', () => {
    expect(removeInlineCitations('No citations here.')).toBe('No citations here.');
  });

  it('handles empty string', () => {
    expect(removeInlineCitations('')).toBe('');
  });
});

// ─── removeParentheticalCitations ───────────────────────────────────────────

describe('removeParentheticalCitations', () => {
  it('strips (Smith, 2020)', () => {
    expect(removeParentheticalCitations('This is true (Smith, 2020) indeed.')).toBe('This is true  indeed.');
  });

  it('strips (Smith & Jones, 2019)', () => {
    expect(removeParentheticalCitations('Results (Smith & Jones, 2019) show.')).toBe('Results  show.');
  });

  it('strips (Smith et al., 2021)', () => {
    expect(removeParentheticalCitations('Data (Smith et al., 2021) confirms.')).toBe('Data  confirms.');
  });

  it('strips (see Smith, 2020; Jones, 2019) multi-cite with prefix', () => {
    expect(removeParentheticalCitations('As noted (see Smith, 2020; Jones, 2019) here.')).toBe('As noted  here.');
  });

  it('strips (cf. Smith, 2020) with cf. prefix', () => {
    expect(removeParentheticalCitations('Compare (cf. Smith, 2020) results.')).toBe('Compare  results.');
  });

  it('preserves (in 1985, during a recession)', () => {
    const text = 'It happened (in 1985, during a recession) quickly.';
    expect(removeParentheticalCitations(text)).toBe(text);
  });

  it('preserves (about 2000 people)', () => {
    const text = 'There were (about 2000 people) present.';
    expect(removeParentheticalCitations(text)).toBe(text);
  });

  it('handles text with no citations (passthrough)', () => {
    expect(removeParentheticalCitations('No citations here.')).toBe('No citations here.');
  });

  it('handles empty string', () => {
    expect(removeParentheticalCitations('')).toBe('');
  });
});

// ─── removeReferenceSections ────────────────────────────────────────────────

describe('removeReferenceSections', () => {
  it('truncates from \\nReferences\\n to end', () => {
    const text = 'Content here.\nReferences\nSmith, 2020. Some paper.';
    expect(removeReferenceSections(text)).toBe('Content here.');
  });

  it('truncates from \\nBIBLIOGRAPHY\\n (all caps)', () => {
    const text = 'Content here.\nBIBLIOGRAPHY\nSmith, 2020. Some paper.';
    expect(removeReferenceSections(text)).toBe('Content here.');
  });

  it('truncates from \\nWorks Cited\\n', () => {
    const text = 'Content here.\nWorks Cited\nSmith, 2020. Some paper.';
    expect(removeReferenceSections(text)).toBe('Content here.');
  });

  it('truncates from \\nEndnotes\\n', () => {
    const text = 'Content here.\nEndnotes\nSmith, 2020. Some paper.';
    expect(removeReferenceSections(text)).toBe('Content here.');
  });

  it('preserves "references" mid-sentence', () => {
    const text = 'The author references several works in this section.';
    expect(removeReferenceSections(text)).toBe(text);
  });

  it('preserves text before the reference section header', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\nReferences\nRef list.';
    const result = removeReferenceSections(text);
    expect(result).toContain('First paragraph.');
    expect(result).toContain('Second paragraph.');
    expect(result).not.toContain('Ref list.');
  });

  it('handles text with no reference section (passthrough)', () => {
    const text = 'Just a normal document with no reference section.';
    expect(removeReferenceSections(text)).toBe(text);
  });

  it('handles empty string', () => {
    expect(removeReferenceSections('')).toBe('');
  });
});

// ─── removeCaptions ─────────────────────────────────────────────────────────

describe('removeCaptions', () => {
  it('strips Figure 1: description text line', () => {
    const text = 'Some text.\nFigure 1: A bar chart showing results.\nMore text.';
    const result = removeCaptions(text);
    expect(result).toContain('Some text.');
    expect(result).toContain('More text.');
    expect(result).not.toContain('A bar chart');
  });

  it('strips Fig. 2. another caption line', () => {
    const text = 'Before.\nFig. 2. Caption here.\nAfter.';
    const result = removeCaptions(text);
    expect(result).not.toContain('Caption here');
  });

  it('strips Table 3: data description line', () => {
    const text = 'Before.\nTable 3: Summary of data.\nAfter.';
    const result = removeCaptions(text);
    expect(result).not.toContain('Summary of data');
  });

  it('strips Chart 1: chart description line', () => {
    const text = 'Before.\nChart 1: Revenue breakdown.\nAfter.';
    const result = removeCaptions(text);
    expect(result).not.toContain('Revenue breakdown');
  });

  it('preserves "Figure 1 shows" mid-sentence (no separator)', () => {
    const text = 'As Figure 1 shows the results are clear.';
    expect(removeCaptions(text)).toBe(text);
  });

  it('preserves surrounding text', () => {
    const text = 'Paragraph one.\nFigure 1: Caption.\nParagraph two.';
    const result = removeCaptions(text);
    expect(result).toContain('Paragraph one.');
    expect(result).toContain('Paragraph two.');
  });

  it('handles text with no captions (passthrough)', () => {
    const text = 'Just normal text without any captions.';
    expect(removeCaptions(text)).toBe(text);
  });

  it('handles empty string', () => {
    expect(removeCaptions('')).toBe('');
  });
});

// ─── removeStandalonePageNumbers ────────────────────────────────────────────

describe('removeStandalonePageNumbers', () => {
  it('strips isolated number with whitespace', () => {
    const text = 'End of page.\n  42  \nStart of next.';
    const result = removeStandalonePageNumbers(text);
    expect(result).not.toMatch(/42/);
  });

  it('strips single digit', () => {
    const text = 'End.\n1\nStart.';
    const result = removeStandalonePageNumbers(text);
    expect(result).toContain('End.');
    expect(result).toContain('Start.');
  });

  it('strips 4-digit page number', () => {
    const text = 'End.\n1234\nStart.';
    const result = removeStandalonePageNumbers(text);
    expect(result).not.toMatch(/1234/);
  });

  it('does NOT strip 5+ digit numbers', () => {
    const text = 'End.\n12345\nStart.';
    const result = removeStandalonePageNumbers(text);
    expect(result).toContain('12345');
  });

  it('preserves numbers within sentences', () => {
    const text = 'There are 42 cats in the house.';
    expect(removeStandalonePageNumbers(text)).toBe(text);
  });

  it('handles text with no page numbers (passthrough)', () => {
    const text = 'Just text on each line.\nMore text here.';
    expect(removeStandalonePageNumbers(text)).toBe(text);
  });

  it('handles empty string', () => {
    expect(removeStandalonePageNumbers('')).toBe('');
  });
});

// ─── cleanText ──────────────────────────────────────────────────────────────

describe('cleanText', () => {
  it('applies all filters when all options are true', () => {
    const text = 'Data [1] shown (Smith, 2020).\nFigure 1: Chart.\n42\nReferences\nRef list.';
    const options = {
      inlineCitations: true,
      parentheticalCitations: true,
      referenceSections: true,
      captions: true,
      pageNumbers: true,
    };
    const result = cleanText(text, options);
    expect(result).not.toContain('[1]');
    expect(result).not.toContain('Smith, 2020');
    expect(result).not.toContain('Ref list.');
    expect(result).not.toContain('Figure 1: Chart.');
  });

  it('skips filters when options are false', () => {
    const text = 'Data [1] shown (Smith, 2020).';
    const options = {
      inlineCitations: false,
      parentheticalCitations: false,
      referenceSections: false,
      captions: false,
      pageNumbers: false,
    };
    expect(cleanText(text, options)).toBe(text);
  });

  it('returns unmodified text when options is empty/all false', () => {
    const text = 'Data [1] shown.';
    expect(cleanText(text, {})).toBe(text);
  });

  it('handles empty string', () => {
    expect(cleanText('', { inlineCitations: true })).toBe('');
  });

  it('applies only selected filters', () => {
    const text = 'Data [1] shown (Smith, 2020).';
    const result = cleanText(text, { inlineCitations: true });
    expect(result).not.toContain('[1]');
    expect(result).toContain('(Smith, 2020)');
  });
});

// ─── filterTokens ───────────────────────────────────────────────────────────

describe('filterTokens', () => {
  it('removes [1] bracket citation tokens', () => {
    const words = ['Hello', '[1]', 'world'];
    expect(filterTokens(words, { inlineCitations: true })).toEqual(['Hello', 'world']);
  });

  it('removes [1,3] bracket citation tokens', () => {
    const words = ['Hello', '[1,3]', 'world'];
    expect(filterTokens(words, { inlineCitations: true })).toEqual(['Hello', 'world']);
  });

  it('removes Unicode superscript tokens', () => {
    const words = ['Hello', '\u00B9\u00B2\u00B3', 'world'];
    expect(filterTokens(words, { inlineCitations: true })).toEqual(['Hello', 'world']);
  });

  it('preserves normal word tokens', () => {
    const words = ['Hello', 'world', 'foo'];
    expect(filterTokens(words, { inlineCitations: true })).toEqual(['Hello', 'world', 'foo']);
  });

  it('returns unmodified array when inlineCitations is false', () => {
    const words = ['Hello', '[1]', 'world'];
    expect(filterTokens(words, { inlineCitations: false })).toEqual(['Hello', '[1]', 'world']);
  });

  it('returns unmodified array when options is empty/undefined', () => {
    const words = ['Hello', '[1]', 'world'];
    expect(filterTokens(words, {})).toEqual(['Hello', '[1]', 'world']);
    expect(filterTokens(words, undefined)).toEqual(['Hello', '[1]', 'world']);
  });

  it('handles empty array', () => {
    expect(filterTokens([], { inlineCitations: true })).toEqual([]);
  });
});
