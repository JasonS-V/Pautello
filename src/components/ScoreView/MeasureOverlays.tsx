import React from 'react';
import { Measure, Pitch, NoteDuration, NamingConvention } from '../../types/music';
import { PlaybackState } from '../../audio/player';
import { calculateItemPositions } from '../../engraver/beaming';
import { formatPitchName } from '../../constants/pitches';

// `ItemPosition` is not exported by engraver/layout; derive it from its producer.
type ItemPosition = ReturnType<typeof calculateItemPositions>[number];

export interface MeasureOverlaysProps {
  measure: Measure;
  actualMeasureIdx: number;
  availableMeasureWidth: number;
  systemBottomY: number;
  getStaffTopOffset: (sIdx: number) => number;
  stavesCount: number;
  lineSpacing: number;
  playbackState: PlaybackState;
  itemPositions: ItemPosition[];
  // Volta y repeticiones
  volta?: string;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  barline?: string;
  isLastMeasureOfScore?: boolean;
  // Ghost note
  ghostNote?: {
    isHovered: boolean;
    ghostPitch: Pitch | null;
    noteY: number;
    canFit: boolean;
    namingConvention: NamingConvention;
    activeDuration: NoteDuration;
    isRestMode: boolean;
  } | null;
}

const DURATION_LABELS: Record<NoteDuration, string> = {
  w: 'redonda',
  h: 'blanca',
  q: 'negra',
  '8': 'corchea',
  '16': 'semicorchea',
  '32': 'fusa',
};

interface BarDotsProps {
  x: number;
  staffTop: number;
  lineSpacing: number;
}

const BarDots: React.FC<BarDotsProps> = ({ x, staffTop, lineSpacing }) => (
  <>
    <circle
      cx={x}
      cy={staffTop + lineSpacing * 1.5}
      r="2"
      className="fill-current text-slate-900 dark:text-slate-100"
    />
    <circle
      cx={x}
      cy={staffTop + lineSpacing * 2.5}
      r="2"
      className="fill-current text-slate-900 dark:text-slate-100"
    />
  </>
);

