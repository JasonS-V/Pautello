import { describe, it, expect } from 'vitest';
import { consolidateTacetsInScore, clearTacetsInScore, isMeasureTacetEligible } from './tacetUtils';
import { Score } from '../types/music';

describe('tacetUtils', () => {
  it('correctly checks tacet eligibility based on Gould engraving rules', () => {
    // Empty measure is eligible
    expect(isMeasureTacetEligible({ id: 'm1', items: [] })).toBe(true);

    // Measure with only rest is eligible
    expect(
      isMeasureTacetEligible({
        id: 'm2',
        items: [{ id: 'r1', type: 'rest', duration: 'w' }],
      })
    ).toBe(true);

    // Measure with a note is NOT eligible
    expect(
      isMeasureTacetEligible({
        id: 'm3',
        items: [
          {
            id: 'n1',
            type: 'note',
            pitch: { step: 'C', octave: 4, accidental: null },
            duration: 'w',
          },
        ],
      })
    ).toBe(false);

    // Measure with rehearsal mark is NOT eligible
    expect(
      isMeasureTacetEligible({
        id: 'm4',
        rehearsalMark: 'A',
        items: [],
      })
    ).toBe(false);

    // Measure with repeat barline is NOT eligible
    expect(
      isMeasureTacetEligible({
        id: 'm5',
        repeatStart: true,
        items: [],
      })
    ).toBe(false);
  });

  it('consolidates 4 consecutive empty measures into a multimeasure rest', () => {
    const score: Score = {
      id: 'test',
      title: 'Tacet Test',
      composer: 'Tester',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      createdAt: 1000,
      updatedAt: 1000,
      staves: [
        {
          id: 'staff-1',
          name: 'Flauta',
          clef: 'treble',
          measures: [
            { id: 'm1', items: [{ id: 'r1', type: 'rest', duration: 'w' }] },
            { id: 'm2', items: [{ id: 'r2', type: 'rest', duration: 'w' }] },
            { id: 'm3', items: [{ id: 'r3', type: 'rest', duration: 'w' }] },
            { id: 'm4', items: [{ id: 'r4', type: 'rest', duration: 'w' }] },
            {
              id: 'm5',
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'C', octave: 5, accidental: null },
                  duration: 'w',
                },
              ],
            },
          ],
        },
      ],
    };

    const consolidated = consolidateTacetsInScore(score);
    expect(consolidated.staves[0].measures[0].multimeasureRest).toBe(4);
    expect(consolidated.staves[0].measures[1].multimeasureRest).toBeUndefined();
    expect(consolidated.staves[0].measures[4].multimeasureRest).toBeUndefined();

    // Now clear all tacets
    const cleared = clearTacetsInScore(consolidated);
    expect(cleared.staves[0].measures[0].multimeasureRest).toBeUndefined();
  });
});
