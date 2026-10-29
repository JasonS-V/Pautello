import { describe, expect, it, vi } from 'vitest';
import { migrateOmrDraftRecord, saveOmrDraft } from '../omrDraftPersistence';
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

  it('migrates legacy OMR drafts with schema v1 Score to schema v2 while preserving recognizedScore and review effort (F9.4)', () => {
    const legacyDraft = {
      savedAt: 1700000000000,
      score: {
        id: 'legacy-1',
        title: 'Borrador antiguo',
        composer: 'Autor',
        tempo: 120,
        timeSignature: { beats: 3, beatType: 4 },
        keySignature: 'C',
        createdAt: 1,
        updatedAt: 1,
        staves: [
          {
            id: 'st-1',
            name: 'Bajo',
            clef: 'bass',
            measures: [
              {
                id: 'm-1',
                items: [
                  {
                    id: 'n-1',
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'G', octave: 3, accidental: null },
                  },
                ],
              },
            ],
          },
        ],
      },
      result: {
        score: {
          id: 'legacy-1',
          title: 'Borrador antiguo',
          composer: 'Autor',
          tempo: 120,
          timeSignature: { beats: 3, beatType: 4 },
          keySignature: 'C',
          createdAt: 1,
          updatedAt: 1,
          staves: [
            {
              id: 'st-1',
              name: 'Bajo',
              clef: 'bass',
              measures: [
                {
                  id: 'm-1',
                  items: [
                    {
                      id: 'n-1',
                      type: 'note',
                      duration: 'h',
                      pitch: { step: 'G', octave: 3, accidental: null },
                    },
                  ],
                },
              ],
            },
          ],
        },
        confidence: 80,
        pagesProcessed: 1,
        stavesDetected: 1,
        measuresDetected: 1,
        notesDetected: 1,
        sourceType: 'neural-onnx',
        ir: null,
        sourceLinks: [],
        warnings: [],
      },
    };

    const migrated = migrateOmrDraftRecord(legacyDraft);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(1);
    expect(migrated!.score.schemaVersion).toBe(2);
    expect(migrated!.result.recognizedScore?.schemaVersion).toBe(2);
    expect(migrated!.result.recognizedScore?.staves[0].measures[0].items[0].duration).toBe('h');
    expect(migrated!.score.staves[0].measures[0].items[0].duration).toBe('q');
    expect(migrated!.result.reviewStatus).toBe('automatic');
    expect(migrated!.interventionCount).toBe(0);
    expect(migrated!.reviewDurationSeconds).toBe(0);
  });
});
