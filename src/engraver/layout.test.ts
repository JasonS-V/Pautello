import { describe, it, expect } from 'vitest';
import {
  computeSystems,
  computePages,
  calculateMeasureWeight,
  computeOpticalMeasureWidths,
} from './layout';
import { Measure } from '../types/music';

function createMockMeasures(
  count: number,
  configs: Partial<Record<number, Partial<Measure>>> = {}
): Measure[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m-${i}`,
    items: [],
    ...(configs[i] || {}),
  }));
}

describe('computeSystems', () => {
  it('groups measures into systems by default measure count', () => {
    const measures = createMockMeasures(7);
    const systems = computeSystems(measures, 3);
    expect(systems).toHaveLength(3);
    expect(systems[0].measureIndices).toEqual([0, 1, 2]);
    expect(systems[1].measureIndices).toEqual([3, 4, 5]);
    expect(systems[2].measureIndices).toEqual([6]);
  });

  it('respects explicit systemBreak', () => {
    const measures = createMockMeasures(6, {
      1: { systemBreak: true }, // measure 1 forces break
    });
    const systems = computeSystems(measures, 4);
    expect(systems).toHaveLength(2);
    expect(systems[0].measureIndices).toEqual([0, 1]);
    expect(systems[1].measureIndices).toEqual([2, 3, 4, 5]);
  });

  it('respects explicit pageBreak and marks hasPageBreakAfter', () => {
    const measures = createMockMeasures(5, {
      1: { pageBreak: true },
    });
    const systems = computeSystems(measures, 3);
    expect(systems).toHaveLength(2);
    expect(systems[0].measureIndices).toEqual([0, 1]);
    expect(systems[0].hasPageBreakAfter).toBe(true);
    expect(systems[1].measureIndices).toEqual([2, 3, 4]);
    expect(systems[1].hasPageBreakAfter).toBe(false);
  });

  it('handles empty measures gracefully', () => {
    const systems = computeSystems([], 3);
    expect(systems).toEqual([]);
  });
});

describe('computePages', () => {
  it('distributes systems across pages based on height budget', () => {
    const measures = createMockMeasures(12);
    const systems = computeSystems(measures, 2); // 6 systems
    // systemHeight = 180, systemGap = 40, pageHeight = 600, firstPageTopMargin = 100, pageTopMargin = 50, pageBottomMargin = 50
    // Page 0 available = 600 - 100 - 50 = 450. Fits: 180 + (180 + 40) = 400. Next system would need 400 + 220 = 620 > 450.
    // So Page 0 gets 2 systems. Page 1 available = 600 - 50 - 50 = 500. Fits: 180 + 220 = 400.
    const pages = computePages(systems, 180, {
      pageHeight: 600,
      firstPageTopMargin: 100,
      pageTopMargin: 50,
      pageBottomMargin: 50,
      systemGap: 40,
    });

    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].systems).toHaveLength(2);
  });

  it('splits page immediately on hasPageBreakAfter', () => {
    const measures = createMockMeasures(6, {
      0: { pageBreak: true },
    });
    const systems = computeSystems(measures, 3); // 2 systems, system 0 has pageBreakAfter
    const pages = computePages(systems, 100, {
      pageHeight: 1200, // Plenty of room for both systems on 1 page
    });

    expect(pages).toHaveLength(2);
    expect(pages[0].systems).toHaveLength(1);
    expect(pages[0].systems[0].measureIndices).toEqual([0]);
    expect(pages[1].systems).toHaveLength(2);
    expect(pages[1].systems[0].measureIndices).toEqual([1, 2, 3]);
    expect(pages[1].systems[1].measureIndices).toEqual([4, 5]);
  });
});

describe('Optical Measure Spacing (calculateMeasureWeight & computeOpticalMeasureWidths)', () => {
  it('gives empty measures or placeholder rests minimum base weight', () => {
    const emptyMeasure: Measure = { id: 'm1', items: [] };
    const wholeRestMeasure: Measure = {
      id: 'm2',
      items: [{ id: 'r1', type: 'rest', duration: 'w' }],
    };
    expect(calculateMeasureWeight(emptyMeasure)).toBe(1.0);
    expect(calculateMeasureWeight(wholeRestMeasure)).toBe(1.0);
  });

  it('assigns higher weight to measures with fast notes, accidentals, and lyrics', () => {
    const simpleMeasure: Measure = {
      id: 'm-simple',
      items: [
        {
          id: 'n1',
          type: 'note',
          duration: 'q',
          pitch: { step: 'C', octave: 4, accidental: null },
        },
        {
          id: 'n2',
          type: 'note',
          duration: 'q',
          pitch: { step: 'D', octave: 4, accidental: null },
        },
      ],
    };

    const complexMeasure: Measure = {
      id: 'm-complex',
      items: [
        {
          id: 'n1',
          type: 'note',
          duration: '16',
          pitch: { step: 'C', octave: 4, accidental: '#' },
          lyric: 'glo-',
        },
        {
          id: 'n2',
          type: 'note',
          duration: '16',
          pitch: { step: 'D', octave: 4, accidental: null },
          lyric: 'ri-',
        },
        {
          id: 'n3',
          type: 'note',
          duration: '16',
          pitch: { step: 'E', octave: 4, accidental: 'b' },
          lyric: 'a',
        },
        {
          id: 'n4',
          type: 'note',
          duration: '16',
          pitch: { step: 'F', octave: 4, accidental: null },
        },
      ],
    };

    const weightSimple = calculateMeasureWeight(simpleMeasure);
    const weightComplex = calculateMeasureWeight(complexMeasure);

    expect(weightComplex).toBeGreaterThan(weightSimple * 1.8);
  });

  it('distributes totalAvailableWidth exactly with proportional widths and min widths', () => {
    const mEmpty: Measure = { id: 'm-empty', items: [{ id: 'r1', type: 'rest', duration: 'w' }] };
    const mDense: Measure = {
      id: 'm-dense',
      items: Array.from({ length: 8 }, (_, i) => ({
        id: `n-${i}`,
        type: 'note' as const,
        duration: '16' as const,
        pitch: { step: 'C' as const, octave: 4, accidental: '#' as const },
        lyric: 'la',
      })),
    };
    const mMedium: Measure = {
      id: 'm-med',
      items: [
        {
          id: 'n1',
          type: 'note',
          duration: 'q',
          pitch: { step: 'C', octave: 4, accidental: null },
        },
        {
          id: 'n2',
          type: 'note',
          duration: 'q',
          pitch: { step: 'D', octave: 4, accidental: null },
        },
        {
          id: 'n3',
          type: 'note',
          duration: 'q',
          pitch: { step: 'E', octave: 4, accidental: null },
        },
        {
          id: 'n4',
          type: 'note',
          duration: 'q',
          pitch: { step: 'F', octave: 4, accidental: null },
        },
      ],
    };

    const totalWidth = 656; // 776 systemWidth - 120 headerWidth
    const result = computeOpticalMeasureWidths([mEmpty, mDense, mMedium], totalWidth, 75);

    // Sum of widths must strictly equal totalWidth
    const sumWidths = result.widths.reduce((a, b) => a + b, 0);
    expect(sumWidths).toBe(totalWidth);

    // All widths must be >= minMeasureWidth (75px)
    result.widths.forEach((w) => {
      expect(w).toBeGreaterThanOrEqual(75);
    });

    // Dense measure must receive significantly more width than empty measure
    expect(result.widths[1]).toBeGreaterThan(result.widths[0] * 2);

    // xOffsets must start at 0 and be strictly monotonically increasing
    expect(result.xOffsets[0]).toBe(0);
    expect(result.xOffsets[1]).toBe(result.widths[0]);
    expect(result.xOffsets[2]).toBe(result.widths[0] + result.widths[1]);
  });

  it('handles single measure system by allocating 100% of available width', () => {
    const singleMeasure: Measure = { id: 'm1', items: [] };
    const result = computeOpticalMeasureWidths([singleMeasure], 700, 75);
    expect(result.widths).toEqual([700]);
    expect(result.xOffsets).toEqual([0]);
  });
});
