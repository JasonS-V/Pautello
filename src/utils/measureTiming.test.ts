import { describe, it, expect } from 'vitest';
import { Measure, Score, ScoreItem } from '../types/music';
import {
  beatsFromTimeSignature,
  getMeasureCapacityBeats,
  getMeasureTimings,
  resolveMeasureCapacity,
  decomposeDurationIntoCanonicalRests,
  padMeasureWithCanonicalRests,
  getMeasureItemStreamTimings,
} from './measureTiming';

const emptyMeasure = (overrides: Partial<Measure> = {}): Measure => ({
  id: `m-${Math.random().toString(36).slice(2, 7)}`,
  items: [{ id: 'r', type: 'rest', duration: 'w' }],
  ...overrides,
});

const scoreWith = (measures: Measure[]): Score => ({
  id: 'score-1',
  title: 'Prueba',
  composer: 'Anónimo',
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  keySignature: 'C',
  staves: [{ id: 'staff-1', name: 'Voz', clef: 'treble', measures }],
  createdAt: 0,
  updatedAt: 0,
});

describe('beatsFromTimeSignature', () => {
  it('convierte la métrica a negras', () => {
    expect(beatsFromTimeSignature({ beats: 4, beatType: 4 })).toBe(4);
    expect(beatsFromTimeSignature({ beats: 3, beatType: 4 })).toBe(3);
    expect(beatsFromTimeSignature({ beats: 6, beatType: 8 })).toBe(3);
    expect(beatsFromTimeSignature({ beats: 12, beatType: 8 })).toBe(6);
    expect(beatsFromTimeSignature({ beats: 2, beatType: 2 })).toBe(4);
  });

  it('cae en 4/4 ante una métrica imposible', () => {
    expect(beatsFromTimeSignature({ beats: 0, beatType: 4 })).toBe(4);
    expect(beatsFromTimeSignature({ beats: 4, beatType: 0 })).toBe(4);
    expect(beatsFromTimeSignature({ beats: Number.NaN, beatType: 4 })).toBe(4);
  });
});

describe('getMeasureTimings: cambios heredados', () => {
  it('usa los valores globales cuando no hay cambios locales', () => {
    const score = scoreWith([emptyMeasure(), emptyMeasure()]);
    const timings = getMeasureTimings(score);

    expect(timings).toHaveLength(2);
    timings.forEach((timing) => {
      expect(timing.timeSignature).toEqual({ beats: 4, beatType: 4 });
      expect(timing.beatsPerMeasure).toBe(4);
      expect(timing.tempo).toBe(120);
      expect(timing.keySignature).toBe('C');
    });
  });

  it('un cambio de compás manda desde su compás hasta el final', () => {
    const score = scoreWith([
      emptyMeasure(),
      emptyMeasure({ timeSignatureChange: { beats: 3, beatType: 4 } }),
      emptyMeasure(),
    ]);
    const timings = getMeasureTimings(score);

    expect(timings[0].beatsPerMeasure).toBe(4);
    expect(timings[1].beatsPerMeasure).toBe(3);
    expect(timings[2].beatsPerMeasure).toBe(3);
    expect(timings[2].timeSignature).toEqual({ beats: 3, beatType: 4 });
  });

  it('un segundo cambio sustituye al anterior', () => {
    const score = scoreWith([
      emptyMeasure({ timeSignatureChange: { beats: 3, beatType: 4 } }),
      emptyMeasure(),
      emptyMeasure({ timeSignatureChange: { beats: 2, beatType: 4 } }),
      emptyMeasure(),
    ]);
    const timings = getMeasureTimings(score);

    expect(timings.map((t) => t.beatsPerMeasure)).toEqual([3, 3, 2, 2]);
    expect(timings[3].timeSignature).toEqual({ beats: 2, beatType: 4 });
  });

  it('hereda el tempo local sin tocar los compases anteriores', () => {
    const score = scoreWith([emptyMeasure(), emptyMeasure({ tempoBpm: 60 }), emptyMeasure()]);
    const timings = getMeasureTimings(score);

    expect(timings.map((t) => t.tempo)).toEqual([120, 60, 60]);
  });

  it('hereda la tonalidad local', () => {
    const score = scoreWith([
      emptyMeasure(),
      emptyMeasure({ keySignatureChange: 'Bb' }),
      emptyMeasure(),
    ]);
    const timings = getMeasureTimings(score);

    expect(timings.map((t) => t.keySignature)).toEqual(['C', 'Bb', 'Bb']);
  });

  it('combina los tres cambios en el mismo punto', () => {
    const score = scoreWith([
      emptyMeasure({
        tempoBpm: 90,
        timeSignatureChange: { beats: 3, beatType: 4 },
        keySignatureChange: 'F',
      }),
      emptyMeasure(),
    ]);
    const [first, second] = getMeasureTimings(score);

    expect(first).toEqual({
      timeSignature: { beats: 3, beatType: 4 },
      beatsPerMeasure: 3,
      tempo: 90,
      keySignature: 'F',
    });
    expect(second).toEqual(first);
  });

  it('ignora un tempo local no positivo y sigue heredando el anterior', () => {
    const score = scoreWith([emptyMeasure({ tempoBpm: 90 }), emptyMeasure({ tempoBpm: 0 })]);
    expect(getMeasureTimings(score)[1].tempo).toBe(90);
  });

  it('devuelve una lista vacía si la partitura no tiene compases', () => {
    expect(getMeasureTimings(scoreWith([]))).toEqual([]);
  });
});

