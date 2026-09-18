import { NoteDuration, Accidental } from '../types/music';
import { SVG_PATHS, ACCIDENTAL_GLYPHS, AccidentalGlyphDef } from './glyphPaths';

/**
 * Grabado de figuras y silencios: cuántas plicas (flags) lleva una figura y qué
 * glifo dibuja su silencio. Es la única fuente de verdad de estos datos, de modo
 * que una figura nueva (o un valor mal escrito, como dibujar la fusa con dos
 * plicas) falla en los tests y no en el pentagrama.
 */

/** Plicas de una figura sin beamear. */
const FLAG_COUNTS: Record<NoteDuration, number> = {
  w: 0,
  h: 0,
  q: 0,
  '8': 1,
  '16': 2,
  '32': 3,
};

/** Separación vertical entre plicas consecutivas de una misma figura. */
export const FLAG_STEP = 8;

/** Número de plicas que lleva la figura (0 para redonda, blanca y negra). */
export function getFlagCount(duration: NoteDuration): number {
  return FLAG_COUNTS[duration] ?? 0;
}

/**
 * Trazado de la plica número `flagIndex` (0 = la más próxima a la cabeza) de una
 * figura sin beamear, colgando del final del plicalto. El trazo se espeja hacia
 * arriba cuando el plicalto apunta hacia abajo.
 */
export function getNoteFlagPath(
  stemX: number,
  stemEndY: number,
  stemUp: boolean,
  flagIndex: number
): string {
  const sign = stemUp ? 1 : -1;
  const y = stemEndY + sign * flagIndex * FLAG_STEP;
  return (
    `M ${stemX} ${y}` +
    ` C ${stemX + sign * 6.2} ${y + sign * 4}` +
    ` ${stemX + sign * 8.2} ${y + sign * 12}` +
    ` ${stemX + sign * 6.2} ${y + sign * 18}`
  );
}

/** Trazo individual de un silencio de corchea o menor, ya apilado. */
export interface RestStroke {
  dx: number;
  dy: number;
}

export type RestGlyph =
  | { kind: 'block'; offsetY: number; width: number; height: number }
  | {
      kind: 'glyph';
      path: string;
      offsetX: number;
      offsetY: number;
      scale: number;
      strokes: RestStroke[];
    };

const REST_BLOCK_WIDTH = 14;
const REST_BLOCK_HEIGHT = 6;

/** Desplazamiento de cada trazo adicional del silencio (diagonal del gancho). */
const REST_STROKE_DX = 1;
const REST_STROKE_DY = 7;

/** Anclaje del glifo base de cada silencio respecto a la posición del item. */
const REST_GLYPH_SPECS: Partial<
  Record<NoteDuration, { path: string; offsetX: number; offsetY: number; scale: number }>
> = {
  q: { path: SVG_PATHS.quarterRest, offsetX: -6, offsetY: 8, scale: 0.85 },
  '8': { path: SVG_PATHS.eighthRest, offsetX: -6, offsetY: 12, scale: 0.85 },
  '16': { path: SVG_PATHS.eighthRest, offsetX: -6, offsetY: 10, scale: 0.85 },
  '32': { path: SVG_PATHS.eighthRest, offsetX: -6, offsetY: 10, scale: 0.85 },
};

/**
 * Silencio de una figura: la redonda y la blanca se dibujan como bloque colgando
 * del pentagrama, y el resto apilando el gancho de corchea tantas veces como
 * plicas tenga la figura (el de negra es un glifo propio, de un solo trazo).
 */
export function getRestGlyph(duration: NoteDuration): RestGlyph {
  if (duration === 'w' || duration === 'h') {
    return {
      kind: 'block',
      offsetY: duration === 'w' ? 10 : 14,
      width: REST_BLOCK_WIDTH,
      height: REST_BLOCK_HEIGHT,
    };
  }

  const spec = REST_GLYPH_SPECS[duration] ?? REST_GLYPH_SPECS.q!;
  const strokeCount = Math.max(1, getFlagCount(duration));

  return {
    kind: 'glyph',
    ...spec,
    strokes: Array.from({ length: strokeCount }, (_, index) => ({
      dx: index * REST_STROKE_DX,
      dy: index * REST_STROKE_DY,
    })),
  };
}

export interface AccidentalLayout {
  glyph: AccidentalGlyphDef;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calcula las dimensiones y coordenadas absolutas de una alteración accidental
 * para que su centro óptico (vientre en bemol, ventana en becuadro) coincida exactamente
 * con la posición vertical de la nota (`noteY`).
 *
 * @param accidental Tipo de alteración ('#', 'b', 'n', 'bb', '##')
 * @param rightAnchorX Posición X del extremo derecho deseado para la alteración
 * @param noteY Posición Y del centro de la cabeza de la nota
 * @param customHeight Altura personalizada opcional (por defecto usa el tamaño estándar de pentagrama)
 */
export function getAccidentalLayout(
  accidental: NonNullable<Accidental>,
  rightAnchorX: number,
  noteY: number,
  customHeight?: number
): AccidentalLayout {
  const glyph = ACCIDENTAL_GLYPHS[accidental] ?? ACCIDENTAL_GLYPHS.b;
  let height = customHeight;
  if (!height) {
    if (accidental === 'b' || accidental === 'bb') {
      height = 22.4;
    } else if (accidental === 'n') {
      height = 24.5;
    } else if (accidental === '#') {
      height = 18;
    } else {
      height = 14;
    }
  }

  const width = height * (glyph.width / glyph.height);
  const anchorYRatio = glyph.anchorY / glyph.height;
  const y = noteY - anchorYRatio * height;
  const x = rightAnchorX - width;

  return {
    glyph,
    x,
    y,
    width,
    height,
  };
}
