import { describe, expect, it } from 'vitest';
import { lineFragment, assembleIR, type OmrDecodedLine, type OmrStaffMeta } from '../omrDecode';
import { mergeStaffWindows } from '../omrWindows';

function windowLine(
  index: number,
  start: number,
  end: number,
  notes: Array<[string, number]>
): OmrDecodedLine {
  const staff: OmrStaffMeta = {
    page: 1,
    system: 0,
    staffIndex: 0,
    bbox: [0, 0, 9000, 128],
    lineSpacingPx: 10,
    normSpacing: 10,
    window: { index, start, end, fullWidth: 9000 },
    normalizedToOriginal: [1, 0, 0, 1, start, 0],
  };
  return {
    staff,
    elements: lineFragment(
      notes.flatMap(([pitch, x]) => [
        { token: '4', f0: (x - start) / 4, f1: (x - start) / 4, confidence: 0.9 },
        { token: pitch, f0: (x - start) / 4, f1: (x - start) / 4 + 1, confidence: 0.9 },
        { token: '<b>', f0: (x - start) / 4 + 2, f1: (x - start) / 4 + 2, confidence: 0.9 },
      ]),
      staff
    ),
  };
}

describe('F2.5: unión de ventanas', () => {
  it('marca una ventana sin eventos aunque ambos solapamientos estén vacíos', () => {
    const result = mergeStaffWindows([
      windowLine(0, 0, 3600, [['c', 100]]),
      windowLine(1, 3360, 6960, []),
    ]);
    expect(
      result.warnings?.some((w) => w.code === 'window-empty-reading' && w.src?.bbox[0] === 3360)
    ).toBe(true);
  });
  it('conserva como pendiente un registro que cruza la cabecera visual', () => {
    const line = windowLine(1, 3360, 6960, []);
    line.staff.window!.contextPrefix = 160;
    const elements = lineFragment(
      [
        { token: '4', f0: 20, f1: 20, confidence: 1 },
        { token: 'd', f0: 42, f1: 42, confidence: 1 },
      ],
      line.staff
    );
    expect(elements[0].kind).toBe('unparseable');
    expect(elements[0].src?.normalizedRange).toEqual([3360, 3372]);
  });
  it('descarta la cabecera visual repetida sin duplicar atributos ni notas', () => {
    const line = windowLine(1, 3360, 6960, []);
    line.staff.window!.contextPrefix = 160;
    const elements = lineFragment(
      [
        { token: '*clefG2', f0: 2, f1: 4, confidence: 1 },
        { token: '<b>', f0: 5, f1: 5, confidence: 1 },
        { token: '4', f0: 60, f1: 60, confidence: 1 },
        { token: 'd', f0: 61, f1: 61, confidence: 1 },
      ],
      line.staff
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe('note');
    expect(elements[0].src?.normalizedRange).toEqual([3440, 3448]);
  });
  it('conserva notas únicas en solapamientos y une una misma nota solo por posición y contenido', () => {
    const result = mergeStaffWindows([
      windowLine(0, 0, 3600, [
        ['c', 100],
        ['d', 3420],
        ['e', 3520],
      ]),
      windowLine(1, 3360, 6960, [
        ['d', 3424],
        ['e', 3524],
        ['f', 6800],
      ]),
      windowLine(2, 6720, 9000, [
        ['f', 6804],
        ['g', 8500],
      ]),
    ]);
    expect(result.elements.flatMap((e) => (e.kind === 'note' ? [e.pitch?.step] : []))).toEqual([
      'C',
      'D',
      'E',
      'F',
      'G',
    ]);
    expect(result.hypotheses).toHaveLength(3);
    expect(result.warnings).toHaveLength(0);
    expect(assembleIR([result]).parts[0].measures[0].events).toHaveLength(5);
  });

  it('conserva ambas hipótesis si discrepan sin esconder omisiones de borde', () => {
    const result = mergeStaffWindows([
      windowLine(0, 0, 3600, [
        ['d', 3420],
        ['e', 3520],
      ]),
      windowLine(1, 3360, 6960, [['f', 3424]]),
    ]);
    expect(result.elements.filter((e) => e.kind === 'note')).toHaveLength(3);
    expect(result.warnings?.some((w) => w.code === 'window-join-ambiguous' && w.src)).toBe(true);
    expect(assembleIR([result]).warnings.some((w) => w.code === 'window-join-ambiguous')).toBe(
      true
    );
  });

  it('proyecta la ventana rotada a la fuente sin usar el desplazamiento dos veces', () => {
    const line = windowLine(1, 3360, 6960, [['d', 3420]]);
    line.staff.normalizedToOriginal = [0, 1, -1, 0, 300, 3360];
    const elements = lineFragment(
      [
        { token: '4', f0: 15, f1: 15, confidence: 1 },
        { token: 'd', f0: 15, f1: 16, confidence: 1 },
      ],
      line.staff
    );
    expect(elements[0].src?.bbox).toEqual([172, 3420, 128, 8]);
    expect(elements[0].src?.normalizedRange).toEqual([3420, 3428]);
  });
});
