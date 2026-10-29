import { describe, expect, it } from 'vitest';
import { assembleIR, lineFragment, type OmrDecodedLine } from '../omrDecode';
import { assignPartIdentities, findStaffLabel } from '../omrParts';

function line(clef: string, system: number, staffIndex: number, page = 1): OmrDecodedLine {
  const staff = {
    page,
    system,
    staffIndex,
    bbox: [0, system * 200 + staffIndex * 80, 600, 100] as [number, number, number, number],
    lineSpacingPx: 10,
    normSpacing: 10,
  };
  return {
    staff,
    elements: lineFragment(
      [clef, '<b>', '4', 'c', '<b>', '='].map((token, i) => ({
        token,
        f0: i * 4,
        f1: i * 4 + 1,
        confidence: 1,
      })),
      staff
    ),
  };
}

describe('F2.4: continuidad de partes', () => {
  it('conserva partes nombradas separadas aunque cada página solo tenga una pauta por sistema', () => {
    const source = [line('*clefG2', 0, 0), line('*clefF4', 0, 0, 2)];
    source[0].staff.partLabel = 'Violín';
    source[1].staff.partLabel = 'Bajo';
    const ir = assembleIR(assignPartIdentities(source));
    expect(ir.parts.map((part) => part.label)).toEqual(['Violín', 'Bajo']);
    expect(ir.structure.recognized.stavesPerSystem).toBe(1);
  });
  it('usa nombres localizados para distinguir instrumentos con la misma clave', () => {
    expect(
      findStaffLabel([100, 50, 800, 100], 10, [{ text: 'Violín 1', bbox: [10, 80, 70, 15] }])
    ).toBe('Violín 1');
    expect(
      findStaffLabel([100, 50, 800, 100], 10, [{ text: 'Allegro', bbox: [10, 80, 70, 15] }])
    ).toBeUndefined();
    const source = [line('*clefG2', 0, 0), line('*clefG2', 0, 1), line('*clefF4', 1, 0)];
    source[0].staff.partLabel = 'Violín 1';
    source[1].staff.partLabel = 'Viola';
    source[2].staff.partLabel = 'Viola';
    const mapped = assignPartIdentities(source);
    expect(mapped.map((l) => l.staff.partIndex)).toEqual([0, 1, 1]);
    expect(mapped.every((l) => !l.staff.assignmentAmbiguous)).toBe(true);
    expect(assembleIR(mapped).parts.map((p) => p.label)).toEqual(['Violín 1', 'Viola']);
  });
  it('retiene la parte Fa si la pauta Sol desaparece y vuelve en otra página', () => {
    const lines = assignPartIdentities([
      line('*clefG2', 0, 0),
      line('*clefF4', 0, 1),
      line('*clefF4', 1, 0),
      line('*clefG2', 0, 0, 2),
      line('*clefF4', 0, 1, 2),
    ]);
    expect(lines.map((l) => l.staff.partIndex)).toEqual([0, 1, 1, 0, 1]);
    const ir = assembleIR(lines);
    expect(ir.parts.map((p) => p.measures.length)).toEqual([2, 3]);
  });

  it('expone dos instrumentos de la misma clave como identidad provisional', () => {
    const lines = assignPartIdentities([
      line('*clefG2', 0, 0),
      line('*clefG2', 0, 1),
      line('*clefG2', 1, 0),
    ]);
    expect(lines.every((l) => l.staff.assignmentAmbiguous)).toBe(true);
    expect(assembleIR(lines).warnings.some((w) => w.code === 'part-identity-ambiguous')).toBe(true);
  });

  it('mantiene una sola parte a través de siete sistemas y cambios de clave locales', () => {
    const lines = assignPartIdentities(
      Array.from({ length: 7 }, (_, i) => line(i === 3 ? '*clefG2' : '*clefF4', i, 0))
    );
    expect(new Set(lines.map((l) => l.staff.partIndex)).size).toBe(1);
    expect(lines.every((l) => !l.staff.assignmentAmbiguous)).toBe(true);
  });
});
