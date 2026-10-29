import { describe, expect, it } from 'vitest';
import { Score } from '../types/music';
import { buildPlaybackPlan, collectPerformedNotes } from './playbackPlan';

function score(marks: Record<number, object> = {}): Score {
  return {
    id: 's',
    title: 'Test',
    composer: 'Test',
    tempo: 120,
    timeSignature: { beats: 3, beatType: 4 },
    keySignature: 'C',
    createdAt: 0,
    updatedAt: 0,
    staves: [
      {
        id: 'p',
        name: 'Part',
        clef: 'bass',
        measures: Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, items: [], ...marks[i] })),
      },
    ],
  };
}

describe('buildPlaybackPlan', () => {
  it('resolves repeats, a D.S. al Coda, local tempo and meter at every visit', () => {
    const result = buildPlaybackPlan(
      score({
        0: { repeatStart: true },
        1: { repeatEnd: true },
        2: { navigationMark: 'segno', tempoBpm: 90, keySignatureChange: 'G' },
        3: { navigationMark: 'toCoda', timeSignatureChange: { beats: 4, beatType: 4 } },
        4: {
          navigationMark: 'dalSegnoAlCoda',
          navigationTargetMeasureId: 'm2',
          navigationExitMeasureId: 'm3',
        },
        5: { navigationMark: 'coda' },
      })
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.visits.map((v) => v.measureIndex)).toEqual([0, 1, 0, 1, 2, 3, 4, 2, 3, 5]);
    expect(result.visits.map((v) => v.tempo)).toEqual([120, 120, 120, 120, 90, 90, 90, 90, 90, 90]);
    expect(result.visits[7].keySignature).toBe('G');
    expect(result.visits[5].durationSeconds).toBeCloseTo((4 * 60) / 90);
  });

  it('diagnoses a missing segno without inventing a jump', () => {
    const result = buildPlaybackPlan(score({ 2: { navigationMark: 'dalSegno' } }));
    expect(result.visits.map((v) => v.measureIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.diagnostics).toContain('Compás 3: destino segno ausente o ambiguo');
  });

  it('plays first and second endings on their respective passes', () => {
    const result = buildPlaybackPlan(
      score({
        0: { repeatStart: true },
        2: { volta: '1.' },
        3: { repeatEnd: true },
        4: { volta: '2.' },
      })
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.visits.map((visit) => visit.measureIndex)).toEqual([0, 1, 2, 3, 0, 1, 4, 5]);
  });

  it('rejects an explicit destination that has the wrong mark', () => {
    const result = buildPlaybackPlan(
      score({ 2: { navigationMark: 'dalSegno', navigationTargetMeasureId: 'm0' } })
    );
    expect(result.visits.map((visit) => visit.measureIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.diagnostics).toContain('Compás 3: destino segno ausente o ambiguo');
  });

  it('joins a tie across a tempo change without a second attack', () => {
    const input = score({ 1: { tempoBpm: 60 } });
    input.staves[0].measures[0].items = [
      {
        id: 'a',
        type: 'note',
        duration: 'h',
        isDotted: true,
        isTied: true,
        pitch: { step: 'C', octave: 4, accidental: null },
      },
    ];
    input.staves[0].measures[1].items = [
      { id: 'b', type: 'note', duration: 'q', pitch: { step: 'C', octave: 4, accidental: null } },
    ];
    const notes = collectPerformedNotes(input, buildPlaybackPlan(input));
    expect(notes).toHaveLength(1);
    expect(notes[0].startSeconds).toBe(0);
    expect(notes[0].endSeconds).toBe(2.5);
  });
});
