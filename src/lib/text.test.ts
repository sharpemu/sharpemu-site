import { describe, it, expect } from 'vitest';
import { excerpt } from './text';

describe('excerpt', () => {
  it('strips markdown formatting', () => {
    expect(excerpt('**Bold game** boots to a [menu](https://x) screen.\n\n- item one')).toBe(
      'Bold game boots to a menu screen. item one',
    );
  });
  it('clamps long text at a word boundary with an ellipsis', () => {
    const out = excerpt('word '.repeat(100), 40);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out.endsWith('…')).toBe(true);
  });
  it('returns short text unchanged', () => {
    expect(excerpt('Runs fine.')).toBe('Runs fine.');
  });
});
