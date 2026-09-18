import React from 'react';
import { NoteDuration } from '../../types/music';

/**
 * Glifos vectoriales de figura y silencio para la interfaz (selector del
 * toolbar, inspector, leyendas). Sustituyen a los caracteres Unicode 𝅝𝅗𝅥𝅘𝅥𝅘𝅥𝅮𝅘𝅥𝅯𝅘𝅥𝅰:
 * esos glifos los dibuja cada sistema operativo a su manera (Windows Segoe UI
 * Symbol los pinta finos y desalineados, Apple Symbols gruesos), mientras que
 * aqui son SVG y se ven identicos en todas partes.
 *
 * El dibujo no pretende sustituir al grabador del pentagrama (`engraver/`), que
 * trabaja en coordenadas de pentagrama: esto es iconografia de interfaz, con
 * una caja fija de 26x34 y trazo constante.
 */

interface NoteGlyphProps {
  duration: NoteDuration;
  /** Dibuja el silencio en lugar de la figura. */
  rest?: boolean;
  className?: string;
  /** Titulo accesible; si falta, el SVG queda decorativo. */
  title?: string;
}

const NOTEHEAD_CENTER_X = 9;
const NOTEHEAD_CENTER_Y = 25;
const STEM_TOP_Y = 5;

/** Cabeza de nota: elipse inclinada como en el grabado real. */
function Notehead({ filled }: { filled: boolean }) {
  return (
    <ellipse
      cx={NOTEHEAD_CENTER_X}
      cy={NOTEHEAD_CENTER_Y}
      rx={5.6}
      ry={4.1}
      transform={`rotate(-20 ${NOTEHEAD_CENTER_X} ${NOTEHEAD_CENTER_Y})`}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? 0 : 1.8}
    />
  );
}

/** Plica: sube desde el borde derecho de la cabeza. */
function Stem() {
  return (
    <line
      x1={NOTEHEAD_CENTER_X + 5.2}
      y1={NOTEHEAD_CENTER_Y - 1.4}
      x2={NOTEHEAD_CENTER_X + 5.2}
      y2={STEM_TOP_Y}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  );
}

/** Corchetes: uno por cada valor por debajo de la negra. */
function Flags({ count }: { count: number }) {
  const x = NOTEHEAD_CENTER_X + 5.2;
  return (
    <g fill="currentColor">
      {Array.from({ length: count }).map((_, index) => {
        const y = STEM_TOP_Y + index * 5.2;
        return (
          <path
            key={index}
            d={`M ${x} ${y} C ${x + 3.4} ${y + 1.6} ${x + 5.2} ${y + 4.4} ${x + 4} ${y + 7.2} C ${x + 4.6} ${y + 4.6} ${x + 2.6} ${y + 3} ${x} ${y + 2.6} Z`}
          />
        );
      })}
    </g>
  );
}

/** Silencio de redonda: bloque colgando por debajo de la cuarta linea. */
function WholeRest() {
  return (
    <g fill="currentColor">
      <rect x={4} y={16} width={16} height={5} rx={0.8} />
      <line x1={3} y1={15.2} x2={21} y2={15.2} stroke="currentColor" strokeWidth={1.2} />
    </g>
  );
}

/** Silencio de blanca: bloque apoyado sobre la tercera linea. */
function HalfRest() {
  return (
    <g fill="currentColor">
      <rect x={4} y={10} width={16} height={5} rx={0.8} />
      <line x1={3} y1={16} x2={21} y2={16} stroke="currentColor" strokeWidth={1.2} />
    </g>
  );
}

/** Silencio de negra: el zigzag clasico. */
function QuarterRest() {
  return (
    <path
      d="M 10 5 C 14 9 17 13 14 17 C 11 21 7 24 11 29 C 13 31.5 15 33 13 34.5 C 16.5 31 18 27 13.5 23 C 9 19 12 16 15 11 C 17 8 13 6 10 5 Z"
      fill="currentColor"
    />
  );
}

/** Silencio de corchea (y base de los valores menores): gancho con punto. */
function HookRest({ hooks }: { hooks: number }) {
  return (
    <g fill="currentColor">
      <circle cx={10} cy={13} r={1.8} />
      <path
        d={`M 11 14 C 15 18 18 22 17.5 26 C 17 24 14 21 11 19 Z`}
        transform={hooks > 1 ? 'translate(-1 3)' : undefined}
      />
      {hooks > 1 && <path d="M 11 18 C 15 22 18 25 17.5 29 C 17 27 14 24 11 23 Z" />}
      {hooks > 2 && <path d="M 10 22 C 14 25 17 28 16.5 31 C 16 29 13 27 10 26 Z" />}
    </g>
  );
}

export const NoteGlyph: React.FC<NoteGlyphProps> = ({
  duration,
  rest = false,
  className,
  title,
}) => {
  const isHollow = duration === 'w' || duration === 'h';
  const flagCount = duration === '8' ? 1 : duration === '16' ? 2 : duration === '32' ? 3 : 0;

  return (
    <svg
      viewBox="0 0 26 34"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {rest ? (
        duration === 'w' ? (
          <WholeRest />
        ) : duration === 'h' ? (
          <HalfRest />
        ) : duration === 'q' ? (
          <QuarterRest />
        ) : (
          <HookRest hooks={Math.max(1, flagCount)} />
        )
      ) : (
        <>
          <Notehead filled={!isHollow} />
          {duration !== 'w' && <Stem />}
          {flagCount > 0 && <Flags count={flagCount} />}
        </>
      )}
    </svg>
  );
};
