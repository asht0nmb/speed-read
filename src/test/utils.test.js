import { describe, it, expect } from 'vitest';
import { tokenize, findORP, pauseMultiplier } from '../utils.js';

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
});
