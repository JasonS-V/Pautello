import { describe, expect, it } from 'vitest';

/**
 * Cálculo de luminancia relativa según la fórmula oficial de WCAG 2.x:
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const rLin = linearize(r);
  const gLin = linearize(g);
  const bLin = linearize(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Ratio de contraste WCAG 2.x: (L1 + 0.05) / (L2 + 0.05)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

describe('Auditoría de Contraste WCAG 2.x AA', () => {
  describe('Fórmula y casos canónicos', () => {
    it('calcula correctamente blanco sobre negro (21:1)', () => {
      expect(getContrastRatio('#ffffff', '#000000')).toBe(21.0);
    });

    it('calcula correctamente pares canónicos de referencia', () => {
      expect(getContrastRatio('#ffffff', '#333333')).toBeGreaterThanOrEqual(12.0);
      expect(getContrastRatio('#ffffff', '#666666')).toBeGreaterThanOrEqual(5.7);
      expect(getContrastRatio('#ffffff', '#777777')).toBeLessThan(4.5);
    });
  });

  describe('Partitura (Papel y Tinta)', () => {
    const paper = '#fffdf6';
    const ink = '#1d1d19';

    it('cumple sobradamente el estándar AAA (>= 7:1) para la tinta de notación sobre el papel', () => {
      const ratio = getContrastRatio(ink, paper);
      expect(ratio).toBeGreaterThanOrEqual(16.0);
    });
  });

  describe('Tema Claro (Slate UI)', () => {
    const bgWhite = '#ffffff';
    const bgSlate50 = '#f8fafc';

    it('text-slate-900 cumple AA sobre blanco y slate-50 (>= 4.5:1)', () => {
      const slate900 = '#0f172a';
      expect(getContrastRatio(slate900, bgWhite)).toBeGreaterThanOrEqual(15.0);
      expect(getContrastRatio(slate900, bgSlate50)).toBeGreaterThanOrEqual(14.0);
    });

    it('text-slate-700 cumple AA sobre blanco (>= 4.5:1)', () => {
      const slate700 = '#334155';
      expect(getContrastRatio(slate700, bgWhite)).toBeGreaterThanOrEqual(8.0);
    });

    it('text-slate-600 cumple AA sobre blanco (>= 4.5:1)', () => {
      const slate600 = '#475569';
      expect(getContrastRatio(slate600, bgWhite)).toBeGreaterThanOrEqual(6.0);
    });

    it('text-slate-500 cumple AA sobre blanco para texto secundario (>= 4.5:1)', () => {
      const slate500 = '#64748b';
      expect(getContrastRatio(slate500, bgWhite)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Tema Oscuro (Studio Surfaces)', () => {
    const studioBg = '#0c0d12';
    const studioSurface = '#111319';
    const studioCard = '#161922';

    it('text-white cumple AAA sobre superficies oscuras de estudio (>= 7:1)', () => {
      expect(getContrastRatio('#ffffff', studioBg)).toBeGreaterThanOrEqual(18.0);
      expect(getContrastRatio('#ffffff', studioSurface)).toBeGreaterThanOrEqual(17.0);
      expect(getContrastRatio('#ffffff', studioCard)).toBeGreaterThanOrEqual(16.0);
    });

    it('text-slate-200 cumple AA sobre superficies oscuras (>= 4.5:1)', () => {
      const slate200 = '#e2e8f0';
      expect(getContrastRatio(slate200, studioSurface)).toBeGreaterThanOrEqual(13.0);
    });

    it('text-slate-300 cumple AA sobre superficies oscuras (>= 4.5:1)', () => {
      const slate300 = '#cbd5e1';
      expect(getContrastRatio(slate300, studioSurface)).toBeGreaterThanOrEqual(10.0);
    });

    it('text-slate-400 cumple AA sobre superficies oscuras para texto secundario (>= 4.5:1)', () => {
      const slate400 = '#94a3b8';
      expect(getContrastRatio(slate400, studioBg)).toBeGreaterThanOrEqual(6.5);
      expect(getContrastRatio(slate400, studioSurface)).toBeGreaterThanOrEqual(6.0);
      expect(getContrastRatio(slate400, studioCard)).toBeGreaterThanOrEqual(5.5);
    });

    it('acento ámbar (#f59e0b) sobre fondos oscuros cumple sobradamente (>= 4.5:1)', () => {
      const accent = '#f59e0b';
      expect(getContrastRatio(accent, studioBg)).toBeGreaterThanOrEqual(8.0);
      expect(getContrastRatio(accent, studioSurface)).toBeGreaterThanOrEqual(7.5);
    });

    it('estado de peligro (#fb7185) cumple estándares de contraste en modo oscuro (>= 4.5:1)', () => {
      const dangerDark = '#fb7185';
      expect(getContrastRatio(dangerDark, studioSurface)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
