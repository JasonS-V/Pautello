import { describe, expect, it } from 'vitest';
import type { Score } from '../../types/music';
import type { OmrScoreIR } from '../omrDecode';
import {
  applyOmrIndications,
  linkOmrNavigationTargets,
  planOmrIndications,
} from '../omrIndicationMapping';

const score: Score = {
  id: 's',
  title: 'Test',
  composer: 'A',
  tempo: 120,
  timeSignature: { beats: 3, beatType: 4 },
  keySignature: 'C',
  staves: [
    {
      id: 'st',
      name: 'Bajo',
      clef: 'bass',
      measures: [
        {
          id: 'm1',
          items: [
            {
              id: 'n1',
              type: 'note',
              pitch: { step: 'C', octave: 3, accidental: null },
              duration: 'q',
            },
          ],
        },
        { id: 'm2', items: [{ id: 'r2', type: 'rest', duration: 'q' }] },
      ],
    },
  ],
  createdAt: 1,
  updatedAt: 1,
};
const src = (x: number) => ({
  page: 1,
  system: 0,
  staff: 0,
  bbox: [x, 10, 10, 10] as [number, number, number, number],
});
const ir: OmrScoreIR = {
  irVersion: 'test',
  structure: { recognized: { stavesPerSystem: 1, clefs: ['F4'], keyFifths: 0, time: null } },
  parts: [
    {
      index: 0,
      label: 'Bajo',
      measures: [
        {
          index: 0,
          page: 1,
          system: 0,
          events: [
            {
              kind: 'note',
              pitch: { step: 'C', octave: 3, alter: 0 },
              duration: { base: '4', dots: 0, divisions: 1 },
              confidence: 1,
              src: src(20),
              tokens: [],
            },
          ],
        },
        {
          index: 1,
          page: 1,
          system: 0,
          events: [
            {
              kind: 'rest',
              duration: { base: '4', dots: 0, divisions: 1 },
              confidence: 1,
              src: src(100),
              tokens: [],
            },
          ],
        },
      ],
    },
  ],
  warnings: [],
  indications: [
    {
      id: 'tempo1',
      kind: 'tempo',
      status: 'recognized',
      confidence: 1,
      src: src(20),
      anchor: { system: 0, measureNumber: 1, x: 20 },
      tempo: { beatUnit: 'h', dots: 0, perMinute: 60, quarterBpm: 120 },
    },
    {
      id: 'meter2',
      kind: 'meter',
      status: 'recognized',
      confidence: 1,
      src: src(100),
      anchor: { system: 0, measureNumber: 2, x: 100 },
      meter: { beats: 4, beatType: 4, glyph: 'common' },
    },
    {
      id: 'fermata2',
      kind: 'fermata',
      status: 'recognized',
      confidence: 1,
      src: src(100),
      anchor: { system: 0, measureNumber: 2, x: 100 },
      target: { kind: 'rest', bbox: [100, 10, 10, 10] },
    },
    {
      id: 'unknown',
      kind: 'rehearsal',
      status: 'pending',
      confidence: 0.4,
      src: src(100),
      anchor: { system: 0, measureNumber: null, x: 100 },
      text: 'B',
    },
  ],
};

describe('indications to editable score', () => {
  it('maps exact anchors, keeps pending text out, and preserves the source score', () => {
    const proposals = planOmrIndications(ir, score);
    expect(proposals.map((p) => [p.id, p.status])).toEqual([
      ['tempo1', 'exact'],
      ['meter2', 'exact'],
      ['fermata2', 'exact'],
      ['unknown', 'pending'],
    ]);
    const mapped = applyOmrIndications(score, ir, proposals);
    expect(mapped.metronomeMark).toEqual({ beatUnit: 'h', dots: 0, perMinute: 60 });
    expect(mapped.staves[0].measures[1]).toMatchObject({
      timeSignatureChange: { beats: 4, beatType: 4 },
      meterGlyph: 'common',
      items: [{ articulation: 'fermata' }],
    });
    expect(mapped.staves[0].measures[1].rehearsalMark).toBeUndefined();
    expect(score.staves[0].measures[1].items[0].articulation).toBeUndefined();
  });

  it('requires approval when a printed number conflicts with IR indexing', () => {
    const conflicted = structuredClone(ir);
    conflicted.indications![1].anchor!.measureNumber = 20;
    const proposals = planOmrIndications(conflicted, score);
    expect(proposals[1].status).toBe('suggested');
    expect(
      applyOmrIndications(score, conflicted, proposals).staves[0].measures[1].meterGlyph
    ).toBeUndefined();
    expect(
      applyOmrIndications(score, conflicted, proposals, ['meter2']).staves[0].measures[1].meterGlyph
    ).toBe('common');
  });

  it('links a navigation destination when its suggested anchor is accepted later', () => {
    const navigation = structuredClone(ir);
    navigation.indications = [
      {
        id: 'segno',
        kind: 'navigation',
        navigation: 'segno',
        status: 'recognized',
        confidence: 1,
        src: src(20),
        anchor: { system: 0, measureNumber: 1, x: 20 },
      },
      {
        id: 'ds',
        kind: 'navigation',
        navigation: 'dalSegnoAlCoda',
        targetId: 'segno',
        status: 'recognized',
        confidence: 1,
        src: src(100),
        anchor: { system: 0, measureNumber: 20, x: 100 },
      },
    ];
    const plans = planOmrIndications(navigation, score);
    const first = applyOmrIndications(score, navigation, plans);
    const accepted = applyOmrIndications(
      first,
      navigation,
      plans.filter((p) => p.id === 'ds'),
      ['ds']
    );
    linkOmrNavigationTargets(accepted, navigation, plans, ['ds']);
    expect(accepted.staves[0].measures[1]).toMatchObject({
      navigationMark: 'dalSegnoAlCoda',
      navigationTargetMeasureId: 'm1',
    });
  });
});
