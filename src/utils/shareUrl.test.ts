import { describe, it, expect } from 'vitest';
import { compressScoreToHash, decompressScoreFromHash } from './shareUrl';
import { Score } from '../types/music';

describe('shareUrl', () => {
  it('correctly compresses and decompresses a Score round-trip', async () => {
    const score: Score = {
      id: 'shared-score',
      title: 'Obra Compartida',
      composer: 'Compositor',
      tempo: 128,
      timeSignature: { beats: 3, beatType: 4 },
      keySignature: 'G',
      staves: [{
        id: 's1',
        name: 'Violín',
        clef: 'treble',
        measures: [{
          id: 'm1',
          items: [
            {
              id: 'item1',
              type: 'note',
              pitch: { step: 'G', octave: 4, accidental: null },
              duration: 'h',
              chord: 'G',
              lyric: 'Luz',
            }
          ]
        }]
      }],
      createdAt: 1000,
      updatedAt: 2000,
    };

    const hash = await compressScoreToHash(score);
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');

    const restored = await decompressScoreFromHash(hash);
    expect(restored).not.toBeNull();
    expect(restored?.title).toBe('Obra Compartida');
    expect(restored?.tempo).toBe(128);
    expect(restored?.keySignature).toBe('G');
    expect(restored?.staves[0].measures[0].items[0].chord).toBe('G');
    expect(restored?.staves[0].measures[0].items[0].lyric).toBe('Luz');
  });

  it('handles invalid hash gracefully', async () => {
    const result = await decompressScoreFromHash('invalid-garbage-hash');
    expect(result).toBeNull();
  });
});