const MeasureOverlaysComponent: React.FC<MeasureOverlaysProps> = ({
  measure,
  actualMeasureIdx,
  availableMeasureWidth,
  systemBottomY,
  getStaffTopOffset,
  stavesCount,
  lineSpacing,
  playbackState,
  itemPositions,
  volta,
  repeatStart,
  repeatEnd,
  barline,
  isLastMeasureOfScore,
  ghostNote,
}) => {
  const voltaText = volta ?? measure.volta;
  const hasRepeatStart = repeatStart ?? measure.repeatStart;
  const hasRepeatEnd = repeatEnd ?? measure.repeatEnd;
  const barlineType = barline ?? measure.barline;

  const displayStaves = Array.from({ length: Math.max(stavesCount, 1) }, (_, i) => i);
  const staffHeight = lineSpacing * 4;
  const firstTop = getStaffTopOffset(0);
  const lastBottom = getStaffTopOffset(displayStaves.length - 1) + staffHeight;
  const W = availableMeasureWidth;
  const ink = 'stroke-current text-slate-900 dark:text-slate-100';

  const renderGhost = () => {
    if (!ghostNote || !ghostNote.isHovered || !ghostNote.ghostPitch) return null;
    const { noteY, activeDuration, isRestMode, ghostPitch, namingConvention, canFit } = ghostNote;
    const label = `${formatPitchName(ghostPitch, namingConvention)} (${DURATION_LABELS[activeDuration]})`;
    const opacity = canFit ? 1 : 0.4;

    if (isRestMode) {
      const midY = getStaffTopOffset(0) + lineSpacing * 2;
      return (
        <g className="pointer-events-none" opacity={opacity}>
          <rect
            x={-6}
            y={midY - lineSpacing / 2}
            width="12"
            height={lineSpacing / 2}
            className="fill-blue-500/40 stroke-blue-600 stroke-[1.5]"
          />
          <text
            x="0"
            y={midY - lineSpacing * 2}
            textAnchor="middle"
            className="fill-current text-[10px] font-semibold text-slate-400 dark:text-slate-600"
          >
            {`Silencio (${DURATION_LABELS[activeDuration]})`}
          </text>
        </g>
      );
    }

    const stemUp = noteY > getStaffTopOffset(0) + lineSpacing * 2;
    return (
      <g className="pointer-events-none" opacity={opacity}>
        <ellipse
          cx="0"
          cy={noteY}
          rx="5.5"
          ry="4"
          className="fill-blue-500/40 stroke-blue-600 stroke-[1.5]"
        />
        {activeDuration !== 'w' && (
          <line
            x1={stemUp ? 5.5 : -5.5}
            y1={noteY}
            x2={stemUp ? 5.5 : -5.5}
            y2={stemUp ? noteY - lineSpacing * 3.5 : noteY + lineSpacing * 3.5}
            className="stroke-blue-600 stroke-[1.5]"
          />
        )}
        <text
          x="10"
          y={noteY - 8}
          className="fill-current text-[10px] font-semibold text-slate-400 dark:text-slate-600"
        >
          {label}
        </text>
      </g>
    );
  };

  const renderCursor = () => {
    if (!playbackState.isPlaying || playbackState.currentMeasureIndex !== actualMeasureIdx)
      return null;
    const cursorX = itemPositions[playbackState.currentItemIndex]?.x ?? 20;
    return (
      <line
        x1={cursorX}
        y1={firstTop - 6}
        x2={cursorX}
        y2={systemBottomY + 6}
        strokeWidth="2.5"
        className="pointer-events-none stroke-studio-accent"
      />
    );
  };

  const renderVolta = () => {
    if (!voltaText) return null;
    const top = firstTop;
    return (
      <g className="text-slate-900 dark:text-slate-100">
        <line x1={0} y1={top - 18} x2={W} y2={top - 18} strokeWidth="1.2" className={ink} />
        <line x1={0} y1={top - 18} x2={0} y2={top - 6} strokeWidth="1.2" className={ink} />
        {hasRepeatEnd && (
          <line x1={W} y1={top - 18} x2={W} y2={top - 6} strokeWidth="1.2" className={ink} />
        )}
        <text x={5} y={top - 21} className="fill-current font-serif text-[11px] font-bold">
          {voltaText}
        </text>
      </g>
    );
  };

  const renderStartBar = () => {
    if (!hasRepeatStart) return null;
    return (
      <g className="text-slate-900 dark:text-slate-100">
        <line x1={0} y1={firstTop} x2={0} y2={lastBottom} strokeWidth="3.2" className={ink} />
        <line x1={5} y1={firstTop} x2={5} y2={lastBottom} strokeWidth="1" className={ink} />
        {displayStaves.map((sIdx) => (
          <BarDots key={sIdx} x={10} staffTop={getStaffTopOffset(sIdx)} lineSpacing={lineSpacing} />
        ))}
      </g>
    );
  };

  const renderEndBar = () => {
    if (hasRepeatEnd) {
      return (
        <g className="text-slate-900 dark:text-slate-100">
          {displayStaves.map((sIdx) => (
            <BarDots
              key={sIdx}
              x={W - 10}
              staffTop={getStaffTopOffset(sIdx)}
              lineSpacing={lineSpacing}
            />
          ))}
          <line
            x1={W - 5}
            y1={firstTop}
            x2={W - 5}
            y2={lastBottom}
            strokeWidth="1"
            className={ink}
          />
          <line x1={W} y1={firstTop} x2={W} y2={lastBottom} strokeWidth="3.2" className={ink} />
        </g>
      );
    }
    if (barlineType === 'double') {
      return (
        <g className="text-slate-900 dark:text-slate-100">
          <line
            x1={W - 3.5}
            y1={firstTop}
            x2={W - 3.5}
            y2={lastBottom}
            strokeWidth="1"
            className={ink}
          />
          <line x1={W} y1={firstTop} x2={W} y2={lastBottom} strokeWidth="1" className={ink} />
        </g>
      );
    }
    if (barlineType === 'final' || isLastMeasureOfScore) {
      return (
        <g className="text-slate-900 dark:text-slate-100">
          <line
            x1={W - 5}
            y1={firstTop}
            x2={W - 5}
            y2={lastBottom}
            strokeWidth="1"
            className={ink}
          />
          <line x1={W} y1={firstTop} x2={W} y2={lastBottom} strokeWidth="3.2" className={ink} />
        </g>
      );
    }
    return (
      <line
        x1={W}
        y1={firstTop}
        x2={W}
        y2={lastBottom}
        strokeWidth="1"
        className="stroke-slate-400 dark:stroke-slate-600"
      />
    );
  };

  return (
    <g className="measure-overlays">
      {renderGhost()}
      {renderCursor()}
      {renderVolta()}
      {renderStartBar()}
      {renderEndBar()}
    </g>
  );
};

export const MeasureOverlays = React.memo(MeasureOverlaysComponent);
MeasureOverlays.displayName = 'MeasureOverlays';
