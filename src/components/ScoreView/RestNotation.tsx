import React from 'react';
import { NoteDuration } from '../../types/music';
import { getRestGlyph } from '../../engraver/notation';

export interface RestNotationProps {
  duration: NoteDuration;
  topOffset: number;
  isPlaying: boolean;
}

/**
 * Silencio de una figura: bloque para la redonda/blanca y glifo (con las plicas
 * apiladas) para el resto. La decisión vive en engraver/notation.ts.
 */
export const RestNotation: React.FC<RestNotationProps> = React.memo(
  ({ duration, topOffset, isPlaying }) => {
    const glyph = getRestGlyph(duration);
    const colorClass = isPlaying ? 'fill-amber-500' : 'fill-current';

    if (glyph.kind === 'block') {
      return (
        <rect
          x={-glyph.width / 2}
          y={topOffset + glyph.offsetY}
          width={glyph.width}
          height={glyph.height}
          fill="currentColor"
          className={colorClass}
        />
      );
    }

    return (
      <g
        transform={`translate(${glyph.offsetX}, ${topOffset + glyph.offsetY}) scale(${glyph.scale})`}
        className={colorClass}
      >
        {glyph.strokes.map((stroke, index) => (
          <path
            key={index}
            d={glyph.path}
            transform={
              stroke.dx === 0 && stroke.dy === 0
                ? undefined
                : `translate(${stroke.dx}, ${stroke.dy})`
            }
          />
        ))}
      </g>
    );
  }
);

RestNotation.displayName = 'RestNotation';
