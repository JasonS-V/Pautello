import React from 'react';
import { TIME_SIG_GLYPHS } from '../../engraver/glyphPaths';

export interface TimeSignatureGlyphsProps {
  beats: number | string;
  beatType: number | string;
  centerX: number;
  staffTop: number;
  keyPrefix?: string;
}

/** 720 font units = 2 staff spaces = 20px */
const FONT_SCALE = 20 / 720;
const DIGIT_GAP = 0.8;

/**
 * Renders SMuFL Bravura vector time signature glyphs (classical music engraving).
 * Numerator digit(s) sit between line 5 (top) and line 3 (middle) (height = 20px).
 * Denominator digit(s) sit between line 3 (middle) and line 1 (bottom) (height = 20px).
 */
export function renderTimeSignatureGlyphs(
  beats: number | string,
  beatType: number | string,
  centerX: number,
  staffTop: number,
  keyPrefix: string = 'ts'
): React.ReactNode {
  const beatsStr = String(beats);
  if (beatsStr === 'C' || beatsStr === 'c' || beatsStr === 'cutC' || beatsStr === 'allaBreve') {
    const isCut = beatsStr === 'cutC' || beatsStr === 'allaBreve';
    const glyph = TIME_SIG_GLYPHS[isCut ? 'cutC' : 'C'];
    if (glyph) {
      const w = glyph.width * FONT_SCALE;
      const y = isCut ? staffTop + 20 - (glyph.height * FONT_SCALE) / 2 : staffTop + 10;
      return (
        <g
          key={keyPrefix}
          className="time-signature select-none pointer-events-none text-slate-900 dark:text-slate-100"
        >
          <g transform={`translate(${centerX - w / 2}, ${y}) scale(${FONT_SCALE})`}>
            <path d={glyph.d} fill="currentColor" />
          </g>
        </g>
      );
    }
  }

  const renderDigitGroup = (val: number | string, groupY: number, subKey: string) => {
    const items: { d: string; xOffset: number }[] = [];
    let totalWidth = 0;

    for (const ch of String(val)) {
      const glyph = TIME_SIG_GLYPHS[ch];
      if (glyph) {
        items.push({ d: glyph.d, xOffset: totalWidth });
        totalWidth += glyph.width * FONT_SCALE + DIGIT_GAP;
      }
    }

    if (items.length === 0) {
      return (
        <text
          key={`${keyPrefix}-${subKey}-fallback`}
          x={centerX}
          y={groupY + 16}
          textAnchor="middle"
          className="font-serif font-bold text-[17px] fill-current"
        >
          {val}
        </text>
      );
    }
    totalWidth -= DIGIT_GAP;

    return (
      <g key={`${keyPrefix}-${subKey}`} transform={`translate(${centerX - totalWidth / 2}, ${groupY})`}>
        {items.map((item, idx) => (
          <g
            key={`${keyPrefix}-${subKey}-${idx}`}
            transform={`translate(${item.xOffset}, 0) scale(${FONT_SCALE})`}
          >
            <path d={item.d} fill="currentColor" />
          </g>
        ))}
      </g>
    );
  };

  return (
    <g
      key={keyPrefix}
      className="time-signature select-none pointer-events-none text-slate-900 dark:text-slate-100"
    >
      {renderDigitGroup(beats, staffTop, 'num')}
      {renderDigitGroup(beatType, staffTop + 20, 'den')}
    </g>
  );
}

export const TimeSignatureGlyphs: React.FC<TimeSignatureGlyphsProps> = React.memo(
  ({ beats, beatType, centerX, staffTop, keyPrefix }) => (
    <>{renderTimeSignatureGlyphs(beats, beatType, centerX, staffTop, keyPrefix)}</>
  )
);

TimeSignatureGlyphs.displayName = 'TimeSignatureGlyphs';
