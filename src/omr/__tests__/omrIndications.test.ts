import { describe, expect, it } from 'vitest';
import {
  deriveEquivalenceQuarterBpm,
  detectTempo,
  findBarlines,
  readTextIndications,
} from '../omrIndications';
import type { PageTextLine } from '../omrPageText';

const line = (
  text: string,
  bbox: [number, number, number, number],
  words: PageTextLine['words']
): PageTextLine => ({
  id: text,
  page: 1,
  text,
  bbox,
  confidence: 95,
  source: 'ocr',
  words,
});

describe('page indications', () => {
  it('distinguishes a half note from a quarter note beside a metronome number', () => {
    const width = 100;
    const gray = new Float32Array(width * 60).fill(1);
    for (let y = 14; y < 39; y++) gray[y * width + 46] = 0;
    for (let y = 36; y < 47; y++)
      for (let x = 33; x < 47; x++)
        if (y < 39 || y > 43 || x < 37 || x > 43) gray[y * width + x] = 0;
    const words = [
      { text: 'd', bbox: [33, 14, 14, 33] as [number, number, number, number], confidence: 80 },
      { text: '=', bbox: [54, 37, 8, 5] as [number, number, number, number], confidence: 90 },
      { text: '60', bbox: [70, 34, 22, 14] as [number, number, number, number], confidence: 90 },
    ];
    expect(
      detectTempo(line('d = 60', [33, 14, 59, 34], [...words]), gray, width, 60)
    ).toMatchObject({
      beatUnit: 'h',
      perMinute: 60,
      quarterBpm: 120,
    });
    for (let y = 39; y <= 43; y++) for (let x = 37; x <= 43; x++) gray[y * width + x] = 0;
    expect(
      detectTempo(line('q = 60', [33, 14, 59, 34], [...words]), gray, width, 60)
    ).toMatchObject({
      beatUnit: 'q',
      perMinute: 60,
      quarterBpm: 60,
    });
  });

  it('keeps unknown beat units pending and preserves separate local marks', () => {
    const gray = new Float32Array(120 * 80).fill(1);
    const lines = [
      line(
        'Ranchera Valseada = 60',
        [0, 0, 90, 20],
        [
          { text: '=', bbox: [45, 10, 7, 5], confidence: 90 },
          { text: '60', bbox: [58, 6, 20, 14], confidence: 90 },
        ]
      ),
      line('D.S. al Coda', [10, 35, 80, 15], []),
      { ...line('A', [5, 55, 25, 22], []), boxed: true },
    ];
    const indications = readTextIndications(lines, [
      { page: 1, gray, width: 120, height: 80, staffBoxes: [] },
    ]);
    expect(indications.map((indication) => indication.kind)).toEqual([
      'style',
      'tempo',
      'navigation',
      'rehearsal',
    ]);
    expect(indications[1]).toMatchObject({
      status: 'pending',
      tempo: { beatUnit: null, perMinute: 60, quarterBpm: null },
    });
    expect(indications[2]).toMatchObject({ navigation: 'dalSegnoAlCoda', status: 'pending' });
  });

  it('finds an equals sign visually when OCR merges it with a note glyph', () => {
    const width = 120;
    const gray = new Float32Array(width * 60).fill(1);
    for (let y = 8; y < 37; y++) gray[y * width + 49] = 0;
    for (let y = 33; y < 44; y++) for (let x = 36; x < 50; x++) gray[y * width + x] = 0;
    for (const y of [36, 40]) for (let x = 58; x <= 65; x++) gray[y * width + x] = 0;
    const words = [
      {
        text: 'Ranchera',
        bbox: [0, 30, 28, 15] as [number, number, number, number],
        confidence: 90,
      },
      { text: 'Je', bbox: [36, 8, 30, 36] as [number, number, number, number], confidence: 50 },
      { text: '90', bbox: [74, 32, 20, 14] as [number, number, number, number], confidence: 90 },
    ];
    expect(
      detectTempo(line('Ranchera Je 90', [0, 8, 94, 38], words), gray, width, 60)
    ).toMatchObject({
      beatUnit: 'q',
      perMinute: 90,
      quarterBpm: 90,
    });
  });

  it('distinguishes a flagged eighth and a dotted quarter in image marks', () => {
    const width = 100;
    const gray = new Float32Array(width * 60).fill(1);
    for (let y = 14; y < 39; y++) gray[y * width + 46] = 0;
    for (let y = 36; y < 47; y++) for (let x = 33; x < 47; x++) gray[y * width + x] = 0;
    const words = [
      { text: 'q', bbox: [33, 14, 14, 33] as [number, number, number, number], confidence: 80 },
      { text: '=', bbox: [54, 37, 8, 5] as [number, number, number, number], confidence: 90 },
      { text: '90', bbox: [70, 34, 22, 14] as [number, number, number, number], confidence: 90 },
    ];
    for (let y = 16; y < 23; y++) for (let x = 49; x < 53; x++) gray[y * width + x] = 0;
    expect(detectTempo(line('q = 90', [33, 14, 59, 34], words), gray, width, 60)?.beatUnit).toBe(
      '8'
    );
    for (let y = 16; y < 23; y++) for (let x = 49; x < 53; x++) gray[y * width + x] = 1;
    for (let y = 40; y <= 42; y++) for (let x = 49; x <= 50; x++) gray[y * width + x] = 0;
    expect(detectTempo(line('q. = 90', [33, 14, 59, 34], words), gray, width, 60)).toMatchObject({
      beatUnit: 'q',
      dots: 1,
      quarterBpm: 135,
    });
  });

  it('anchors text to printed measure numbers and full-height barlines', () => {
    const width = 200,
      height = 100;
    const gray = new Float32Array(width * height).fill(1);
    for (const x of [60, 100, 150]) for (let y = 40; y <= 60; y++) gray[y * width + x] = 0;
    for (let y = 45; y <= 60; y++) gray[y * width + 125] = 0; // stem, not a barline
    const staff = {
      bbox: [20, 30, 170, 50] as [number, number, number, number],
      system: 1,
      staff: 0,
      staffTop: 40,
      lineSpacing: 5,
    };
    expect(findBarlines(gray, width, height, staff)).toEqual([60, 100, 150]);
    const indications = readTextIndications(
      [line('11', [20, 5, 15, 15], []), line('D.S. al Coda', [120, 8, 75, 20], [])],
      [{ page: 1, gray, width, height, staffBoxes: [staff] }]
    );
    expect(indications[0].anchor).toMatchObject({ measureNumber: 13, system: 1 });
  });

  it('derives both directions of a metric equivalence and leaves an unreadable unit pending', () => {
    expect(deriveEquivalenceQuarterBpm(90, '8', 0, 'q', 0)).toBe(180);
    expect(deriveEquivalenceQuarterBpm(90, 'q', 0, '8', 0)).toBe(45);
    expect(deriveEquivalenceQuarterBpm(90, 'q', 1, '8', 0)).toBe(30);
    expect(deriveEquivalenceQuarterBpm(90, null, 0, 'q', 0)).toBeNull();
  });

  it('leaves a boxed rehearsal mark pending when missing barlines make its measure unreliable', () => {
    const width = 300,
      height = 100;
    const gray = new Float32Array(width * height).fill(1);
    for (const x of [60, 100, 250]) for (let y = 40; y <= 60; y++) gray[y * width + x] = 0;
    const indications = readTextIndications(
      [line('19', [20, 5, 15, 15], []), { ...line('B', [205, 8, 25, 22], []), boxed: true }],
      [
        {
          page: 1,
          gray,
          width,
          height,
          staffBoxes: [
            { bbox: [20, 30, 260, 50], system: 1, staff: 0, staffTop: 40, lineSpacing: 5 },
          ],
        },
      ]
    );
    expect(indications.find((item) => item.kind === 'rehearsal')).toMatchObject({
      text: 'B',
      status: 'pending',
      anchor: { measureNumber: null },
      src: { page: 1, bbox: [205, 8, 25, 22] },
    });
  });

  it('keeps the source box and the rest target for a fermata over a rest', () => {
    const width = 120,
      height = 100;
    const gray = new Float32Array(width * height).fill(1);
    const ink = (x: number, y: number) => {
      gray[y * width + x] = 0;
    };
    for (let x = 35; x <= 59; x++) {
      const distance = Math.abs(x - 47);
      const y = 41 + Math.round(9 * (1 - Math.sqrt(Math.max(0, 1 - (distance * distance) / 144))));
      for (let row = y; row <= y + 1; row++) ink(x, row);
    }
    for (let y = 51; y <= 53; y++) for (let x = 46; x <= 48; x++) ink(x, y);
    for (let x = 44; x <= 51; x++) for (let y = 72; y <= 74; y++) ink(x, y);
    const indications = readTextIndications(
      [],
      [
        {
          page: 1,
          gray,
          width,
          height,
          staffBoxes: [
            { bbox: [10, 55, 100, 40], system: 0, staff: 0, staffTop: 60, lineSpacing: 8 },
          ],
        },
      ]
    );
    expect(indications.find((item) => item.kind === 'fermata')).toMatchObject({
      status: 'recognized',
      target: { kind: 'rest' },
      src: { page: 1, system: 0, staff: 0 },
    });
  });
});
