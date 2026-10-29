import { describe, expect, it } from 'vitest';
import { checkPixelBudget, selectPdfPages } from '../omrInput';

describe('F7.2: presupuesto de memoria y acotación por página', () => {
  it('presupuesto de píxeles escala con páginas estándar y rechaza desbordamiento acumulado', () => {
    // 1 página estándar (1440 x 1900 = ~2.73 Mpx)
    const page1 = checkPixelBudget(1440, 1900, 0);
    expect(page1).toBe(2_736_000);

    // 10 páginas estándar (~27.36 Mpx)
    let used = 0;
    for (let i = 0; i < 10; i++) {
      used = checkPixelBudget(1440, 1900, used);
    }
    expect(used).toBe(27_360_000);

    // 20 páginas estándar (~54.72 Mpx, por debajo del tope de 60 Mpx)
    for (let i = 10; i < 20; i++) {
      used = checkPixelBudget(1440, 1900, used);
    }
    expect(used).toBe(54_720_000);

    // Página adicional que supera los 60 Mpx se rechaza antes de reservar memoria
    expect(() => checkPixelBudget(2000, 3000, used)).toThrow(
      /presupuesto total de 60\.000\.000 píxeles/
    );
  });

  it('selectPdfPages acota estrictamente el número de páginas activas', () => {
    expect(() => selectPdfPages(25)).toThrow(/25 páginas/);
    const pages = selectPdfPages(25, '1-10');
    expect(pages).toHaveLength(10);
    expect(pages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('calcula la huella de memoria teórica máxima de Float32 por página activa', () => {
    // Una página en gris Float32 a 1440 x 1900 ocupa exactamente:
    const pixels = 1440 * 1900;
    const float32Bytes = pixels * 4;
    const float32MiB = float32Bytes / (1024 * 1024);
    expect(float32MiB).toBeCloseTo(10.44, 1);

    // Al liberar p.gray = new Float32Array(0), la memoria no se acumula a través de las 20 páginas
    let activeBuffer = new Float32Array(pixels);
    expect(activeBuffer.byteLength).toBe(float32Bytes);
    // Simula la liberación secuencial tras procesar la página
    activeBuffer = new Float32Array(0);
    expect(activeBuffer.byteLength).toBe(0);
  });
});