describe('getMeasureCapacityBeats', () => {
  it('resuelve la capacidad del compás indicado', () => {
    const score = scoreWith([
      emptyMeasure(),
      emptyMeasure({ timeSignatureChange: { beats: 6, beatType: 8 } }),
    ]);

    expect(getMeasureCapacityBeats(score, 0)).toBe(4);
    expect(getMeasureCapacityBeats(score, 1)).toBe(3);
    // Un compás nuevo al final hereda la métrica vigente, no la inicial.
    expect(getMeasureCapacityBeats(score, 2)).toBe(3);
  });

  it('cae en la métrica global si el compás no existe', () => {
    const score = scoreWith([]);
    expect(getMeasureCapacityBeats(score, 5)).toBe(4);
  });
});

describe('resolveMeasureCapacity', () => {
  it('la anacrusis manda sobre el cambio local', () => {
    const pickup = emptyMeasure({
      isAnacrusis: true,
      pickupBeats: 1,
      timeSignatureChange: { beats: 3, beatType: 4 },
    });
    const score = scoreWith([pickup, emptyMeasure()]);

    expect(resolveMeasureCapacity(score, pickup, 0)).toBe(1);
  });

  it('usa el cambio local cuando no es anacrusis', () => {
    const measure = emptyMeasure({ timeSignatureChange: { beats: 3, beatType: 4 } });
    const score = scoreWith([emptyMeasure(), measure]);

    expect(resolveMeasureCapacity(score, measure, 1)).toBe(3);
  });

  it('usa la métrica global cuando no hay cambio local', () => {
    const measure = emptyMeasure();
    const score = scoreWith([measure]);

    expect(resolveMeasureCapacity(score, measure, 0)).toBe(4);
  });
});

