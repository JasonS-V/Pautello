import { describe, it, expect } from 'vitest';
import {
  getTransposedKeySignature,
  transposeStaffMeasures,
  TRANSPOSITION_PRESETS,
  extractPartScore,
} from './transposition';
import { Measure } from '../types/music';

describe('transposition utility', () => {
  it('correctly calculates transposed key signature for Bb instrument (+2 semitones)', () => {
    // Concert C -> Bb Trumpet D
    expect(getTransposedKeySignature('C', 2)).toBe('D');
    // Concert F -> Bb Trumpet G
    expect(getTransposedKeySignature('F', 2)).toBe('G');
    // Concert Bb -> Bb Trumpet C
    expect(getTransposedKeySignature('Bb', 2)).toBe('C');
    // Concert G -> Bb Trumpet A
    expect(getTransposedKeySignature('G', 2)).toBe('A');
  });

  it('correctly calculates transposed key signature for Eb instrument (+9 semitones)', () => {
    // Concert C -> Eb Alto Sax A
    expect(getTransposedKeySignature('C', 9)).toBe('A');
    // Concert F -> Eb Alto Sax D
    expect(getTransposedKeySignature('F', 9)).toBe('D');
  });

  it('correctly calculates transposed key signature for F instrument (+7 semitones)', () => {
    // Concert C -> French Horn G
    expect(getTransposedKeySignature('C', 7)).toBe('G');
    // Concert F -> French Horn C
    expect(getTransposedKeySignature('F', 7)).toBe('C');
  });

  it('transposes staff measures cleanly', () => {
    const originalMeasures: Measure[] = [
      {
        id: 'm1',
        items: [
          {
            id: 'n1',
            type: 'note',
            pitch: { step: 'C', octave: 4, accidental: null },
            duration: 'q',
          },
        ],
      },
    ];

    const transposed = transposeStaffMeasures(originalMeasures, 2, 'D');
    expect(transposed[0].items[0].pitch?.step).toBe('D');
    expect(transposed[0].items[0].pitch?.octave).toBe(4);
  });

  it('includes standard presets for C, Bb, Eb, and F instruments', () => {
    expect(TRANSPOSITION_PRESETS.find((p) => p.id === 'C')?.semitones).toBe(0);
    expect(TRANSPOSITION_PRESETS.find((p) => p.id === 'Bb')?.semitones).toBe(2);
    expect(TRANSPOSITION_PRESETS.find((p) => p.id === 'Eb')?.semitones).toBe(9);
    expect(TRANSPOSITION_PRESETS.find((p) => p.id === 'F')?.semitones).toBe(7);
  });

  it('extracts a transposed particella score cleanly', () => {
    const fullScore = {
      id: 'full-score',
      title: 'Fanfarria',
      composer: 'Autor',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C' as const,
      createdAt: 1000,
      updatedAt: 1000,
      staves: [
        {
          id: 'staff-1',
          name: 'Trompeta en Si♭',
          clef: 'treble' as const,
          transposition: 2,
          measures: [
            {
              id: 'm1',
              items: [
                {
                  id: 'n1',
                  type: 'note' as const,
                  pitch: { step: 'C' as const, octave: 4, accidental: null },
                  duration: 'q' as const,
                },
              ],
            },
          ],
        },
      ],
    };

    const particella = extractPartScore(fullScore, 0);
    expect(particella.staves).toHaveLength(1);
    expect(particella.keySignature).toBe('D');
    expect(particella.staves[0].measures[0].items[0].pitch?.step).toBe('D');
    expect(particella.partName).toBe('Trompeta en Si♭');
  });
});
