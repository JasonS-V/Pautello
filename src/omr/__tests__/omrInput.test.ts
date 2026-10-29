import { describe, expect, it } from 'vitest';
import { checkOmrFileType, checkPixelBudget, inspectPageInk, selectPdfPages } from '../omrInput';

describe('límites de entrada OMR', () => {
  it('exige un rango explícito cuando el PDF supera 20 páginas', () => {
    expect(() => selectPdfPages(21)).toThrow(/21 páginas/);
    expect(selectPdfPages(21, '2-21')).toHaveLength(20);
    expect(selectPdfPages(21, '21')).toEqual([21]);
    expect(selectPdfPages(21, '1,3-5')).toEqual([1, 3, 4, 5]);
    expect(() => selectPdfPages(21, '1-21')).toThrow(/máximo 20/);
    expect(() => selectPdfPages(21, '22')).toThrow(/entre 1 y 21/);
    expect(() => selectPdfPages(21, '1,,3')).toThrow(/1,3-5/);
  });

  it('rechaza imágenes enormes antes de reservar el lienzo y acumular páginas', () => {
    expect(checkPixelBudget(2_000, 3_000)).toBe(6_000_000);
    expect(() => checkPixelBudget(5_000, 5_000)).toThrow(/límite/);
    expect(() => checkPixelBudget(1.5, 4)).toThrow(/inválidas/);
    expect(() => checkPixelBudget(10, 10, -1)).toThrow(/inválidas/);
    expect(() => checkPixelBudget(2_000, 3_000, 56_000_000)).toThrow(/presupuesto total/);
  });

  it('distingue una entrada vacía o tenue y valida el tipo real', () => {
    expect(inspectPageInk(new Float32Array(100_000).fill(1))).toBe('empty');
    expect(inspectPageInk(new Float32Array(100_000).fill(0.9))).toBe('faint');
    expect(inspectPageInk(new Float32Array(100_000).fill(0.1))).toBe('visible');
    expect(() => checkOmrFileType('pdf', new TextEncoder().encode('not a PDF'))).toThrow(/formato/);
    expect(() => checkOmrFileType('pdf', new TextEncoder().encode('%PDF-1.7'))).not.toThrow();
  });
});
