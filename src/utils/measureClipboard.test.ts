import { describe, it, expect } from 'vitest';
import {
  copyMeasuresFromScore,
  pasteMeasuresIntoScore,
  getNextNavigationPosition,
} from './measureClipboard';
import { Score } from '../types/music';

const createMockScore = (): Score => ({
  id: 'test-score',
  title: 'Test Score',
  composer: 'Tester',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  keySignature: 'C',
  staves: [
    {
      id: 'staff-1',
      name: 'Voz',
      clef: 'treble',
      measures: [
        {
          id: 'm-0',
          items: [
            {
              id: 'it-0-0',
              type: 'note',
              pitch: { step: 'C', octave: 4, accidental: null },
              duration: 'q',
            },
            {
              id: 'it-0-1',
              type: 'note',
              pitch: { step: 'D', octave: 4, accidental: null },
              duration: 'q',
            },
          ],
        },
        {
          id: 'm-1',
          items: [
            {
              id: 'it-1-0',
              type: 'note',
              pitch: { step: 'E', octave: 4, accidental: null },
              duration: 'h',
            },
          ],
        },
        {
          id: 'm-2',
          items: [{ id: 'it-2-0', type: 'rest', duration: 'w' }],
        },
      ],
    },
  ],
});

describe('measureClipboard', () => {
  it('copies a single measure correctly', () => {
    const score = createMockScore();
    const clip = copyMeasuresFromScore(score, 0, 0);
    expect(clip.count).toBe(1);
    expect(clip.stavesMeasures[0][0].items).toHaveLength(2);
  });

  it('copies a range of measures correctly', () => {
    const score = createMockScore();
    const clip = copyMeasuresFromScore(score, 0, 1);
    expect(clip.count).toBe(2);
    expect(clip.stavesMeasures[0]).toHaveLength(2);
  });

  it('pastes clipboard measures into a score and regenerates unique item IDs', () => {
    const score = createMockScore();
    const clip = copyMeasuresFromScore(score, 0, 0);

    const pastedScore = pasteMeasuresIntoScore(score, clip, 2);
    expect(pastedScore.staves[0].measures[2].items).toHaveLength(2);
    // Ensure item IDs are regenerated and distinct
    expect(pastedScore.staves[0].measures[2].items[0].id).not.toBe('it-0-0');
    expect(pastedScore.staves[0].measures[2].items[0].type).toBe('note');
  });

  it('navigates to next and previous notes within a measure', () => {
    const measures = createMockScore().staves[0].measures;

    const nextPos = getNextNavigationPosition(measures, 0, 'it-0-0', 'next');
    expect(nextPos.measureIdx).toBe(0);
    expect(nextPos.itemId).toBe('it-0-1');

    const prevPos = getNextNavigationPosition(measures, 0, 'it-0-1', 'prev');
    expect(prevPos.measureIdx).toBe(0);
    expect(prevPos.itemId).toBe('it-0-0');
  });

  it('crosses measure boundaries seamlessly when navigating', () => {
    const measures = createMockScore().staves[0].measures;

    // From last item of measure 0 to first item of measure 1
    const nextMeasurePos = getNextNavigationPosition(measures, 0, 'it-0-1', 'next');
    expect(nextMeasurePos.measureIdx).toBe(1);
    expect(nextMeasurePos.itemId).toBe('it-1-0');

    // From first item of measure 1 to last item of measure 0
    const prevMeasurePos = getNextNavigationPosition(measures, 1, 'it-1-0', 'prev');
    expect(prevMeasurePos.measureIdx).toBe(0);
    expect(prevMeasurePos.itemId).toBe('it-0-1');
  });
});
