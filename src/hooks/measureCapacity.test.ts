import { describe, it, expect } from 'vitest';
import { canMeasureFitItem } from './useScore';
import { Measure } from '../types/music';
import { getItemBeats } from '../constants/pitches';

describe('canMeasureFitItem Measure Capacity Rules', () => {
  it('allows items that fit into an empty placeholder whole rest measure', () => {
    const emptyMeasure: Measure = {
      id: 'm1',
      items: [{ id: 'r1', type: 'rest', duration: 'w' }],
    };

    // In 4/4 time (maxBeats = 4)
    expect(canMeasureFitItem(emptyMeasure, getItemBeats('w'), 4.0)).toBe(true);
    expect(canMeasureFitItem(emptyMeasure, getItemBeats('h'), 4.0)).toBe(true);
    expect(canMeasureFitItem(emptyMeasure, getItemBeats('q'), 4.0)).toBe(true);

    // In 3/4 time (maxBeats = 3), a whole note (4 beats) must NOT fit
    expect(canMeasureFitItem(emptyMeasure, getItemBeats('w'), 3.0)).toBe(false);
    expect(canMeasureFitItem(emptyMeasure, getItemBeats('h'), 3.0)).toBe(true);
  });

  it('correctly calculates remaining capacity for partially filled measures', () => {
    // Measure with 3 quarter notes (3.0 beats in 4/4 time)
    const measure3Beats: Measure = {
      id: 'm1',
      items: [
        {
          id: 'n1',
          type: 'note',
          pitch: { step: 'C', octave: 4, accidental: null },
          duration: 'q',
        },
        {
          id: 'n2',
          type: 'note',
          pitch: { step: 'D', octave: 4, accidental: null },
          duration: 'q',
        },
        {
          id: 'n3',
          type: 'note',
          pitch: { step: 'E', octave: 4, accidental: null },
          duration: 'q',
        },
      ],
    };

    // Quarter note (1.0 beat) fits: 3.0 + 1.0 = 4.0 <= 4.0
    expect(canMeasureFitItem(measure3Beats, getItemBeats('q'), 4.0)).toBe(true);

    // Eighth note (0.5 beats) fits: 3.0 + 0.5 = 3.5 <= 4.0
    expect(canMeasureFitItem(measure3Beats, getItemBeats('8'), 4.0)).toBe(true);

    // Half note (2.0 beats) does NOT fit: 3.0 + 2.0 = 5.0 > 4.0
    expect(canMeasureFitItem(measure3Beats, getItemBeats('h'), 4.0)).toBe(false);

    // Whole note (4.0 beats) does NOT fit: 3.0 + 4.0 = 7.0 > 4.0
    expect(canMeasureFitItem(measure3Beats, getItemBeats('w'), 4.0)).toBe(false);

    // Dotted quarter note (1.5 beats) does NOT fit: 3.0 + 1.5 = 4.5 > 4.0
    expect(canMeasureFitItem(measure3Beats, getItemBeats('q', true), 4.0)).toBe(false);
  });

  it('rejects all insertions when a measure has reached maximum beat limit', () => {
    // Measure full with a whole note (4.0 beats) in 4/4
    const fullMeasureWhole: Measure = {
      id: 'm1',
      items: [
        {
          id: 'n1',
          type: 'note',
          pitch: { step: 'F', octave: 3, accidental: null },
          duration: 'w',
        },
      ],
    };

    expect(canMeasureFitItem(fullMeasureWhole, getItemBeats('w'), 4.0)).toBe(false);
    expect(canMeasureFitItem(fullMeasureWhole, getItemBeats('h'), 4.0)).toBe(false);
    expect(canMeasureFitItem(fullMeasureWhole, getItemBeats('q'), 4.0)).toBe(false);
    expect(canMeasureFitItem(fullMeasureWhole, getItemBeats('8'), 4.0)).toBe(false);
    expect(canMeasureFitItem(fullMeasureWhole, getItemBeats('16'), 4.0)).toBe(false);

    // Measure full with 4 quarter notes (4.0 beats)
    const fullMeasureQuarters: Measure = {
      id: 'm2',
      items: [
        {
          id: 'n1',
          type: 'note',
          pitch: { step: 'C', octave: 4, accidental: null },
          duration: 'q',
        },
        {
          id: 'n2',
          type: 'note',
          pitch: { step: 'D', octave: 4, accidental: null },
          duration: 'q',
        },
        {
          id: 'n3',
          type: 'note',
          pitch: { step: 'E', octave: 4, accidental: null },
          duration: 'q',
        },
        {
          id: 'n4',
          type: 'note',
          pitch: { step: 'F', octave: 4, accidental: null },
          duration: 'q',
        },
      ],
    };

    expect(canMeasureFitItem(fullMeasureQuarters, getItemBeats('q'), 4.0)).toBe(false);
    expect(canMeasureFitItem(fullMeasureQuarters, getItemBeats('32'), 4.0)).toBe(false);
  });

  it('correctly validates tuplet items capacity', () => {
    // A measure in 4/4 with 3 beats already filled
    const measureWith3Beats: Measure = {
      id: 'm-3b',
      items: [
        {
          id: 'n1',
          type: 'note',
          pitch: { step: 'C', octave: 4, accidental: null },
          duration: 'h',
        }, // 2 beats
        {
          id: 'n2',
          type: 'note',
          pitch: { step: 'D', octave: 4, accidental: null },
          duration: 'q',
        }, // 1 beat
      ],
    };

    const tripletEighthBeats = getItemBeats('8', false, { actual: 3, normal: 2 }); // 1/3 beat

    // One triplet eighth fits in the remaining 1 beat
    expect(canMeasureFitItem(measureWith3Beats, tripletEighthBeats, 4.0)).toBe(true);

    // Measure with 3 quarter notes and 3 triplet eighth notes (3 + 1 = 4 beats)
    const fullMeasureWithTriplets: Measure = {
      id: 'm-full-triplet',
      items: [
        {
          id: 'n1',
          type: 'note',
          pitch: { step: 'C', octave: 4, accidental: null },
          duration: 'h',
        }, // 2
        {
          id: 'n2',
          type: 'note',
          pitch: { step: 'D', octave: 4, accidental: null },
          duration: 'q',
        }, // 1
        {
          id: 't1',
          type: 'note',
          pitch: { step: 'E', octave: 4, accidental: null },
          duration: '8',
          tuplet: { actual: 3, normal: 2 },
        }, // 1/3
        {
          id: 't2',
          type: 'note',
          pitch: { step: 'F', octave: 4, accidental: null },
          duration: '8',
          tuplet: { actual: 3, normal: 2 },
        }, // 1/3
        {
          id: 't3',
          type: 'note',
          pitch: { step: 'G', octave: 4, accidental: null },
          duration: '8',
          tuplet: { actual: 3, normal: 2 },
        }, // 1/3
      ],
    };

    // Total beats is exactly 4.0. Cannot fit any more notes!
    expect(canMeasureFitItem(fullMeasureWithTriplets, tripletEighthBeats, 4.0)).toBe(false);
    expect(canMeasureFitItem(fullMeasureWithTriplets, getItemBeats('16'), 4.0)).toBe(false);
  });

  it('respects pickupBeats limit for anacrusis (compas de anacrusa) measures', () => {
    // An upbeat measure configured for 1.0 beat in a 4/4 meter
    const anacrusis1BeatEmpty: Measure = {
      id: 'm-upbeat-empty',
      isAnacrusis: true,
      pickupBeats: 1.0,
      items: [{ id: 'r1', type: 'rest', duration: 'q' }],
    };

    // Quarter note (1 beat) fits
    expect(canMeasureFitItem(anacrusis1BeatEmpty, getItemBeats('q'), 4.0)).toBe(true);
    // Eighth note (0.5 beats) fits
    expect(canMeasureFitItem(anacrusis1BeatEmpty, getItemBeats('8'), 4.0)).toBe(true);
    // Half note (2.0 beats) exceeds pickupBeats of 1.0 -> rejected even though meter is 4.0
    expect(canMeasureFitItem(anacrusis1BeatEmpty, getItemBeats('h'), 4.0)).toBe(false);

    // An upbeat measure with 1 eighth note inserted (0.5 beats consumed of 1.0 max)
    const anacrusisHalfFilled: Measure = {
      id: 'm-upbeat-half',
      isAnacrusis: true,
      pickupBeats: 1.0,
      items: [
        {
          id: 'n1',
          type: 'note',
          pitch: { step: 'G', octave: 4, accidental: null },
          duration: '8',
        },
      ],
    };

    // Another eighth note (0.5 beats) fits: 0.5 + 0.5 = 1.0 <= 1.0
    expect(canMeasureFitItem(anacrusisHalfFilled, getItemBeats('8'), 4.0)).toBe(true);
    // A sixteenth note (0.25 beats) fits
    expect(canMeasureFitItem(anacrusisHalfFilled, getItemBeats('16'), 4.0)).toBe(true);
    // A quarter note (1.0 beat) does NOT fit: 0.5 + 1.0 = 1.5 > 1.0
    expect(canMeasureFitItem(anacrusisHalfFilled, getItemBeats('q'), 4.0)).toBe(false);
  });

  it('allows inserting notes when a measure contains trailing padding rests', () => {
    // A 4/4 measure with 1 quarter note (1.0 beat) and 3 beats of trailing padding rests
    const paddedMeasure: Measure = {
      id: 'm-pad',
      items: [
        {
          id: 'n1',
          type: 'note',
          duration: 'q',
          pitch: { step: 'C', octave: 4, accidental: null },
        },
        {
          id: 'r-pad1',
          type: 'rest',
          duration: 'h',
          isDotted: true,
        },
      ],
    };

    // Another quarter note fits (1.0 + 1.0 = 2.0 <= 4.0)
    expect(canMeasureFitItem(paddedMeasure, getItemBeats('q'), 4.0)).toBe(true);

    // A half note fits (1.0 + 2.0 = 3.0 <= 4.0)
    expect(canMeasureFitItem(paddedMeasure, getItemBeats('h'), 4.0)).toBe(true);

    // A whole note does NOT fit (1.0 + 4.0 = 5.0 > 4.0)
    expect(canMeasureFitItem(paddedMeasure, getItemBeats('w'), 4.0)).toBe(false);
  });

  it('independently tracks capacity for voice 1 and voice 2 in polyphonic measures', () => {
    // Measure where Voice 1 has 4 quarter notes (full: 4 beats)
    // and Voice 2 has only 1 quarter note (1 beat)
    const polyMeasure: Measure = {
      id: 'm-poly',
      items: [
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
        {
          id: 'v1-3',
          type: 'note',
          duration: 'q',
          voice: 1,
          pitch: { step: 'E', octave: 5, accidental: null },
        },
        {
          id: 'v1-4',
          type: 'note',
          duration: 'q',
          voice: 1,
          pitch: { step: 'F', octave: 5, accidental: null },
        },
        {
          id: 'v2-1',
          type: 'note',
          duration: 'q',
          voice: 2,
          pitch: { step: 'C', octave: 4, accidental: null },
        },
      ],
    };

    // Voice 1 is full (4.0/4.0), no notes should fit in Voice 1
    expect(canMeasureFitItem(polyMeasure, getItemBeats('q'), 4.0, 1)).toBe(false);
    expect(canMeasureFitItem(polyMeasure, getItemBeats('8'), 4.0, 1)).toBe(false);

    // Voice 2 has only 1.0 beat, so quarter note, half note, and dotted half note fit in Voice 2
    expect(canMeasureFitItem(polyMeasure, getItemBeats('q'), 4.0, 2)).toBe(true);
    expect(canMeasureFitItem(polyMeasure, getItemBeats('h'), 4.0, 2)).toBe(true);
    expect(canMeasureFitItem(polyMeasure, getItemBeats('h', true), 4.0, 2)).toBe(true);
    // Whole note (4.0 beats) does NOT fit in Voice 2 (1.0 + 4.0 = 5.0 > 4.0)
    expect(canMeasureFitItem(polyMeasure, getItemBeats('w'), 4.0, 2)).toBe(false);
  });

  it('allows inserting Voice 2 notes into a measure whose Voice 1 is already at full capacity', () => {
    // Measure containing only Voice 1 notes, fully filling 4/4 meter
    const fullVoice1Measure: Measure = {
      id: 'm-v1-full',
      items: [
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
        {
          id: 'v1-3',
          type: 'note',
          duration: 'q',
          voice: 1,
          pitch: { step: 'E', octave: 5, accidental: null },
        },
        {
          id: 'v1-4',
          type: 'note',
          duration: 'q',
          voice: 1,
          pitch: { step: 'F', octave: 5, accidental: null },
        },
      ],
    };

    // Voice 1 cannot accept more notes
    expect(canMeasureFitItem(fullVoice1Measure, getItemBeats('q'), 4.0, 1)).toBe(false);

    // Voice 2 (which currently has 0 beats occupied) must accept notes up to 4.0 beats
    expect(canMeasureFitItem(fullVoice1Measure, getItemBeats('w'), 4.0, 2)).toBe(true);
    expect(canMeasureFitItem(fullVoice1Measure, getItemBeats('h'), 4.0, 2)).toBe(true);
    expect(canMeasureFitItem(fullVoice1Measure, getItemBeats('q'), 4.0, 2)).toBe(true);
  });
});
