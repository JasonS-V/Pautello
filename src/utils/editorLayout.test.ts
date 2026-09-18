import { describe, expect, it } from 'vitest';
import { isCompactEditorViewport } from './editorLayout';

describe('editor layout breakpoints', () => {
  it('moves the inspector to its compact presentation below 1024px', () => {
    expect(isCompactEditorViewport(1023)).toBe(true);
  });

  it('keeps the desktop inspector available from 1024px onwards', () => {
    expect(isCompactEditorViewport(1024)).toBe(false);
  });
});
