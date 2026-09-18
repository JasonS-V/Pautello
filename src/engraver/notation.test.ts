import { describe, it, expect } from 'vitest';
import {
  FLAG_STEP,
  getFlagCount,
  getNoteFlagPath,
  getRestGlyph,
  getAccidentalLayout,
} from './notation';
import { SVG_PATHS, ACCIDENTAL_GLYPHS } from './glyphPaths';
import { NoteDuration } from '../types/music';

const ALL_DURATIONS: NoteDuration[] = ['w', 'h', 'q', '8', '16', '32'];

/** Extrae los números de un path SVG para comparar geometría sin depender del formato. */
const pathNumbers = (path: string): number[] => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('Notación: plicas de las figuras', () => {
  it('cuenta las plicas de cada figura sin beamear', () => {
    expect(getFlagCount('w')).toBe(0);
    expect(getFlagCount('h')).toBe(0);
    expect(getFlagCount('q')).toBe(0);
    expect(getFlagCount('8')).toBe(1);
    expect(getFlagCount('16')).toBe(2);
    expect(getFlagCount('32')).toBe(3);
  });

  it('asigna un recuento a todas las figuras del modelo', () => {
    ALL_DURATIONS.forEach((duration) => {
      expect(getFlagCount(duration)).toBeGreaterThanOrEqual(0);
    });
  });

  it('cuelga el primer trazo del final del plicalto', () => {
    // Geometría heredada de ScoreView: no cambiar sin querer cambiarla en pantalla.
    expect(getNoteFlagPath(0, 0, true, 0)).toBe('M 0 0 C 6.2 4 8.2 12 6.2 18');
  });

  it('acumula las plicas con paso FLAG_STEP, una por cada figura menor', () => {
    // Equivale a la segunda plica de la semicorchea y a la tercera de la fusa.
    expect(FLAG_STEP).toBe(8);
    expect(getNoteFlagPath(0, 0, true, 1)).toBe('M 0 8 C 6.2 12 8.2 20 6.2 26');
    expect(getNoteFlagPath(0, 0, true, 2)).toBe('M 0 16 C 6.2 20 8.2 28 6.2 34');
  });

  it('separa cada plica exactamente FLAG_STEP de la anterior', () => {
    for (let flagIndex = 0; flagIndex < 3; flagIndex++) {
      const numbers = pathNumbers(getNoteFlagPath(10, 50, true, flagIndex));
      expect(numbers[1]).toBe(50 + flagIndex * FLAG_STEP);
      // El trazo siempre abarca 18 unidades hacia fuera desde su arranque.
      expect(numbers[7] - numbers[1]).toBe(18);
    }
  });

  it('acumula las plicas hacia fuera también con el plicalto hacia abajo', () => {
    // Con el plicalto hacia abajo la segunda plica arranca ENCIMA del final del
    // plicalto, no debajo (comportamiento heredado de ScoreView).
    const down = pathNumbers(getNoteFlagPath(10, 50, false, 1));
    expect(down[1]).toBe(50 - FLAG_STEP);
    expect(down[7]).toBe(50 - FLAG_STEP - 18);
  });

  it('espeja el trazo cuando el plicalto apunta hacia abajo', () => {
    const up = pathNumbers(getNoteFlagPath(10, 50, true, 0));
    const down = pathNumbers(getNoteFlagPath(10, 50, false, 0));

    // Arranca en el mismo punto (x0, y0) y el resto se refleja sobre él.
    expect(down[0]).toBe(up[0]);
    expect(down[1]).toBe(up[1]);
    for (let i = 2; i < up.length; i++) {
      const mirror = i % 2 === 0 ? 2 * up[0] - up[i] : 2 * up[1] - up[i];
      expect(down[i]).toBeCloseTo(mirror, 10);
    }
    // Y no se descuelga hacia el lado contrario al plicalto.
    expect(down[7]).toBeLessThan(down[1]);
  });
});

