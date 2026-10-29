import { describe, expect, it } from 'vitest';
import { decodeLine } from '../omrDecode';
import { decodeBeam } from '../omrBeam';
import { inspectNotation, withNotationEvidence } from '../omrNotationGeometry';

describe('bounded CTC experiment', () => {
  it('sums paths that collapse to the same token instead of taking the best frame', () => {
    const logits = Float32Array.from([0.4, 0.35, 0.25, 0.4, 0.35, 0.25].map(Math.log));
    expect(decodeLine(logits, 2, 3, { 1: '=', 2: '==' })).toEqual([]);
    expect(decodeBeam(logits, 2, 3, { 1: '=', 2: '==' }).events.map((e) => e.token)).toEqual(['=']);
  });
  it('preserves repeated tokens separated by a blank and bounds the search', () => {
    const logits = Float32Array.from([-8, 8, 8, -8, -8, 8]);
    const result = decodeBeam(logits, 3, 2, { 1: '=' }, { width: 2, topK: 2 });
    expect(result.events.map((e) => e.token)).toEqual(['=', '=']);
    expect(result.peakPrefixes).toBeLessThanOrEqual(2);
    expect(() => decodeBeam(logits, 3, 2, { 1: '=' }, { width: 0 })).toThrow();
  });
  it('agrees with exhaustive enumeration of all CTC paths on a small tensor', () => {
    const probabilities = [
      [0.3, 0.45, 0.25],
      [0.2, 0.3, 0.5],
      [0.4, 0.35, 0.25],
    ];
    const totals = new Map<string, number>();
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 3; c++) {
          const ids = [a, b, c].filter((v, i, ids) => v && (!i || v !== ids[i - 1]));
          const key = ids.join(',');
          totals.set(
            key,
            (totals.get(key) ?? 0) + probabilities[0][a] * probabilities[1][b] * probabilities[2][c]
          );
        }
    const winner = [...totals]
      .sort((a, b) => b[1] - a[1])[0][0]
      .split(',')
      .map(Number);
    const result = decodeBeam(
      Float32Array.from(probabilities.flat().map(Math.log)),
      3,
      3,
      { 1: '=', 2: '==' },
      { width: 32 }
    );
    expect(result.events.map((e) => e.token)).toEqual(
      winner.map((i) => ({ 1: '=', 2: '==' })[i as 1 | 2])
    );
  });
  it('uses a soft grammar cost without forcing a complete measure', () => {
    const vocab = { 1: '4', 2: 'c', 3: 'bad', 4: '<b>' };
    const logits = Float32Array.from([
      -9,
      6,
      -9,
      -9,
      -9,
      -9,
      -9,
      Math.log(0.49),
      Math.log(0.51),
      -9,
      -9,
      -9,
      -9,
      -9,
      6,
    ]);
    expect(decodeLine(logits, 3, 5, vocab).map((e) => e.token)).toEqual(['4', 'bad', '<b>']);
    expect(
      decodeBeam(logits, 3, 5, vocab, { grammarPenalty: 2 }).events.map((e) => e.token)
    ).toEqual(['4', 'c', '<b>']);
    expect(decodeBeam(logits.subarray(0, 10), 2, 5, vocab).events).toHaveLength(2);
  });
});

describe('visual notation evidence', () => {
  const image = () => new Float32Array(200 * 128);
  const vertical = (data: Float32Array, x: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) data[y * 200 + x] = 1;
  };
  it('distinguishes a full staff bar from a short stem and keeps disagreements', () => {
    const data = image();
    vertical(data, 150, 44, 84);
    vertical(data, 80, 49, 79);
    const result = inspectNotation(data, 200, 128, 10, []);
    expect(result.bars.map((b) => b.x)).toEqual([150]);
    expect(result.disagreements).toContainEqual(expect.objectContaining({ kind: 'missing-bar' }));
  });
  it('does not add a dot or change an event to fill the measure', () => {
    const data = image();
    data[61 * 200 + 100] = 1;
    const result = inspectNotation(data, 200, 128, 10, [
      {
        kind: 'note',
        confidence: 0.5,
        duration: { base: '4', dots: 0, divisions: 48 },
        pitch: { step: 'B', octave: 4, alter: 0 },
        src: { page: 1, system: 0, staff: 0, bbox: [85, 0, 30, 128], normalizedRange: [85, 115] },
      },
    ]);
    expect(result.alternatives.every((a) => a.status === 'unresolved' || a.dots === 0)).toBe(true);
  });

  it.each([false, true])('checks notehead ink, stem and a detached dot (hollow=%s)', (hollow) => {
    const data = image();
    for (let y = 60; y <= 68; y++)
      for (let x = 73; x <= 87; x++) {
        const radius = ((x - 80) / 6) ** 2 + ((y - 64) / 3.5) ** 2;
        if (radius <= 1 && (!hollow || radius >= 0.4)) data[y * 200 + x] = 1;
      }
    vertical(data, 86, 34, 63);
    for (let y = 58; y <= 60; y++) for (let x = 92; x <= 94; x++) data[y * 200 + x] = 1;
    const note = {
      kind: 'note' as const,
      confidence: 0.5,
      duration: { base: '4', dots: 0, divisions: 48 },
      pitch: { step: 'B' as const, octave: 4, alter: 0 },
      src: {
        page: 1,
        system: 0,
        staff: 0,
        bbox: [70, 0, 30, 128] as [number, number, number, number],
        normalizedRange: [70, 100] as [number, number],
      },
    };
    const result = inspectNotation(data, 200, 128, 10, [note]);
    expect(result.alternatives[0]).toMatchObject({
      head: hollow ? 'hollow' : 'filled',
      stem: true,
      dots: 1,
    });
    expect(note.duration).toEqual({ base: '4', dots: 0, divisions: 48 });
  });

  it('projects a disagreement from window coordinates without changing the reading', () => {
    const data = image();
    vertical(data, 150, 44, 84);
    const line = withNotationEvidence(
      data,
      200,
      128,
      {
        page: 2,
        system: 1,
        staffIndex: 0,
        bbox: [100, 200, 400, 256],
        lineSpacingPx: 20,
        normSpacing: 10,
        window: { index: 1, start: 500, end: 700, fullWidth: 700 },
        normalizedToOriginal: [2, 0, 0, 2, 100, 200],
      },
      []
    );
    expect(line.elements).toEqual([]);
    expect(line.warnings?.[0].src?.bbox).toEqual([390, 278, 20, 100]);
    expect(line.notationEvidence?.[0].bars).toHaveLength(1);
  });
});
