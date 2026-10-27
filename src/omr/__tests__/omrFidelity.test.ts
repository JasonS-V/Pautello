import { describe, expect, it } from 'vitest';
import { getItemBeats } from '../../constants/pitches';
import { Measure } from '../../types/music';
import { assembleIR, lineFragment, OmrDecodedLine } from '../omrDecode';
import {
  applyOmrMeasureProposals,
  convertOmrIrToScore,
  inspectOmrMeasures,
  reconcileMeasuresForTimeSignature,
  refreshOmrSourceLinks,
} from '../omrToScore';

function line(tokens: string[], page = 1, system = 0, staffIndex = 0): OmrDecodedLine {
  const staff = {
    page,
    system,
    staffIndex,
    bbox: [0, 40, 800, 100] as [number, number, number, number],
    lineSpacingPx: 10,
    normSpacing: 10,
  };
  return {
    staff,
    elements: lineFragment(
      tokens.map((token, i) => ({ token, f0: i * 2, f1: i * 2 + 1, confidence: 0.96 })),
      staff
    ),
  };
}

describe('OMR: fidelidad sin reparaciones silenciosas', () => {
  it('no sustituye clave, métrica ni armadura explícitas por registro, título o estimación', () => {
    const ir = assembleIR([
      line([
        '*clefG2',
        '<b>',
        '*M2/4',
        '<b>',
        '*k[f#]',
        '<b>',
        '2',
        'C',
        '<b>',
        '=',
        '<b>',
        '2',
        'C',
        '<b>',
        '==',
      ]),
    ]);
    ir.parts[0].label = 'Guitarrón original';
    const result = convertOmrIrToScore(ir, {
      title: 'Bajo valseada',
      timeSignature: { beats: 3, beatType: 4 },
      keySignature: 'C',
    });
    expect(result.score.staves[0]).toMatchObject({ name: 'Guitarrón original', clef: 'treble' });
    expect(result.score.timeSignature).toEqual({ beats: 2, beatType: 4 });
    expect(result.score.keySignature).toBe('G');
    expect(result.warnings.some((w) => w.code === 'metadata-conflict')).toBe(true);
  });

  it('mantiene desconocidos pendientes sin fabricar Do4 ni duraciones aproximadas', () => {
    const ir = assembleIR([
      line(['4', 'C', '<b>', '0', 'D', '<b>', '4..', 'E', '<b>', '4', 'cccccc', '<b>', '==']),
    ]);
    ir.parts[0].measures[0].events.push({
      kind: 'note',
      duration: { base: '4', dots: 0, divisions: 48 },
      confidence: 0.5,
    });
    const result = convertOmrIrToScore(ir);
    expect(result.score.staves[0].measures[0].items).toHaveLength(1);
    expect(result.warnings.filter((w) => w.code === 'unsupported-event')).toHaveLength(4);
    expect(result.sourceLinks.filter((link) => link.measureId === null)).toHaveLength(4);
    expect(result.report).toMatchObject({
      sourceEvents: 5,
      representedEvents: 1,
      pendingEvents: 4,
    });
    expect(ir.parts[0].measures[0].events).toHaveLength(5);
  });

  it('conserva calderón en silencio y puntillo en tresillo', () => {
    const result = convertOmrIrToScore(
      assembleIR([line(['4', 'r', ';', '<b>', '6.', 'C', '<b>', '=='])])
    );
    expect(result.score.staves[0].measures[0].items[0].articulation).toBe('fermata');
    expect(result.score.staves[0].measures[0].items[1]).toMatchObject({
      isDotted: true,
      tuplet: { actual: 3, normal: 2 },
    });
  });

  it('no convierte dos partes en piano por sus claves y avisa de claves locales no representables', () => {
    const ir = assembleIR([
      line([
        '*clefG2',
        '<b>',
        '1',
        'c',
        '<b>',
        '=',
        '<b>',
        '*clefF4',
        '<b>',
        '1',
        'C',
        '<b>',
        '==',
      ]),
      line(['*clefF4', '<b>', '1', 'C', '<b>', '=', '<b>', '1', 'D', '<b>', '=='], 1, 0, 1),
    ]);
    const result = convertOmrIrToScore(ir);
    expect(result.score.isGrandStaff).toBeUndefined();
    expect(result.score.staves.map((staff) => staff.name)).toEqual([
      'Pentagrama 1',
      'Pentagrama 2',
    ]);
    expect(result.warnings.some((w) => w.code === 'unsupported-clef-change')).toBe(true);
  });

  it('conserva atributos y tokens desconocidos en las líneas del IR', () => {
    const decoded = line(['*unknown', '<b>', '4', 'C', '<b>', '=']);
    const ir = assembleIR([decoded]);
    expect(ir.lines).toEqual([decoded]);
    expect(convertOmrIrToScore(ir).report.unparseableRecords).toBe(1);
    expect(
      ir.warnings.some((w) => w.code === 'unparseable-tokens' && w.tokens?.includes('*unknown'))
    ).toBe(true);
  });

  it('conserva la cadena de tres notas y no liga a través de silencios ni al final', () => {
    const result = convertOmrIrToScore(
      assembleIR([
        line([
          '[',
          '4',
          'C',
          '<b>',
          '=',
          '<b>',
          '_',
          '4',
          'C',
          '<b>',
          '=',
          '<b>',
          ']',
          '4',
          'C',
          '<b>',
          '[',
          '4',
          'D',
          '<b>',
          '4',
          'r',
          '<b>',
          '4',
          'D',
          '<b>',
          '[',
          '4',
          'E',
          '<b>',
          '==',
        ]),
      ])
    );
    const items = result.score.staves[0].measures.flatMap((m) => m.items);
    expect(items.map((item) => Boolean(item.isTied))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(result.warnings.filter((w) => w.code === 'invalid-tie')).toHaveLength(2);
  });

  it('no liga a través de un evento pendiente que no pudo representarse', () => {
    const result = convertOmrIrToScore(
      assembleIR([line(['[', '4', 'C', '<b>', '0', 'r', '<b>', '4', 'C', '<b>', '=='])])
    );
    expect(result.score.staves[0].measures[0].items[0].isTied).toBeUndefined();
  });

  it('una región de solo eventos pendientes no se presenta como silencio reconocido', () => {
    const result = convertOmrIrToScore(assembleIR([line(['0', 'r', '<b>', '=='])]));
    expect(result.warnings.some((w) => w.code === 'empty-measure-placeholder')).toBe(true);
    expect(result.report).toMatchObject({
      sourceEvents: 1,
      representedEvents: 0,
      pendingEvents: 1,
    });
  });

  it('valida todas las alturas de un acorde y avisa de relaciones parciales', () => {
    const result = convertOmrIrToScore(
      assembleIR([line(['[', '4', 'C', 'E', '<b>', '4', 'C', 'G', '<b>', '=='])])
    );
    expect(result.score.staves[0].measures[0].items[0].isTied).toBeUndefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-tie', provenance: 'unsupported' }),
      ])
    );
  });

  it('no extiende una ligadura ambigua a todas las alturas de un acorde repetido', () => {
    const result = convertOmrIrToScore(
      assembleIR([line(['[', '4', 'C', 'E', '<b>', '4', 'C', 'E', '<b>', '=='])])
    );
    expect(result.score.staves[0].measures[0].items[0].isTied).toBeUndefined();
    expect(result.warnings.some((w) => w.code === 'invalid-tie')).toBe(true);
  });

  it('una propuesta conserva segno al comienzo y no inventa alineación de texto', () => {
    const result = convertOmrIrToScore(
      assembleIR([
        line([
          '*M3/4',
          '<b>',
          '2',
          'C',
          '<b>',
          '4',
          'D',
          '<b>',
          '2',
          'E',
          '<b>',
          '4',
          'F',
          '<b>',
          '==',
        ]),
      ]),
      { lyrics: ['texto sin anclaje'], chords: ['C'] }
    );
    const measure = result.score.staves[0].measures[0];
    const split = reconcileMeasuresForTimeSignature(
      [{ ...measure, navigationMark: 'segno' }],
      result.score.timeSignature
    );
    expect(split[0].navigationMark).toBe('segno');
    expect(split[1].navigationMark).toBeUndefined();
    expect(measure.items[0].lyric).toBeUndefined();
    expect(measure.items[0].chord).toBeUndefined();
    expect(result.warnings.some((w) => w.code === 'unanchored-text')).toBe(true);
  });

  it('conserva el regreso de la armadura local a la inicial', () => {
    const result = convertOmrIrToScore(
      assembleIR([
        line([
          '*k[]',
          '<b>',
          '1',
          'C',
          '<b>',
          '=',
          '<b>',
          '*k[f#]',
          '<b>',
          '1',
          'D',
          '<b>',
          '=',
          '<b>',
          '*k[]',
          '<b>',
          '1',
          'E',
          '<b>',
          '==',
        ]),
      ])
    );
    expect(result.score.keySignature).toBe('C');
    expect(result.score.staves[0].measures.map((m) => m.keySignatureChange)).toEqual([
      undefined,
      'G',
      'C',
    ]);
  });

  it('conserva repeticiones al inicio y entre sistemas/páginas con el mismo número', () => {
    const ir = assembleIR([
      line(['=!|:', '<b>', '1', 'C', '<b>', '=:|!|:'], 1, 0),
      line(['1', 'D', '<b>', '=:|!'], 2, 0),
    ]);
    expect(ir.parts[0].measures.map((m) => m.page)).toEqual([1, 2]);
    const measures = convertOmrIrToScore(ir).score.staves[0].measures;
    expect(measures[0]).toMatchObject({
      repeatStart: true,
      repeatEnd: true,
      systemBreak: true,
      pageBreak: true,
    });
    expect(measures[1]).toMatchObject({ repeatStart: true, repeatEnd: true });
  });

  it('conserva pautas fuera de la moda y advierte sobre identidad ambigua', () => {
    const ir = assembleIR([
      line(['1', 'C', '<b>', '='], 1, 0),
      line(['1', 'D', '<b>', '='], 1, 1),
      line(['1', 'E', '<b>', '='], 1, 2),
      line(['1', 'G', '<b>', '='], 1, 2, 1),
    ]);
    expect(ir.parts).toHaveLength(2);
    expect(ir.parts[1].measures[0].events[0].pitch?.step).toBe('G');
    expect(ir.warnings.some((w) => w.code === 'staff-assignment-uncertain')).toBe(true);
  });

  it('no fusiona barras de función distinta por simple adyacencia de tokens', () => {
    const decoded = line(['1', 'C', '<b>', '=:|!', '<b>', '=!|:', '<b>', '1', 'D', '<b>', '==']);
    expect(decoded.elements.filter((el) => el.kind === 'barline')).toHaveLength(3);
    const measures = convertOmrIrToScore(assembleIR([decoded])).score.staves[0].measures;
    expect(measures[0].repeatEnd).toBe(true);
    expect(measures[1].repeatStart).toBe(true);
  });

  it('conserva el compás abierto al cambiar de sistema sin barra observada', () => {
    const ir = assembleIR([line(['2', 'C'], 1, 0), line(['2', 'D', '<b>', '='], 2, 0)]);
    expect(ir.parts[0].measures).toHaveLength(1);
    expect(ir.parts[0].measures[0].events).toHaveLength(2);
    expect(ir.warnings.some((w) => w.code === 'measure-crosses-system')).toBe(true);
  });

  it('conserva seis tiempos y una sola barra observada sin promover blancas', () => {
    const ir = assembleIR([
      line([
        '*M3/4',
        '<b>',
        '2',
        'C',
        '<b>',
        '4',
        'D',
        '<b>',
        '2',
        'E',
        '<b>',
        '4',
        'F',
        '<b>',
        '==',
      ]),
    ]);
    const before = JSON.stringify(ir);
    const result = convertOmrIrToScore(ir);
    const measures = result.score.staves[0].measures;
    expect(measures).toHaveLength(1);
    expect(
      measures[0].items.reduce(
        (sum, item) => sum + getItemBeats(item.duration, item.isDotted, item.tuplet),
        0
      )
    ).toBe(6);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'measure-overfull', found: 6, expected: 3 }),
      ])
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].replacement.map((m) => m.items.length)).toEqual([2, 2]);
    expect(JSON.stringify(ir)).toBe(before);
  });

  it('aplica solo propuestas seleccionadas y conserva enlaces y borrador al deshacer', () => {
    const result = convertOmrIrToScore(
      assembleIR([
        line([
          '*M3/4',
          '<b>',
          '2',
          'C',
          '<b>',
          '4',
          'D',
          '<b>',
          '2',
          'E',
          '<b>',
          '4',
          'F',
          '<b>',
          '==',
        ]),
      ])
    );
    const base = JSON.stringify(result.score);
    const edited = applyOmrMeasureProposals(result.score, [result.proposals[0].measureId]);
    expect(edited.staves[0].measures).toHaveLength(2);
    expect(inspectOmrMeasures(edited).warnings).toHaveLength(0);
    expect(
      refreshOmrSourceLinks(edited, result.sourceLinks).every((link) => link.measureId !== null)
    ).toBe(true);
    expect(applyOmrMeasureProposals(result.score, []).staves[0].measures).toHaveLength(1);
    expect(JSON.stringify(result.score)).toBe(base);
  });

  it('conserva compases incompletos y diagnostica usando la métrica local', () => {
    const ir = assembleIR([
      line([
        '*M3/4',
        '<b>',
        '2',
        'C',
        '<b>',
        '=',
        '<b>',
        '*M4/4',
        '<b>',
        '1',
        'D',
        '<b>',
        '=',
        '<b>',
        '*M3/4',
        '<b>',
        '2.',
        'E',
        '<b>',
        '==',
      ]),
    ]);
    const result = convertOmrIrToScore(ir);
    const measures = result.score.staves[0].measures;
    expect(measures[0].items[0].isDotted).toBeUndefined();
    expect(measures[1].timeSignatureChange).toEqual({ beats: 4, beatType: 4 });
    expect(measures[2].timeSignatureChange).toEqual({ beats: 3, beatType: 4 });
    expect(result.warnings.filter((w) => w.code.startsWith('measure-'))).toEqual([
      expect.objectContaining({ code: 'measure-underfull', found: 2, expected: 3 }),
    ]);
  });

  it('una división solicitada conserva atributos iniciales y finales y no modifica su entrada', () => {
    const original: Measure = {
      id: 'm',
      repeatStart: true,
      repeatEnd: true,
      repeatCount: 3,
      rehearsalMark: 'A',
      tempoBpm: 90,
      timeSignatureChange: { beats: 3, beatType: 4 },
      keySignatureChange: 'G',
      navigationMark: 'dalSegnoAlCoda',
      barline: 'final',
      systemBreak: true,
      pageBreak: true,
      items: ['h', 'q', 'h', 'q'].map((duration, i) => ({
        id: `n${i}`,
        type: 'note',
        duration: duration as 'h' | 'q',
        pitch: { step: 'C', octave: 3, accidental: null },
      })),
    };
    const before = JSON.stringify(original);
    const result = reconcileMeasuresForTimeSignature([original], { beats: 4, beatType: 4 });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      repeatStart: true,
      rehearsalMark: 'A',
      tempoBpm: 90,
      timeSignatureChange: { beats: 3, beatType: 4 },
      keySignatureChange: 'G',
    });
    expect(result[0].repeatEnd).toBeUndefined();
    expect(result[0].systemBreak).toBeUndefined();
    expect(result[1]).toMatchObject({
      repeatEnd: true,
      repeatCount: 3,
      navigationMark: 'dalSegnoAlCoda',
      barline: 'final',
      systemBreak: true,
      pageBreak: true,
    });
    expect(result[1].repeatStart).toBeUndefined();
    expect(result[1].rehearsalMark).toBeUndefined();
    expect(result.flatMap((m) => m.items).map((item) => item.id)).toEqual(['n0', 'n1', 'n2', 'n3']);
    expect(JSON.stringify(original)).toBe(before);
  });

  it('no propone dividir una nota, un compás incompleto ni voces simultáneas', () => {
    const measures: Measure[] = [
      { id: 'long', items: [{ id: 'n', type: 'rest', duration: 'w' }] },
      { id: 'short', items: [{ id: 's', type: 'rest', duration: 'h' }] },
      {
        id: 'voices',
        items: [
          { id: 'v1', type: 'rest', duration: 'w' },
          { id: 'v2', type: 'rest', duration: 'w', voice: 2 },
        ],
      },
    ];
    expect(reconcileMeasuresForTimeSignature(measures, { beats: 3, beatType: 4 })).toEqual(
      measures
    );
  });
});