describe('Notación: silencios de las figuras', () => {
  it('dibuja la redonda y la blanca como bloque, colgando la blanca más abajo', () => {
    const whole = getRestGlyph('w');
    const half = getRestGlyph('h');

    expect(whole.kind).toBe('block');
    expect(half.kind).toBe('block');
    if (whole.kind !== 'block' || half.kind !== 'block') return;

    expect(whole.width).toBe(14);
    expect(whole.height).toBe(6);
    expect(half.width).toBe(whole.width);
    expect(half.height).toBe(whole.height);
    expect(half.offsetY).toBeGreaterThan(whole.offsetY);
  });

  it('usa el glifo propio de negra, de un solo trazo', () => {
    const quarter = getRestGlyph('q');
    expect(quarter.kind).toBe('glyph');
    if (quarter.kind !== 'glyph') return;

    expect(quarter.path).toBe(SVG_PATHS.quarterRest);
    expect(quarter.strokes).toEqual([{ dx: 0, dy: 0 }]);
  });

  it('apila el gancho de corchea tantas veces como plicas tiene la figura', () => {
    const eighth = getRestGlyph('8');
    const sixteenth = getRestGlyph('16');
    const thirtySecond = getRestGlyph('32');
    if (eighth.kind !== 'glyph' || sixteenth.kind !== 'glyph' || thirtySecond.kind !== 'glyph') {
      throw new Error('los silencios de corchea y menores deben ser glifos');
    }

    // Todas parten del silencio de corchea y se diferencian en los trazos.
    expect(eighth.path).toBe(SVG_PATHS.eighthRest);
    expect(sixteenth.path).toBe(SVG_PATHS.eighthRest);
    expect(thirtySecond.path).toBe(SVG_PATHS.eighthRest);

    expect(eighth.strokes).toHaveLength(1);
    expect(sixteenth.strokes).toHaveLength(2);
    expect(thirtySecond.strokes).toHaveLength(3);
  });

  it('dibuja la fusa con tres trazos y no con dos (regresión)', () => {
    const fusa = getRestGlyph('32');
    const semi = getRestGlyph('16');
    if (fusa.kind !== 'glyph' || semi.kind !== 'glyph') return;

    // Antes la fusa reutilizaba la rama de la semicorchea y se dibujaba como
    // una figura de menor valor.
    expect(fusa.strokes.length).toBe(getFlagCount('32'));
    expect(fusa.strokes.length).toBeGreaterThan(semi.strokes.length);
  });

  it('apila los trazos en diagonal con paso constante', () => {
    const fusa = getRestGlyph('32');
    if (fusa.kind !== 'glyph') return;

    expect(fusa.strokes).toEqual([
      { dx: 0, dy: 0 },
      { dx: 1, dy: 7 },
      { dx: 2, dy: 14 },
    ]);
  });

  it('mantiene la coherencia entre las plicas de la figura y los trazos del silencio', () => {
    ALL_DURATIONS.forEach((duration) => {
      const rest = getRestGlyph(duration);
      if (rest.kind !== 'glyph') return;
      expect(rest.strokes).toHaveLength(Math.max(1, getFlagCount(duration)));
    });
  });

  it('devuelve un silencio para todas las figuras del modelo', () => {
    ALL_DURATIONS.forEach((duration) => {
      expect(getRestGlyph(duration)).toBeDefined();
    });
  });
});

describe('Notación: alteraciones accidentales (bemol, becuadro, sostenido)', () => {
  it('centra el vientre del bemol exactamente en la coordenada Y de la nota', () => {
    const layout = getAccidentalLayout('b', 100, 40);
    // El punto de anclaje óptico debe coincidir con noteY = 40
    const anchorYRatio = ACCIDENTAL_GLYPHS.b.anchorY / ACCIDENTAL_GLYPHS.b.height;
    const opticalCenterY = layout.y + anchorYRatio * layout.height;
    expect(opticalCenterY).toBeCloseTo(40, 5);
    // Su extremo derecho coincide con rightAnchorX = 100
    expect(layout.x + layout.width).toBeCloseTo(100, 5);
    expect(layout.glyph.d).toBe(SVG_PATHS.flat);
  });

  it('centra la ventana del becuadro exactamente en la coordenada Y de la nota', () => {
    const layout = getAccidentalLayout('n', 100, 40);
    const anchorYRatio = ACCIDENTAL_GLYPHS.n.anchorY / ACCIDENTAL_GLYPHS.n.height;
    const opticalCenterY = layout.y + anchorYRatio * layout.height;
    expect(opticalCenterY).toBeCloseTo(40, 5);
    expect(layout.x + layout.width).toBeCloseTo(100, 5);
    expect(layout.glyph.d).toBe(SVG_PATHS.natural);
  });

  it('centra el sostenido en la coordenada Y de la nota', () => {
    const layout = getAccidentalLayout('#', 100, 40);
    const anchorYRatio = ACCIDENTAL_GLYPHS['#'].anchorY / ACCIDENTAL_GLYPHS['#'].height;
    const opticalCenterY = layout.y + anchorYRatio * layout.height;
    expect(opticalCenterY).toBeCloseTo(40, 5);
    expect(layout.x + layout.width).toBeCloseTo(100, 5);
  });
});
