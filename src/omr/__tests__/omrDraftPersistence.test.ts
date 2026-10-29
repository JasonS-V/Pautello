import { describe, expect, it, vi } from 'vitest';
import { saveOmrDraft } from '../omrDraftPersistence';
import type { OmrDraft } from '../omrDraftPersistence';

describe('OMR draft persistence', () => {
  it('rejects an oversized draft before touching IndexedDB', async () => {
    const draft = {
      version: 1,
      result: { sourcePages: [{ imageUrl: 'x'.repeat(24_000_001) }] },
    } as OmrDraft;
    await expect(saveOmrDraft(draft)).rejects.toThrow('superan el límite');
  });

  it('reports unavailable storage instead of claiming that the draft was saved', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(saveOmrDraft({ version: 1, result: {} } as OmrDraft)).rejects.toThrow(
      'no está disponible'
    );
    vi.unstubAllGlobals();
  });
});
