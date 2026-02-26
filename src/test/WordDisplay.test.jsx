import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordDisplay } from '../SpeedReader.jsx';

describe('WordDisplay', () => {
  it('renders null for empty word', () => {
    const { container } = render(<WordDisplay word="" showORP={true} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null for null word', () => {
    const { container } = render(<WordDisplay word={null} showORP={true} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null for undefined word', () => {
    const { container } = render(<WordDisplay word={undefined} showORP={true} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the full word text', () => {
    const { container } = render(<WordDisplay word="hello" showORP={true} />);
    expect(container.textContent).toBe('hello');
  });

  it('splits word at correct ORP index for short word', () => {
    // "hi" → ORP index 0 → before="", focus="h", after="i"
    const { container } = render(<WordDisplay word="hi" showORP={true} />);
    const spans = container.querySelectorAll('span');
    // The focus letter span should contain "h"
    expect(container.textContent).toBe('hi');
  });

  it('splits word at correct ORP index for medium word', () => {
    // "hello" → ORP index 1 → before="h", focus="e", after="llo"
    const { container } = render(<WordDisplay word="hello" showORP={true} />);
    expect(container.textContent).toBe('hello');
  });

  it('highlights focus letter with accent color when showORP=true', () => {
    const { container } = render(<WordDisplay word="hello" showORP={true} />);
    // The span wrapping the focus letter should have fontWeight 700
    const innerDiv = container.querySelector('div > div:last-child');
    const focusSpan = innerDiv.querySelector('span');
    expect(focusSpan.style.fontWeight).toBe('700');
  });

  it('does not highlight focus letter when showORP=false', () => {
    const { container } = render(<WordDisplay word="hello" showORP={false} />);
    const innerDiv = container.querySelector('div > div:last-child');
    const focusSpan = innerDiv.querySelector('span');
    expect(focusSpan.style.fontWeight).toBe('400');
  });

  it('renders single character word correctly', () => {
    // "a" → ORP index 0 → before="", focus="a", after=""
    const { container } = render(<WordDisplay word="a" showORP={true} />);
    expect(container.textContent).toBe('a');
  });

  it('renders long word correctly', () => {
    // "programming" → ORP index 3 → before="pro", focus="g", after="ramming"
    const { container } = render(<WordDisplay word="programming" showORP={true} />);
    expect(container.textContent).toBe('programming');
  });
});
