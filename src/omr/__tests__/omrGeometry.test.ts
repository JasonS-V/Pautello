import { describe, expect, it } from 'vitest';
import { invertTransform, mapBox, mapPoint, rotatePage } from '../omrGeometry';
import { choosePdfScale } from '../omrInput';
import { detectAdaptive, preprocessPage } from '../omrPreprocess';
import { contrastVariants, preservesSymbols } from '../omrContrast';

function page(width = 600, height = 300, tops = [80], value = 0.05) {
  const gray = new Float32Array(width * height).fill(1);
  for (const top of tops)
    for (let l = 0; l < 5; l++)
      for (let x = 40; x < width - 40; x++) gray[(top + l * 10) * width + x] = value;
  return gray;
}

describe('F2: geometría sin pérdida', () => {
  it('refuerza tinta tenue sin rellenar cabezas huecas, eliminar puntillos ni cambiar la imagen limpia', () => {
    const source = page(600, 300, [80], 0.83);
    for (let y = 95; y <= 101; y++)
      for (let x = 280; x <= 288; x++)
        if (y === 95 || y === 101 || x === 280 || x === 288) source[y * 600 + x] = 0.83;
    source[97 * 600 + 294] = 0.83;
    const local = contrastVariants(source, 600, 300).local;
    expect(local[98 * 600 + 284]).toBe(1);
    expect(local[97 * 600 + 294]).toBeLessThan(0.6);
    expect(preservesSymbols(source, local)).toBe(true);
    expect(preprocessPage(source, 600, 300, { enableDeskew: false }).contrast.selected).toBe(
      'local'
    );
    expect(preprocessPage(page(), 600, 300, { enableDeskew: false }).contrast.selected).toBe(
      'original'
    );
  });

  it('detecta un sistema corto con líneas rotas y no une pautas por una plica aislada', () => {
    const source = page(1000, 400, [70, 210]);
    for (let y = 70; y <= 110; y += 10)
      for (let x = 40; x < 960; x++) if (x > 240 || x % 25 === 0) source[y * 1000 + x] = 1;
    for (let y = 111; y < 210; y++) source[y * 1000 + 500] = 0;
    const detected = detectAdaptive(source, 1000, 400);
    expect(detected.staves).toHaveLength(2);
    expect(detected.systems).toEqual([[0], [1]]);
  });

  it('cada píxel de tinta mantiene una ruta a notas o revisión', () => {
    const source = page();
    for (const [x, y] of [
      [15, 85],
      [300, 20],
      [400, 270],
      [310, 65],
      [300, 145],
    ])
      source[y * 600 + x] = 0;
    const prep = preprocessPage(source, 600, 300, { enableDeskew: false });
    for (let y = 0; y < 300; y++)
      for (let x = 0; x < 600; x++)
        if (source[y * 600 + x] < 0.94) {
          expect(
            prep.regions.some(
              ({ bbox: [rx, ry, rw, rh] }) => x >= rx && x < rx + rw && y >= ry && y < ry + rh
            )
          ).toBe(true);
        }
  });
  it('elige escala por espaciado y detalle mínimo, limitada por píxeles', () => {
    expect(choosePdfScale(600, 800, 4)).toBeCloseTo(2.5);
    expect(choosePdfScale(600, 800, 10)).toBe(1);
    expect(choosePdfScale(600, 800, 2)).toBeLessThanOrEqual(Math.sqrt(8_000_000 / 480_000));
    expect(() => choosePdfScale(600, 800, 4, 60_000_000)).toThrow(/presupuesto/);
  });

  it.each([90, 180, 270, 1.2])('invierte el giro %s sin recortar el original', (angle) => {
    const source = page();
    const rotated = rotatePage(source, 600, 300, angle);
    const point = mapPoint(rotated.transform, 120, 80);
    const original = mapPoint(invertTransform(rotated.transform), ...point);
    expect(original[0]).toBeCloseTo(120, 8);
    expect(original[1]).toBeCloseTo(80, 8);
    const bounds = mapBox(rotated.transform, [0, 0, 600, 300]);
    expect(bounds[0]).toBeGreaterThanOrEqual(-0.001);
    expect(bounds[1]).toBeGreaterThanOrEqual(-0.001);
    expect(bounds[0] + bounds[2]).toBeLessThanOrEqual(rotated.width + 0.001);
    expect(bounds[1] + bounds[3]).toBeLessThanOrEqual(rotated.height + 0.001);
  });

  it('compara todos los umbrales aunque la primera pauta ya sea visible', () => {
    const source = page(600, 400, [60]);
    const faint = page(600, 400, [230], 0.83);
    for (let i = 0; i < source.length; i++) source[i] = Math.min(source[i], faint[i]);
    expect(detectAdaptive(source, 600, 400).staves).toHaveLength(2);
  });

  it('no inventa una pauta en una franja vacía apaisada', () => {
    expect(preprocessPage(new Float32Array(600 * 100).fill(1), 600, 100).inputs).toHaveLength(0);
  });

  it('cubre toda la línea larga con ventanas solapadas sin truncar', () => {
    const prep = preprocessPage(page(9000, 240), 9000, 240, { enableDeskew: false });
    expect(prep.inputs.length).toBeGreaterThan(2);
    const windows = prep.inputs.map((input) => input.window);
    expect(windows[0].start).toBe(0);
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].start).toBeLessThan(windows[i - 1].end);
      expect(windows[i].end).toBeGreaterThan(windows[i - 1].end);
    }
    expect(windows[windows.length - 1].end).toBe(windows[0].fullWidth);
    expect(prep.inputs.every((input) => !input.truncated && input.width <= 3600)).toBe(true);
  });

  it('conserva notas adicionales e indicaciones fuera del tensor con una ruta pendiente', () => {
    const source = page();
    source[20 * 600 + 300] = 0; // indicación alta
    source[145 * 600 + 300] = 0; // nota grave fuera de la pauta
    const prep = preprocessPage(source, 600, 300, { enableDeskew: false });
    expect(
      prep.regions.some(
        (region) =>
          region.route === 'review' && region.bbox[1] <= 20 && region.bbox[1] + region.bbox[3] > 20
      )
    ).toBe(true);
    const box = prep.boxes[0];
    expect(prep.inputs[0].originalCrop[(145 - box.y) * box.w + 300 - box.x]).toBe(0);
    expect(prep.masks.every((mask) => !mask.applied)).toBe(true);
  });

  it('identifica orientación vertical y conserva transformación a la fuente', () => {
    const rotated = rotatePage(page(), 600, 300, 90);
    const prep = preprocessPage(rotated.gray, rotated.width, rotated.height);
    expect(prep.boxes).toHaveLength(1);
    expect(prep.orientation.quarterTurn).toBe(90);
    expect(prep.orientation.halfTurnAmbiguous).toBe(true);
  });
});