describe('Canonical Rest Padding (decomposeDurationIntoCanonicalRests & padMeasureWithCanonicalRests)', () => {
  it('decomposes durations into canonical rests correctly', () => {
    // 4.0 beats -> whole rest (w)
    const rests4 = decomposeDurationIntoCanonicalRests(4.0);
    expect(rests4).toHaveLength(1);
    expect(rests4[0].duration).toBe('w');

    // 3.0 beats -> dotted half rest (h.)
    const rests3 = decomposeDurationIntoCanonicalRests(3.0);
    expect(rests3).toHaveLength(1);
    expect(rests3[0].duration).toBe('h');
    expect(rests3[0].isDotted).toBe(true);

    // 2.0 beats -> half rest (h)
    const rests2 = decomposeDurationIntoCanonicalRests(2.0);
    expect(rests2).toHaveLength(1);
    expect(rests2[0].duration).toBe('h');

    // 1.5 beats -> dotted quarter rest (q.)
    const rests1_5 = decomposeDurationIntoCanonicalRests(1.5);
    expect(rests1_5).toHaveLength(1);
    expect(rests1_5[0].duration).toBe('q');
    expect(rests1_5[0].isDotted).toBe(true);

    // 1.0 beat -> quarter rest (q)
    const rests1 = decomposeDurationIntoCanonicalRests(1.0);
    expect(rests1).toHaveLength(1);
    expect(rests1[0].duration).toBe('q');

    // 0.5 beats -> eighth rest (8)
    const rests0_5 = decomposeDurationIntoCanonicalRests(0.5);
    expect(rests0_5).toHaveLength(1);
    expect(rests0_5[0].duration).toBe('8');

    // 0.25 beats -> 16th rest (16)
    const rests0_25 = decomposeDurationIntoCanonicalRests(0.25);
    expect(rests0_25).toHaveLength(1);
    expect(rests0_25[0].duration).toBe('16');

    // Combined fractional duration: 3.5 beats -> h. (3.0) + 8 (0.5)
    const rests3_5 = decomposeDurationIntoCanonicalRests(3.5);
    expect(rests3_5).toHaveLength(2);
    expect(rests3_5[0].duration).toBe('h');
    expect(rests3_5[0].isDotted).toBe(true);
    expect(rests3_5[1].duration).toBe('8');
  });

  it('pads single voice measure with canonical rests to match exact measure capacity', () => {
    // 1 quarter note in a 4/4 measure (1.0 beat of 4.0 beats)
    const measure: Measure = {
      id: 'm-test',
      items: [
        {
          id: 'n1',
          type: 'note',
          duration: 'q',
          pitch: { step: 'C', octave: 4, accidental: null },
        },
      ],
    };

    const padded = padMeasureWithCanonicalRests(measure, 4.0);
    // 1 quarter note + 3 remaining beats (h. 3 beats or h + q)
    expect(padded.items[0].type).toBe('note');
    expect(padded.items.length).toBeGreaterThan(1);

    // Sum of all items in padded measure must equal 4.0 exactly
    const sum = padded.items.reduce((s, it) => {
      const durMap: Record<string, number> = {
        w: 4,
        h: 2,
        q: 1,
        '8': 0.5,
        '16': 0.25,
        '32': 0.125,
      };
      return s + (durMap[it.duration] || 1) * (it.isDotted ? 1.5 : 1);
    }, 0);
    expect(sum).toBe(4.0);
  });

  it('pads both voice 1 and voice 2 independently in a polyphonic measure', () => {
    const polyMeasure: Measure = {
      id: 'm-poly',
      items: [
        // Voice 1: 1 half note (2 beats)
        {
          id: 'v1-n1',
          type: 'note',
          duration: 'h',
          voice: 1,
          pitch: { step: 'E', octave: 5, accidental: null },
        },
        // Voice 2: 1 quarter note (1 beat)
        {
          id: 'v2-n1',
          type: 'note',
          duration: 'q',
          voice: 2,
          pitch: { step: 'C', octave: 4, accidental: null },
        },
      ],
    };

    const padded = padMeasureWithCanonicalRests(polyMeasure, 4.0);

    const v1Items = padded.items.filter((it) => it.voice !== 2);
    const v2Items = padded.items.filter((it) => it.voice === 2);

    const durOf = (it: { duration: string; isDotted?: boolean }) => {
      const durMap: Record<string, number> = {
        w: 4,
        h: 2,
        q: 1,
        '8': 0.5,
        '16': 0.25,
        '32': 0.125,
      };
      return (durMap[it.duration] || 1) * (it.isDotted ? 1.5 : 1);
    };

    const v1Sum = v1Items.reduce((s, it) => s + durOf(it), 0);
    const v2Sum = v2Items.reduce((s, it) => s + durOf(it), 0);

    expect(v1Sum).toBe(4.0);
    expect(v2Sum).toBe(4.0);
  });
});

describe('getMeasureItemStreamTimings: polyphonic voice streams', () => {
  it('calculates startBeat independently for voice 1 and voice 2', () => {
    const items: ScoreItem[] = [
      // Voice 1: two quarter notes (beats 0 and 1)
      {
        id: 'v1-1',
        type: 'note',
        duration: 'q',
        voice: 1,
        pitch: { step: 'C', octave: 5, accidental: null },
      },
      {
        id: 'v1-2',
        type: 'note',
        duration: 'q',
        voice: 1,
        pitch: { step: 'D', octave: 5, accidental: null },
      },
      // Voice 2: one half note (starts at beat 0, duration 2)
      {
        id: 'v2-1',
        type: 'note',
        duration: 'h',
        voice: 2,
        pitch: { step: 'C', octave: 4, accidental: null },
      },
    ];

    const timings = getMeasureItemStreamTimings(items, 4.0);
    expect(timings).toHaveLength(3);

    // Voice 1 item 0: startBeat 0, dur 1
    expect(timings[0].startBeat).toBe(0);
    expect(timings[0].durationBeats).toBe(1);

    // Voice 1 item 1: startBeat 1, dur 1
    expect(timings[1].startBeat).toBe(1);
    expect(timings[1].durationBeats).toBe(1);

    // Voice 2 item: startBeat 0 (parallel to voice 1 item 0!), dur 2
    expect(timings[2].startBeat).toBe(0);
    expect(timings[2].durationBeats).toBe(2);
  });
});
