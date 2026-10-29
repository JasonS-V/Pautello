import { describe, it, expect } from 'vitest';
import { Score } from '../../types/music';
import {
  encodeScorePayload,
  decodeScorePayloadFromText,
  formatEmbeddedScoreMarker,
  injectScoreIntoPngBytes,
  extractScoreFromPngBytes,
} from '../scorePayloadCodec';

function createSampleScore(): Score {
  return {
    id: 'score-test-lossless',
    title: 'Estudio en Sol Mayor',
    subtitle: 'Op. 12 No. 1',
    composer: 'Johann Sebastian Bach',
    tempo: 116,
    timeSignature: { beats: 3, beatType: 4 },
    keySignature: 'G',
    staves: [
      {
        id: 'staff-1',
        name: 'Mano Derecha',
        clef: 'treble',
        measures: [
          {
            id: 'm-1',
            items: [
              {
                id: 'n-1',
                type: 'note',
                pitch: { step: 'G', octave: 4, accidental: null },
                pitches: [{ step: 'G', octave: 4, accidental: null }],
                duration: 'q',
                lyric: 'Sol',
                chord: 'G',
              },
              {
                id: 'n-2',
                type: 'note',
                pitch: { step: 'F', octave: 4, accidental: '#' },
                pitches: [{ step: 'F', octave: 4, accidental: '#' }],
                duration: 'q',
              },
              {
                id: 'r-1',
                type: 'rest',
                duration: 'q',
              },
            ],
          },
        ],
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };
}

/** Construye un archivo PNG mínimo válido (firma + IHDR + IEND). */
function createMinimalPngBytes(): Uint8Array {
  const bytes = new Uint8Array([
    // PNG signature (8 bytes)
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    // IHDR chunk (length 13)
    0,
    0,
    0,
    13,
    73,
    72,
    68,
    82, // 'IHDR'
    0,
    0,
    0,
    1, // width = 1
    0,
    0,
    0,
    1, // height = 1
    8,
    2,
    0,
    0,
    0, // bit depth, color type, etc.
    144,
    119,
    83,
    222, // CRC
    // IEND chunk (length 0)
    0,
    0,
    0,
    0,
    73,
    69,
    78,
    68, // 'IEND'
    174,
    66,
    96,
    130, // CRC
  ]);
  return bytes;
}

describe('scorePayloadCodec', () => {
  it('codifica y decodifica un Score completo sin pérdida de datos', () => {
    const score = createSampleScore();
    const encoded = encodeScorePayload(score);
    expect(encoded.startsWith('PAUTELLO_V1:')).toBe(true);

    const decoded = decodeScorePayloadFromText(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.title).toBe('Estudio en Sol Mayor');
    expect(decoded?.composer).toBe('Johann Sebastian Bach');
    expect(decoded?.keySignature).toBe('G');
    expect(decoded?.timeSignature).toEqual({ beats: 3, beatType: 4 });
    expect(decoded?.staves[0].measures[0].items).toHaveLength(3);
    expect(decoded?.staves[0].measures[0].items[1].pitch).toEqual({
      step: 'F',
      octave: 4,
      accidental: '#',
    });
  });

  it('recupera la partitura incluso cuando el extractor PDF inserta saltos de línea', () => {
    const score = createSampleScore();
    const marker = formatEmbeddedScoreMarker(score);
    // Simular fragmentación de texto de PDF
    const noisyPdfText = `Título de cabecera\n${marker.slice(0, 40)}\n  ${marker.slice(40)}\nPie de página`;
    const decoded = decodeScorePayloadFromText(noisyPdfText);
    expect(decoded).not.toBeNull();
    expect(decoded?.title).toBe(score.title);
    expect(decoded?.tempo).toBe(116);
  });

  it('devuelve null ante cadenas vacías o corruptas', () => {
    expect(decodeScorePayloadFromText('')).toBeNull();
    expect(decodeScorePayloadFromText('Texto normal sin firma')).toBeNull();
    expect(decodeScorePayloadFromText('PAUTELLO_V1:@@@no_base64@@@:END_PAUTELLO')).toBeNull();
  });

  it('inyecta y extrae el chunk tEXt en un binario PNG válido', () => {
    const score = createSampleScore();
    const minimalPng = createMinimalPngBytes();

    const injected = injectScoreIntoPngBytes(minimalPng, score);
    expect(injected.length).toBeGreaterThan(minimalPng.length);

    const extracted = extractScoreFromPngBytes(injected);
    expect(extracted).not.toBeNull();
    expect(extracted?.title).toBe('Estudio en Sol Mayor');
    expect(extracted?.staves[0].measures[0].items[0].lyric).toBe('Sol');
  });

  it('ignora binarios que no tienen firma PNG válida', () => {
    const score = createSampleScore();
    const invalid = new Uint8Array([1, 2, 3, 4]);
    expect(injectScoreIntoPngBytes(invalid, score)).toEqual(invalid);
    expect(extractScoreFromPngBytes(invalid)).toBeNull();
  });
});
