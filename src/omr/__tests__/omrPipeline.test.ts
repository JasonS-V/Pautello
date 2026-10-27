import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, it, expect } from 'vitest';
import * as ort from 'onnxruntime-web/wasm';
import {
  i2wFromVocab,
  decodeLine,
  lineFragment,
  assembleIR,
  OmrStaffMeta,
  OmrTokenEvent,
} from '../omrDecode';
import { grayFromBytes, normalizeStaff } from '../omrPreprocess';
import { convertOmrIrToScore } from '../omrToScore';

function makeEventsFromSubtokens(subtokens: string[]): OmrTokenEvent[] {
  return subtokens.map((token, idx) => ({
    token,
    f0: idx * 2,
    f1: idx * 2 + 1,
    confidence: 0.96,
  }));
}

describe('omrDecode & omrToScore pipeline', () => {
  it('conserva ubicación y causa de un registro no interpretable', () => {
    const staff: OmrStaffMeta = {
      page: 2,
      system: 1,
      staffIndex: 0,
      bbox: [40, 80, 800, 120],
      lineSpacingPx: 12,
      normSpacing: 10,
    };
    const elements = lineFragment(makeEventsFromSubtokens(['16', '<b>']), staff);
    const ir = assembleIR([{ staff, elements }]);

    expect(ir.warnings[0]).toMatchObject({
      code: 'unparseable-tokens',
      severity: 'error',
      provenance: 'unsupported',
      page: 2,
      system: 1,
      staff: 0,
      tokens: ['16'],
      src: { page: 2, system: 1, staff: 0, bbox: [40, 80, 9.6, 120] },
    });
  });

  it('relaciona cada evento leído con su elemento editable después de reconciliar', () => {
    const staff: OmrStaffMeta = {
      page: 1,
      system: 0,
      staffIndex: 0,
      bbox: [0, 0, 800, 100],
      lineSpacingPx: 10,
      normSpacing: 10,
    };
    const elements = lineFragment(
      makeEventsFromSubtokens(['2', 'C', '<b>', '4', 'D', '<b>', '2', 'E', '<b>', '=']),
      staff
    );
    const ir = assembleIR([{ staff, elements }]);
    const result = convertOmrIrToScore(ir, { timeSignature: { beats: 3, beatType: 4 } });

    expect(result.score.staves[0].measures).toHaveLength(1);
    expect(result.sourceLinks).toHaveLength(3);
    for (const link of result.sourceLinks) {
      expect(link.src).toMatchObject({ page: 1, system: 0, staff: 0 });
      const target = result.score.staves
        .find((s) => s.id === link.staffId)
        ?.measures.find((m) => m.id === link.measureId)
        ?.items.find((item) => item.id === link.itemId);
      expect(target).toBeDefined();
    }
  });

  it('decodifica logits CTC colapsando repeticiones y descartando blanks (clase 0)', () => {
    const vocab = ['*clefG2', '<b>', '4', 'c', '='];
    const i2w = i2wFromVocab(vocab);
    // Clases: 0=blank, 1=*clefG2, 2=<b>, 3=4, 4=c, 5==
    const classes = [0, 1, 1, 0, 2, 0, 3, 3, 0, 4, 0, 2, 5];
    const C = vocab.length + 1;
    const logits = new Float32Array(classes.length * C).fill(-5);
    classes.forEach((cls, t) => {
      logits[t * C + cls] = 8.0;
    });

    const events = decodeLine(logits, classes.length, C, i2w);
    expect(events.map((e) => e.token)).toEqual(['*clefG2', '<b>', '4', 'c', '<b>', '=']);
    expect(events[0].confidence).toBeGreaterThan(0.9);
  });

  it('ensambla dos partes independientes con alteraciones, puntillos y tresillos', () => {
    const staffTreble: OmrStaffMeta = {
      page: 1,
      system: 0,
      staffIndex: 0,
      bbox: [20, 40, 700, 60],
      lineSpacingPx: 10,
      normSpacing: 10,
    };
    const staffBass: OmrStaffMeta = {
      page: 1,
      system: 0,
      staffIndex: 1,
      bbox: [20, 140, 700, 60],
      lineSpacingPx: 10,
      normSpacing: 10,
    };

    // Pentagrama 1: Sol Mayor (*k[f#]), 4/4, compás 1: negra con puntillo Sol4, corchea Fa#4, tresillo de negras, blanca ligada
    const trebleTokens = makeEventsFromSubtokens([
      '*clefG2',
      '<b>',
      '*k[f#]',
      '<b>',
      '*M4/4',
      '<b>',
      '4.',
      'g',
      '<b>',
      '8',
      'f',
      '#',
      '<b>',
      '6',
      'a',
      '<b>',
      '6',
      'b',
      '<b>',
      '6',
      'cc',
      '<b>',
      '=',
      '<b>',
      '[',
      '2',
      'dd',
      ';',
      '<b>',
      '2',
      'r',
      '<b>',
      '==',
    ]);

    // Pentagrama 2: Clave de Fa (*clefF4), redonda Sol2 y redonda Re3
    const bassTokens = makeEventsFromSubtokens([
      '*clefF4',
      '<b>',
      '*k[f#]',
      '<b>',
      '*M4/4',
      '<b>',
      '1',
      'GG',
      '<b>',
      '=',
      '<b>',
      '1',
      'D',
      '<b>',
      '==',
    ]);

    const fragTreble = lineFragment(trebleTokens, staffTreble);
    const fragBass = lineFragment(bassTokens, staffBass);

    const ir = assembleIR([
      { staff: staffTreble, elements: fragTreble },
      { staff: staffBass, elements: fragBass },
    ]);

    expect(ir.parts).toHaveLength(2);
    expect(ir.structure.recognized.keyFifths).toBe(1);
    expect(ir.structure.recognized.time).toEqual({ num: 4, den: 4 });

    const summary = convertOmrIrToScore(ir, {
      title: 'Sonatina en Sol',
      composer: 'Muzio Clementi',
      tempo: 128,
      lyrics: ['Sol', 'Fa', 'La', 'Si', 'Do', 'Re'],
      chords: ['G', 'D7'],
    });

    const { score } = summary;
    expect(score.title).toBe('Sonatina en Sol');
    expect(score.composer).toBe('Muzio Clementi');
    expect(score.tempo).toBe(128);
    expect(score.isGrandStaff).toBeUndefined();
    expect(score.staves).toHaveLength(2);
    expect(score.staves[0].name).toBe('Pentagrama 1');
    expect(score.staves[1].name).toBe('Pentagrama 2');
    expect(score.staves[0].clef).toBe('treble');
    expect(score.staves[1].clef).toBe('bass');

    const m1Items = score.staves[0].measures[0].items;
    expect(m1Items[0]).toMatchObject({
      type: 'note',
      duration: 'q',
      isDotted: true,
      pitch: { step: 'G', octave: 4, accidental: null },
    });
    expect(m1Items[0].lyric).toBeUndefined();
    expect(summary.metadataHints.lyrics?.[0]).toBe('Sol');
    expect(summary.warnings.some((w) => w.code === 'unanchored-text')).toBe(true);
    expect(m1Items[1]).toMatchObject({
      type: 'note',
      duration: '8',
      pitch: { step: 'F', octave: 4, accidental: '#' },
    });
    expect(m1Items[2]).toMatchObject({
      type: 'note',
      duration: 'q',
      tuplet: { actual: 3, normal: 2 },
    });

    const m2Items = score.staves[0].measures[1].items;
    expect(m2Items[0]).toMatchObject({
      type: 'note',
      duration: 'h',
      articulation: 'fermata',
      pitch: { step: 'D', octave: 5, accidental: null },
    });
    expect(m2Items[0].isTied).toBeUndefined();
    expect(m2Items[1]).toMatchObject({
      type: 'rest',
      duration: 'h',
    });
    expect(score.staves[0].measures[1].barline).toBe('final');
  });

  it('ejecuta inferencia neuronal real con ONNX Runtime Web (omr-line.fp32.onnx) alcanzando 100% de precisión sobre la línea de referencia', async () => {
    const modelPath = path.resolve(process.cwd(), 'public/omr/omr-line.fp32.onnx');
    const vocabPath = path.resolve(process.cwd(), 'public/omr/vocab.json');
    const samplePngPath = path.resolve(process.cwd(), 'src/omr/__tests__/fixtures/line.png');
    const sampleJsonPath = path.resolve(process.cwd(), 'src/omr/__tests__/fixtures/line.json');

    for (const required of [modelPath, vocabPath, samplePngPath, sampleJsonPath]) {
      expect(
        fs.existsSync(required),
        `Falta recurso requerido para inferencia real: ${required}`
      ).toBe(true);
    }

    // Decodificar PNG de 8-bit escala de grises
    const buf = fs.readFileSync(samplePngPath);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const idatChunks: Buffer[] = [];
    let offset = 8;
    while (offset < buf.length) {
      const len = buf.readUInt32BE(offset);
      const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
      if (type === 'IDAT') idatChunks.push(buf.subarray(offset + 8, offset + 8 + len));
      if (type === 'IEND') break;
      offset += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idatChunks));
    const pixels = new Uint8Array(width * height);
    const stride = width + 1;
    const paeth = (a: number, b: number, c: number) => {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      if (pa <= pb && pa <= pc) return a;
      if (pb <= pc) return b;
      return c;
    };
    for (let y = 0; y < height; y++) {
      const filter = raw[y * stride];
      const rowStart = y * stride + 1;
      const outRow = y * width;
      for (let x = 0; x < width; x++) {
        const byte = raw[rowStart + x];
        const left = x > 0 ? pixels[outRow + x - 1] : 0;
        const up = y > 0 ? pixels[outRow - width + x] : 0;
        const upLeft = x > 0 && y > 0 ? pixels[outRow - width + x - 1] : 0;
        let recon = byte;
        if (filter === 1) recon = (byte + left) & 0xff;
        else if (filter === 2) recon = (byte + up) & 0xff;
        else if (filter === 3) recon = (byte + Math.floor((left + up) / 2)) & 0xff;
        else if (filter === 4) recon = (byte + paeth(left, up, upLeft)) & 0xff;
        pixels[outRow + x] = recon;
      }
    }

    const meta = JSON.parse(fs.readFileSync(sampleJsonPath, 'utf8')) as {
      line_spacing_px: number;
      ground_truth_kern: string[];
    };
    const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8')) as { tokens: string[] };
    const i2w = i2wFromVocab(vocab.tokens);

    const gray = grayFromBytes(pixels, width * height);
    const norm = normalizeStaff(gray, width, height, meta.line_spacing_px, null);
    const inverted = new Float32Array(norm.data.length);
    for (let i = 0; i < norm.data.length; i++) {
      inverted[i] = 1.0 - norm.data[i];
    }

    ort.env.wasm.numThreads = 1;
    const modelBytes = new Uint8Array(fs.readFileSync(modelPath));
    const session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
    });

    const tensor = new ort.Tensor('float32', inverted, [1, 1, norm.height, norm.width]);
    const out = await session.run({ [session.inputNames[0]]: tensor });
    const logitsTensor = out[session.outputNames[0]];
    const T = logitsTensor.dims[1];
    const C = logitsTensor.dims[2];
    const events = decodeLine(logitsTensor.data as Float32Array, T, C, i2w);

    // Reconstruir los registros **kern unidos por el separador <b>
    const predictedKern: string[] = [];
    let currentRecord: string[] = [];
    for (const ev of events) {
      if (ev.token === '<b>') {
        if (currentRecord.length > 0) {
          predictedKern.push(currentRecord.join(''));
          currentRecord = [];
        }
      } else {
        currentRecord.push(ev.token);
      }
    }
    if (currentRecord.length > 0) {
      predictedKern.push(currentRecord.join(''));
    }

    expect(predictedKern).toEqual(meta.ground_truth_kern);

    const staffMeta: OmrStaffMeta = {
      page: 1,
      system: 0,
      staffIndex: 0,
      bbox: [0, 0, width, height],
      lineSpacingPx: meta.line_spacing_px,
      normSpacing: 10,
    };
    const elements = lineFragment(events, staffMeta);
    const ir = assembleIR([{ staff: staffMeta, elements }]);
    const summary = convertOmrIrToScore(ir, { title: 'Test Real ONNX' });

    expect(summary.notesCount).toBe(9);
    expect(summary.measuresCount).toBe(6);
    expect(summary.averageConfidence).toBeGreaterThanOrEqual(95);
  }, 20000);

  it('conserva clave de Fa y compases observados en 3/4 y diagnostica ligaduras espurias', () => {
    const staffMeta: OmrStaffMeta = {
      page: 1,
      system: 0,
      staffIndex: 0,
      bbox: [0, 0, 1000, 100],
      lineSpacingPx: 12,
      normSpacing: 10,
    };

    // Tokens simulados con clave de Fa, métrica ternaria, notas graves con tokens de ligadura ruidosos entre alturas distintas
    const tokens = makeEventsFromSubtokens([
      '*clefF4',
      '<b>',
      '*M3/4',
      '<b>',
      '4',
      'r',
      '<b>',
      '4',
      'r',
      '<b>',
      '4',
      'D',
      '<b>',
      '=',
      '<b>',
      '2',
      'G',
      '_',
      '<b>',
      '2',
      'D',
      '_',
      '<b>',
      '2',
      'G',
      '_',
      '<b>',
      '=',
      '<b>',
      '[',
      '2',
      'C',
      '<b>',
      '=',
      '<b>',
      '2',
      'C',
      ']',
      '<b>',
      '==',
    ]);

    const frags = lineFragment(tokens, staffMeta);
    const ir = assembleIR([{ staff: staffMeta, elements: frags }]);
    const summary = convertOmrIrToScore(ir, { title: 'El Rey', subtitle: 'Bajo' });

    // Debe detectar Clave de Fa
    expect(summary.score.staves[0].clef).toBe('bass');
    expect(summary.score.timeSignature).toEqual({ beats: 3, beatType: 4 });

    // La ligadura entre G y D debe ser descartada porque son alturas distintas
    const allNotes = summary.score.staves[0].measures.flatMap((m) =>
      m.items.filter((it) => it.type === 'note')
    );
    const gNotes = allNotes.filter((n) => n.pitch?.step === 'G');
    expect(gNotes[0].isTied).toBeUndefined();

    // La ligadura entre C3 y C3 (misma altura a través de compás) debe conservarse
    const cNotes = allNotes.filter((n) => n.pitch?.step === 'C');
    expect(cNotes[0].isTied).toBe(true);

    // La barra observada manda; la sobrecarga requiere revisión.
    expect(summary.score.staves[0].measures).toHaveLength(4);
    expect(summary.warnings.some((w) => w.code === 'measure-overfull')).toBe(true);
  });

  it('separa pistas editoriales de armadura observada y conserva duración y saltos', () => {
    const staff1: OmrStaffMeta = {
      page: 1,
      system: 0,
      staffIndex: 0,
      bbox: [0, 0, 1000, 100],
      lineSpacingPx: 12,
      normSpacing: 10,
    };
    const staff2: OmrStaffMeta = {
      page: 1,
      system: 1,
      staffIndex: 0,
      bbox: [0, 150, 1000, 100],
      lineSpacingPx: 12,
      normSpacing: 10,
    };

    // Línea 1: falsa armadura de 1 sostenido emitida por modelo debido a un Segno, pero las notas están en Do
    const tokensLine1 = makeEventsFromSubtokens([
      '*clefF4',
      '<b>',
      '*k[f#]', // falso positivo
      '<b>',
      '2',
      'D', // duración observada, sin promoción
      '<b>',
      '=',
      '<b>',
      '2',
      'D',
      '<b>',
      '=',
    ]);

    // Línea 2: notas en Do mayor (G, C, E, G)
    const tokensLine2 = makeEventsFromSubtokens([
      '*clefF4',
      '<b>',
      '4',
      'C',
      '<b>',
      '4',
      'E',
      '<b>',
      '4',
      'G',
      '<b>',
      '==',
    ]);

    const frags1 = lineFragment(tokensLine1, staff1);
    const frags2 = lineFragment(tokensLine2, staff2);
    const ir = assembleIR([
      { staff: staff1, elements: frags1 },
      { staff: staff2, elements: frags2 },
    ]);

    const summary = convertOmrIrToScore(ir, {
      title: 'El Rey',
      subtitle: 'Bajo',
      composer: 'José Alfredo Jiménez',
      tempo: 60,
      keySignature: 'C',
      genre: 'valseada',
      timeSignature: { beats: 3, beatType: 4 },
    });

    // Métrica provisional declarada en las pistas
    expect(summary.score.timeSignature).toEqual({ beats: 3, beatType: 4 });
    // Una pista tonal no reemplaza la armadura emitida por el modelo.
    expect(summary.score.keySignature).toBe('G');
    expect(summary.warnings.some((w) => w.code === 'metadata-conflict')).toBe(true);
    // Tempo debe ser 60 BPM
    expect(summary.score.tempo).toBe(60);

    // Las blancas mantienen su duración leída
    const m0 = summary.score.staves[0].measures[0];
    expect(m0.items[0]).toMatchObject({
      type: 'note',
      duration: 'h',
    });

    expect(m0.items[0].isDotted).toBeUndefined();

    // La última medida del sistema 0 debe tener systemBreak: true
    expect(summary.score.staves[0].measures[1].systemBreak).toBe(true);
  });
});
