import React from 'react';
import {
  Score,
  Staff,
  Pitch,
  Accidental,
  ScoreItem,
  TimeSignature,
  NamingConvention,
  Clef,
  getItemPitches,
} from '../../types/music';
import { pitchToStaffStep, staffStepToY, getLedgerLines } from '../../engraver/engraverMath';
import { formatPitchName, pitchToMidi } from '../../constants/pitches';
import { SVG_PATHS } from '../../engraver/glyphPaths';
import { calculateItemPositions, detectBeamGroups, BeamedNoteInfo } from '../../engraver/beaming';
import { getFlagCount, getNoteFlagPath, getAccidentalLayout } from '../../engraver/notation';
import { PlaybackState } from '../../audio/player';
import { audioEngine } from '../../audio/synth';
import { RestNotation } from './RestNotation';
import { ScoreDragState } from './types';

export interface StaffItemsRendererProps {
  score: Score;
  primaryStaff: Staff;
  staffIdx: number;
  actualMeasureIdx: number;
  isSystemStart?: boolean;
  baseTopOffset: number;
  lineSpacing: number;
  staffHeight: number;
  availableMeasureWidth: number;
  selectedItemId: string | null;
  onSelectItem: (measureIdx: number, itemId: string | null, staffIdx?: number) => void;
  playbackState: PlaybackState;
  practiceTargetNote?: { measureIdx: number; itemIdx: number } | null;
  practiceHitResult?: 'correct' | 'incorrect' | null;
  dragState: ScoreDragState | null;
  onStartDrag?: (
    e: React.MouseEvent,
    item: ScoreItem,
    measureIdx: number,
    staffIdx: number
  ) => void;
  showNoteNames: boolean;
  namingConvention: NamingConvention;
  isEditingLyrics?: boolean;
  onUpdateLyric?: (lyric: string) => void;
  onCloseLyrics?: () => void;
  onNavigateNextItem?: () => void;
  onNavigatePreviousItem?: () => void;
  getMeasureTimeSignature: (measureIdx: number) => TimeSignature;
}

const StaffItemsRendererImpl: React.FC<StaffItemsRendererProps> = ({
  score,
  primaryStaff,
  staffIdx,
  actualMeasureIdx,
  isSystemStart,
  baseTopOffset,
  lineSpacing,
  staffHeight,
  availableMeasureWidth,
  selectedItemId,
  onSelectItem,
  playbackState,
  practiceTargetNote,
  practiceHitResult,
  dragState,
  onStartDrag,
  showNoteNames,
  namingConvention,
  isEditingLyrics,
  onUpdateLyric,
  onCloseLyrics,
  onNavigateNextItem,
  onNavigatePreviousItem,
  getMeasureTimeSignature,
}) => {
  const targetStaff = score.staves[staffIdx] || primaryStaff;
  const targetItems: ScoreItem[] = targetStaff?.measures[actualMeasureIdx]?.items ?? [];
  const targetClef: Clef = targetStaff?.clef || 'treble';
  const measureObj = (score.staves[staffIdx] || primaryStaff)?.measures[actualMeasureIdx];
  if (measureObj?.multimeasureRest && measureObj.multimeasureRest > 1) {
    const midX = availableMeasureWidth / 2;
    const midY = baseTopOffset + 2 * lineSpacing; // 3rd line of staff
    return (
      <g className="multimeasure-rest select-none" key={`tacet-${staffIdx}-${actualMeasureIdx}`}>
        {/* Thick horizontal H-bar */}
        <rect
          x={midX - 28}
          y={midY - 3.5}
          width={56}
          height={7}
          rx={1}
          className="fill-slate-800 dark:fill-slate-200"
        />
        {/* Left vertical serif line */}
        <line
          x1={midX - 28}
          y1={midY - 11}
          x2={midX - 28}
          y2={midY + 11}
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-slate-800 dark:text-slate-200"
        />
        {/* Right vertical serif line */}
        <line
          x1={midX + 28}
          y1={midY - 11}
          x2={midX + 28}
          y2={midY + 11}
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-slate-800 dark:text-slate-200"
        />
        {/* Number of measures above the bar */}
        <text
          x={midX}
          y={midY - 14}
          textAnchor="middle"
          className="text-sm font-black font-serif fill-slate-800 dark:fill-slate-200 select-none"
        >
          {measureObj.multimeasureRest}
        </text>
      </g>
    );
  }

  // El espaciado y el beameo siguen la métrica vigente en el compás, no la global.
  const measureTimeSignature = getMeasureTimeSignature(actualMeasureIdx);
  const measureInset = measureObj?.timeSignatureChange || measureObj?.keySignatureChange ? 28 : 0;
  const itemPositions = calculateItemPositions(
    targetItems,
    availableMeasureWidth - measureInset,
    measureTimeSignature
  ).map((position) => ({ ...position, x: position.x + measureInset }));
  const getItemX = (idx: number) => itemPositions[idx]?.x ?? 20 + idx * 40;

  const { beamGroups, beamedItemIndices } = detectBeamGroups(
    targetItems,
    itemPositions,
    targetClef,
    baseTopOffset,
    lineSpacing,
    measureTimeSignature
  );

  const beamedInfoMap = new Map<number, BeamedNoteInfo>();
  beamGroups.forEach((bg) => {
    bg.notes.forEach((bn) => {
      beamedInfoMap.set(bn.itemIdx, bn);
    });
  });

  // Detect tuplet groups
  const tupletGroups: {
    startIndex: number;
    endIndex: number;
    actual: number;
    normal: number;
  }[] = [];

  let currentTupletGroup: {
    startIndex: number;
    endIndex: number;
    actual: number;
    normal: number;
  } | null = null;

  targetItems.forEach((it, idx) => {
    if (it.tuplet) {
      if (!currentTupletGroup) {
        currentTupletGroup = {
          startIndex: idx,
          endIndex: idx,
          actual: it.tuplet.actual,
          normal: it.tuplet.normal,
        };
      } else if (
        currentTupletGroup.actual === it.tuplet.actual &&
        currentTupletGroup.normal === it.tuplet.normal
      ) {
        currentTupletGroup.endIndex = idx;
      } else {
        tupletGroups.push(currentTupletGroup);
        currentTupletGroup = {
          startIndex: idx,
          endIndex: idx,
          actual: it.tuplet.actual,
          normal: it.tuplet.normal,
        };
      }
    } else {
      if (currentTupletGroup) {
        tupletGroups.push(currentTupletGroup);
        currentTupletGroup = null;
      }
    }
  });
  if (currentTupletGroup) {
    tupletGroups.push(currentTupletGroup);
  }

  const renderedItems = targetItems.map((item, itemIdx) => {
    const itemX = getItemX(itemIdx);
    const isItemSelected = selectedItemId === item.id;
    const isItemPlaying =
      playbackState.isPlaying &&
      playbackState.currentMeasureIndex === actualMeasureIdx &&
      playbackState.currentItemIndex === itemIdx &&
      staffIdx === 0;

    if (item.type === 'rest') {
      const restY = baseTopOffset + 20;
      return (
        <g
          key={item.id}
          transform={`translate(${itemX}, 0)`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectItem(actualMeasureIdx, item.id, staffIdx);
          }}
          className="cursor-pointer group"
        >
          {isItemSelected && (
            <>
              <circle
                cx="0"
                cy={restY}
                r="14"
                fill="none"
                className="stroke-studio-selection no-print"
                strokeWidth="2"
                strokeDasharray="3 2"
              />
              {/* Visual Caret Bar */}
              <g className="pointer-events-none animate-pulse text-blue-600 dark:text-blue-400 no-print">
                <line
                  x1="12"
                  y1={baseTopOffset - 6}
                  x2="12"
                  y2={baseTopOffset + staffHeight + 6}
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <polygon
                  points={`12,${baseTopOffset - 6} 9,${baseTopOffset - 10} 15,${baseTopOffset - 10}`}
                  fill="currentColor"
                />
                <polygon
                  points={`12,${baseTopOffset + staffHeight + 6} 9,${baseTopOffset + staffHeight + 10} 15,${baseTopOffset + staffHeight + 10}`}
                  fill="currentColor"
                />
              </g>
            </>
          )}

          <RestNotation
            duration={item.duration}
            topOffset={baseTopOffset}
            isPlaying={isItemPlaying}
          />

          {item.articulation === 'fermata' && (
            <g
              className="rest-fermata pointer-events-none"
              transform={`translate(0, ${baseTopOffset - 11})`}
            >
              <path
                d="M -7 0 C -7 -8 7 -8 7 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="0" cy="-2.5" r="1.6" fill="currentColor" />
            </g>
          )}

          {item.isDotted && (
            <circle
              cx={item.duration === 'w' || item.duration === 'h' ? 12 : 11}
              cy={baseTopOffset + 15}
              r="2"
              className={isItemPlaying ? 'fill-studio-accent' : 'fill-current'}
            />
          )}

          {item.chord && (
            <text
              x="0"
              y={baseTopOffset - 18}
              textAnchor="middle"
              className="text-xs font-sans font-black fill-amber-600 dark:fill-pastel-amber select-none tracking-tight"
            >
              {item.chord}
            </text>
          )}
        </g>
      );
    }

    // Note item
    const itemPitches = getItemPitches(item);
    if (itemPitches.length === 0) return null;

    const isItemDragged = dragState?.itemId === item.id && dragState.hasMoved;

    // When dragging, use the live dragged pitch (and transpose chord notes proportionally)
    const effectivePitches = isItemDragged
      ? itemPitches.map((p, pIdx) => {
          if (pIdx === 0) return dragState.currentPitch;
          const deltaMidi =
            pitchToMidi(dragState.currentPitch) - pitchToMidi(dragState.initialPitch);
          const currentM = pitchToMidi(p);
          const newM = Math.max(12, Math.min(127, currentM + deltaMidi));
          const oct = Math.floor(newM / 12) - 1;
          const semi = ((newM % 12) + 12) % 12;
          const semiMap: { step: Pitch['step']; acc: Accidental }[] = [
            { step: 'C', acc: null },
            { step: 'C', acc: '#' },
            { step: 'D', acc: null },
            { step: 'E', acc: 'b' },
            { step: 'E', acc: null },
            { step: 'F', acc: null },
            { step: 'F', acc: '#' },
            { step: 'G', acc: null },
            { step: 'A', acc: 'b' },
            { step: 'A', acc: null },
            { step: 'B', acc: 'b' },
            { step: 'B', acc: null },
          ];
          return {
            step: semiMap[semi].step,
            octave: oct,
            accidental: semiMap[semi].acc,
          };
        })
      : itemPitches;

    // Calculate staffStep, noteY, ledgerLines for each pitch in the chord
    // Sort descending by staffStep (lowest note / largest staffStep first)
    const pitchInfos = effectivePitches
      .map((p) => {
        const staffStep = pitchToStaffStep(p, targetClef);
        const noteY = baseTopOffset + staffStepToY(staffStep, lineSpacing);
        const ledgerLines = getLedgerLines(staffStep);
        return { pitch: p, staffStep, noteY, ledgerLines };
      })
      .sort((a, b) => b.staffStep - a.staffStep);

    const avgStaffStep = pitchInfos.reduce((acc, pi) => acc + pi.staffStep, 0) / pitchInfos.length;

    const beamedNote = beamedInfoMap.get(itemIdx);
    const isBeamed = beamedItemIndices.has(itemIdx) && !!beamedNote;
    const stemUp = isBeamed ? beamedNote.stemUp : avgStaffStep > 4;

    // Notehead X offset to prevent collision on seconds (notes 1 staff step apart)
    const noteheadPositions = pitchInfos.map((pi, pIdx) => {
      let offsetX = 0;
      if (pIdx > 0) {
        const prev = pitchInfos[pIdx - 1];
        if (Math.abs(pi.staffStep - prev.staffStep) === 1) {
          offsetX = stemUp ? 11.5 : -11.5;
        }
      }
      return { ...pi, offsetX };
    });

    // Stem vertical bounds: spans from lowest notehead to highest notehead
    const minY = Math.min(...pitchInfos.map((pi) => pi.noteY));
    const maxY = Math.max(...pitchInfos.map((pi) => pi.noteY));
    const stemX = stemUp ? 5.8 : -5.8;
    const stemStartY = stemUp ? maxY : minY;
    const stemEndY = isBeamed ? beamedNote.stemEndY : stemUp ? minY - 30 : maxY + 30;

    // Collect deduplicated ledger lines
    const uniqueLedgerLines = Array.from(new Set(pitchInfos.flatMap((pi) => pi.ledgerLines)));

    const isPracticeTarget =
      practiceTargetNote?.measureIdx === actualMeasureIdx &&
      practiceTargetNote?.itemIdx === itemIdx &&
      staffIdx === 0;

    const dragDeltaX = isItemDragged ? dragState.currentX - dragState.startX : 0;

    return (
      <g
        key={item.id}
        transform={`translate(${itemX + dragDeltaX}, 0)`}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          onStartDrag?.(e, item, actualMeasureIdx, staffIdx);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (dragState?.hasMoved) return;
          onSelectItem(actualMeasureIdx, item.id, staffIdx);
          pitchInfos.forEach((pi) => {
            audioEngine.playMidi(pitchToMidi(pi.pitch), 0.35);
          });
        }}
        className={
          isItemDragged
            ? 'cursor-grabbing select-none'
            : 'cursor-grab active:cursor-grabbing group select-none'
        }
      >
        {/* Dragged Glow Ring */}
        {isItemDragged &&
          noteheadPositions.map((np, nIdx) => (
            <circle
              key={`drag-halo-${nIdx}`}
              cx={np.offsetX}
              cy={np.noteY}
              r="15"
              className="animate-pulse fill-studio-accent/20 stroke-studio-accent"
              strokeWidth="2.5"
            />
          ))}

        {/* Live pitch name tooltip while dragging */}
        {isItemDragged && (
          <g transform={`translate(0, ${minY - 24})`} className="pointer-events-none select-none">
            <rect
              x="-26"
              y="-10"
              width="52"
              height="18"
              rx="4"
              className="fill-studio-accent shadow-md"
            />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              className="text-[10px] font-sans font-extrabold fill-white tracking-tight"
            >
              {formatPitchName(dragState.currentPitch, namingConvention)}
            </text>
          </g>
        )}
        {/* Selected Halo Ring */}
        {isItemSelected &&
          noteheadPositions.map((np, nIdx) => (
            <circle
              key={`halo-${nIdx}`}
              cx={np.offsetX}
              cy={np.noteY}
              r="13"
              fill="none"
              className="animate-pulse stroke-studio-accent no-print"
              strokeWidth="2.5"
            />
          ))}

        {/* Insertion Caret cursor */}
        {isItemSelected && (
          <g className="pointer-events-none animate-pulse text-blue-600 dark:text-blue-400 no-print">
            <line
              x1={stemUp ? 14 : 12}
              y1={baseTopOffset - 6}
              x2={stemUp ? 14 : 12}
              y2={baseTopOffset + staffHeight + 6}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <polygon
              points={`${stemUp ? 14 : 12},${baseTopOffset - 6} ${(stemUp ? 14 : 12) - 3},${baseTopOffset - 10} ${(stemUp ? 14 : 12) + 3},${baseTopOffset - 10}`}
              fill="currentColor"
            />
            <polygon
              points={`${stemUp ? 14 : 12},${baseTopOffset + staffHeight + 6} ${(stemUp ? 14 : 12) - 3},${baseTopOffset + staffHeight + 10} ${(stemUp ? 14 : 12) + 3},${baseTopOffset + staffHeight + 10}`}
              fill="currentColor"
            />
          </g>
        )}

        {/* Practice Target Ring */}
        {isPracticeTarget && (
          <g className="pointer-events-none">
            <circle
              cx="0"
              cy={minY}
              r="18"
              fill="none"
              className={`animate-ping opacity-75 ${
                practiceHitResult === 'correct'
                  ? 'stroke-studio-success'
                  : practiceHitResult === 'incorrect'
                    ? 'stroke-studio-dangerStrong'
                    : 'stroke-pastel-limeDark'
              }`}
              strokeWidth="3"
            />
            <circle
              cx="0"
              cy={minY}
              r="15"
              fill="none"
              className={`${practiceHitResult === 'correct' ? 'stroke-studio-success' : practiceHitResult === 'incorrect' ? 'stroke-studio-dangerStrong' : 'stroke-pastel-lime'}`}
              strokeWidth="2"
            />
          </g>
        )}

        {/* Ledger lines */}
        {uniqueLedgerLines.map((lineY, lIdx) => (
          <line
            key={`ledger-${lIdx}`}
            x1="-10"
            y1={baseTopOffset + lineY * lineSpacing}
            x2="10"
            y2={baseTopOffset + lineY * lineSpacing}
            stroke="currentColor"
            strokeWidth="1.2"
          />
        ))}

        {/* Accidental Glyphs for Chord Notes */}
        {noteheadPositions.map((np, nIdx) => {
          if (!np.pitch.accidental) return null;
          const rightAnchor =
            np.offsetX - 8.5 - (nIdx % 2 === 1 && noteheadPositions.length > 1 ? 6 : 0);
          const accLayout = getAccidentalLayout(np.pitch.accidental, rightAnchor, np.noteY);
          return (
            <svg
              key={`acc-${nIdx}`}
              x={accLayout.x}
              y={accLayout.y}
              width={accLayout.width}
              height={accLayout.height}
              viewBox={accLayout.glyph.viewBox}
              className="pointer-events-none select-none fill-current text-slate-900 dark:text-slate-100"
              aria-hidden="true"
            >
              <path d={accLayout.glyph.d} fill="currentColor" />
            </svg>
          );
        })}

        {/* Noteheads for Chord Notes */}
        {noteheadPositions.map((np, nIdx) => {
          if (item.noteType === 'slash') {
            return (
              <line
                key={`notehead-${nIdx}`}
                x1={np.offsetX - 6}
                y1={np.noteY + 7}
                x2={np.offsetX + 6}
                y2={np.noteY - 7}
                strokeWidth="3.2"
                strokeLinecap="square"
                className={`group-hover:opacity-80 transition-opacity ${
                  isItemPlaying ? 'stroke-studio-accent' : 'stroke-current'
                }`}
              />
            );
          }
          const isGrace = item.noteType === 'grace';
          return (
            <ellipse
              key={`notehead-${nIdx}`}
              cx={np.offsetX}
              cy={np.noteY}
              rx={isGrace ? '4.5' : '6.5'}
              ry={isGrace ? '3.0' : '4.5'}
              transform={`rotate(-22 ${np.offsetX} ${np.noteY})`}
              strokeWidth={item.duration === 'w' || item.duration === 'h' ? '2.5' : '1'}
              className={`group-hover:opacity-80 transition-opacity ${
                isPracticeTarget && practiceHitResult === 'correct'
                  ? 'fill-studio-success stroke-studio-success'
                  : isPracticeTarget && practiceHitResult === 'incorrect'
                    ? 'fill-studio-dangerStrong stroke-studio-dangerStrong'
                    : isItemPlaying
                      ? 'fill-studio-accent stroke-studio-accent'
                      : item.duration === 'w' || item.duration === 'h'
                        ? 'fill-none stroke-current'
                        : 'fill-current stroke-current'
              }`}
            />
          );
        })}

        {/* Common Stem for Chord */}
        {item.duration !== 'w' && (
          <>
            <line
              x1={stemX}
              y1={stemStartY}
              x2={stemX}
              y2={stemEndY}
              className={isItemPlaying ? 'stroke-studio-accent' : 'stroke-current'}
              strokeWidth="1.5"
            />
            {/* Acciaccatura stroke through stem */}
            {item.noteType === 'grace' && item.graceType === 'acciaccatura' && (
              <line
                x1={stemX - 4}
                y1={stemEndY + (stemUp ? 6 : -6)}
                x2={stemX + 6}
                y2={stemEndY + (stemUp ? -2 : 2)}
                className={isItemPlaying ? 'stroke-studio-accent' : 'stroke-current'}
                strokeWidth="1.4"
              />
            )}
          </>
        )}

        {/* Flag(s) - Only drawn when note is NOT beamed. El recuento y la
              geometría de las plicas viven en engraver/notation.ts */}
        {!isBeamed &&
          Array.from({ length: getFlagCount(item.duration) }, (_, flagIndex) => (
            <path
              key={flagIndex}
              d={getNoteFlagPath(stemX, stemEndY, stemUp, flagIndex)}
              className={isItemPlaying ? 'stroke-studio-accent' : 'stroke-current'}
              strokeWidth="2.5"
              fill="none"
            />
          ))}

        {/* Dotted Note Dot */}
        {item.isDotted && (
          <circle
            cx="10"
            cy={minY - 1}
            r="2"
            className={isItemPlaying ? 'fill-studio-accent' : 'fill-current'}
          />
        )}

        {/* Pedagogical Note Label(s) */}
        {showNoteNames &&
          (() => {
            const labelText = pitchInfos
              .map((pi) => formatPitchName(pi.pitch, namingConvention))
              .reverse()
              .join('/');
            const labelWidth = Math.max(22, labelText.length * 6.5 + 8);
            const noteTopY = stemUp && item.duration !== 'w' ? Math.min(minY, stemEndY) : minY;
            const labelY = noteTopY - 14;

            return (
              <g transform={`translate(0, ${labelY})`} className="no-print">
                <rect
                  x={-labelWidth / 2}
                  y={-7}
                  width={labelWidth}
                  height={14}
                  rx={3}
                  className="fill-white/95 stroke-blue-200/80 stroke-[0.5]"
                />
                <text
                  x="0"
                  y="1"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[9px] font-bold fill-blue-600 select-none pointer-events-none"
                >
                  {labelText}
                </text>
              </g>
            );
          })()}

        {/* Lyrics beneath staff */}
        {isEditingLyrics && item.id === selectedItemId ? (
          <foreignObject
            x="-32"
            y={baseTopOffset + staffHeight + 10}
            width="64"
            height="22"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              aria-label="Letra de la nota"
              autoFocus
              defaultValue={item.lyric ?? ''}
              onChange={(e) => onUpdateLyric?.(e.target.value)}
              onBlur={() => onCloseLyrics?.()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  onCloseLyrics?.();
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  if (e.shiftKey) onNavigatePreviousItem?.();
                  else onNavigateNextItem?.();
                }
              }}
              className="w-full h-full px-1 text-center text-[11px] font-serif italic bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-amber-500 rounded-sm outline-none"
            />
          </foreignObject>
        ) : (
          item.lyric && (
            <text
              x="0"
              y={baseTopOffset + staffHeight + 25}
              textAnchor="middle"
              className="text-[11px] font-serif italic fill-slate-800 dark:fill-slate-200 select-none"
            >
              {item.lyric}
            </text>
          )
        )}

        {/* Chord symbol above staff */}
        {item.chord && (
          <text
            x="0"
            y={baseTopOffset - 18}
            textAnchor="middle"
            className="text-xs font-sans font-black fill-amber-600 dark:fill-pastel-amber select-none tracking-tight"
          >
            {item.chord}
          </text>
        )}

        {/* Articulation Symbol */}
        {item.articulation &&
          (() => {
            const artY =
              item.articulation === 'fermata'
                ? Math.min(minY - 14, baseTopOffset - 12)
                : stemUp
                  ? maxY + 12
                  : minY - 12;

            if (item.articulation === 'staccato') {
              return <circle cx="0" cy={artY} r="2.2" fill="currentColor" />;
            }
            if (item.articulation === 'accent') {
              return (
                <path
                  d={`M -5.5 ${artY - 3} L 5 ${artY} L -5.5 ${artY + 3}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            if (item.articulation === 'tenuto') {
              return (
                <line
                  x1="-6"
                  y1={artY}
                  x2="6"
                  y2={artY}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              );
            }
            if (item.articulation === 'marcato') {
              const marcY = stemUp ? maxY + 14 : minY - 14;
              return (
                <path
                  d={`M -4.5 ${marcY + 4} L 0 ${marcY - 3} L 4.5 ${marcY + 4}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            if (item.articulation === 'staccatissimo') {
              const staccY = stemUp ? maxY + 12 : minY - 12;
              return (
                <polygon
                  points={
                    stemUp
                      ? `0,${staccY + 6} -2.5,${staccY} 2.5,${staccY}`
                      : `0,${staccY - 6} -2.5,${staccY} 2.5,${staccY}`
                  }
                  fill="currentColor"
                />
              );
            }
            if (item.articulation === 'portato') {
              return (
                <g>
                  <line
                    x1="-5.5"
                    y1={artY}
                    x2="5.5"
                    y2={artY}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle cx="0" cy={stemUp ? artY + 5 : artY - 5} r="1.8" fill="currentColor" />
                </g>
              );
            }
            if (item.articulation === 'downBow') {
              const bowY = minY - 16;
              return (
                <path
                  d={`M -4.5 ${bowY + 6} L -4.5 ${bowY} L 4.5 ${bowY} L 4.5 ${bowY + 6}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="square"
                />
              );
            }
            if (item.articulation === 'upBow') {
              const bowY = minY - 16;
              return (
                <path
                  d={`M -4.5 ${bowY} L 0 ${bowY + 7} L 4.5 ${bowY}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            if (item.articulation === 'harmonic') {
              const harmY = minY - 16;
              return (
                <circle
                  cx="0"
                  cy={harmY}
                  r="3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              );
            }
            if (item.articulation === 'fermata') {
              return (
                <g transform={`translate(0, ${artY})`}>
                  <path
                    d="M -7 0 C -7 -8 7 -8 7 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <circle cx="0" cy="-2.5" r="1.6" fill="currentColor" />
                </g>
              );
            }
            return null;
          })()}

        {/* Ornaments */}
        {item.ornament === 'trill' && (
          <text
            x="0"
            y={minY - 14}
            textAnchor="middle"
            className="font-serif italic font-bold text-xs fill-slate-800 dark:fill-slate-200 select-none"
          >
            tr
          </text>
        )}
        {item.ornament === 'mordent' && (
          <g
            transform={`translate(0, ${minY - 14}) scale(0.75)`}
            className="fill-current text-slate-800 dark:text-slate-200"
          >
            <path d={SVG_PATHS.mordent} stroke="currentColor" strokeWidth="1.6" fill="none" />
          </g>
        )}
        {item.ornament === 'turn' && (
          <g
            transform={`translate(0, ${minY - 14}) scale(0.85)`}
            className="fill-current text-slate-800 dark:text-slate-200"
          >
            <path d={SVG_PATHS.turn} stroke="currentColor" strokeWidth="1.6" fill="none" />
          </g>
        )}
        {item.ornament === 'arpeggio' && (
          <g className="text-slate-800 dark:text-slate-200">
            <path
              d={`M -14 ${minY} Q -17 ${(minY + maxY) / 2} -14 ${maxY}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeDasharray="2 2"
            />
          </g>
        )}

        {/* Fingering number */}
        {item.fingering && (
          <text
            x="0"
            y={stemUp && item.duration !== 'w' ? minY - 16 : maxY + 18}
            textAnchor="middle"
            className="text-[10px] font-sans font-bold fill-slate-700 dark:fill-slate-300 select-none"
          >
            {item.fingering}
          </text>
        )}

        {/* Piano Pedal Markings */}
        {item.pedal === 'start' && (
          <text
            x="0"
            y={baseTopOffset + staffHeight + 36}
            textAnchor="middle"
            className="text-[11px] font-serif font-black italic fill-slate-800 dark:fill-slate-200 select-none"
          >
            Ped.
          </text>
        )}
        {item.pedal === 'stop' && (
          <text
            x="0"
            y={baseTopOffset + staffHeight + 36}
            textAnchor="middle"
            className="text-sm font-serif font-bold fill-slate-800 dark:fill-slate-200 select-none"
          >
            *
          </text>
        )}

        {/* Dynamic Mark beneath staff */}
        {item.dynamic && (
          <text
            x="0"
            y={baseTopOffset + 4 * lineSpacing + 20}
            textAnchor="middle"
            className="font-serif italic font-black text-xs fill-slate-800 dark:fill-slate-200 select-none tracking-tighter"
          >
            {item.dynamic}
          </text>
        )}
      </g>
    );
  });

  const renderedTupletBrackets = tupletGroups.map((tg, tgIdx) => {
    const x1 = getItemX(tg.startIndex);
    const x2 = getItemX(tg.endIndex);

    let minY = baseTopOffset;
    for (let i = tg.startIndex; i <= tg.endIndex; i++) {
      const it = targetItems[i];
      if (it?.pitch) {
        const step = pitchToStaffStep(it.pitch, targetClef);
        const y = baseTopOffset + staffStepToY(step, lineSpacing);
        if (y < minY) minY = y;
      }
    }
    const bracketY = Math.min(baseTopOffset - 8, minY - 24);
    const midX = (x1 + x2) / 2;

    if (tg.startIndex === tg.endIndex) {
      return (
        <g
          key={`tuplet-${actualMeasureIdx}-${staffIdx}-${tgIdx}`}
          className="pointer-events-none select-none"
        >
          <text
            x={x1}
            y={bracketY + 2}
            textAnchor="middle"
            className="text-[11px] font-serif font-bold italic fill-slate-700 dark:fill-slate-200"
          >
            {tg.actual}
          </text>
        </g>
      );
    }

    const textGap = 7;
    const leftEnd = midX - textGap;
    const rightStart = midX + textGap;

    return (
      <g
        key={`tuplet-${actualMeasureIdx}-${staffIdx}-${tgIdx}`}
        className="pointer-events-none select-none text-slate-700 dark:text-slate-200"
      >
        <line
          x1={x1 - 6}
          y1={bracketY + 4}
          x2={x1 - 6}
          y2={bracketY}
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <line
          x1={x1 - 6}
          y1={bracketY}
          x2={leftEnd}
          y2={bracketY}
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <text
          x={midX}
          y={bracketY + 3.5}
          textAnchor="middle"
          className="text-[11px] font-serif font-bold italic fill-current"
        >
          {tg.actual}
        </text>
        <line
          x1={rightStart}
          y1={bracketY}
          x2={x2 + 6}
          y2={bracketY}
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <line
          x1={x2 + 6}
          y1={bracketY}
          x2={x2 + 6}
          y2={bracketY + 4}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </g>
    );
  });

  const renderedBeams = beamGroups.map((bg) => (
    <g
      key={`bg-${actualMeasureIdx}-${staffIdx}-${bg.id}`}
      className="pointer-events-none select-none text-slate-900 dark:text-slate-100"
    >
      {/* Primary beam bar */}
      <line
        x1={bg.x1}
        y1={bg.y1}
        x2={bg.x2}
        y2={bg.y2}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="butt"
      />
      {/* Secondary beams for 16th and 32nd notes */}
      {bg.secondaryBeams.map((sb, sbIdx) => (
        <line
          key={`sec-${actualMeasureIdx}-${staffIdx}-${bg.id}-${sbIdx}`}
          x1={sb.x1}
          y1={sb.y1}
          x2={sb.x2}
          y2={sb.y2}
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="butt"
        />
      ))}
    </g>
  ));

  const renderedTiesAndSlurs: React.ReactNode[] = [];

  if (isSystemStart && targetItems[0]?.type === 'note') {
    const previousMeasure = targetStaff.measures[actualMeasureIdx - 1];
    const previous = [...(previousMeasure?.items ?? [])]
      .reverse()
      .find((it) => (it.voice || 1) === (targetItems[0].voice || 1));
    if (previous?.isTied) {
      getItemPitches(targetItems[0]).forEach((pitch, index) => {
        if (
          !getItemPitches(previous).some(
            (p) =>
              p.step === pitch.step &&
              p.octave === pitch.octave &&
              p.accidental === pitch.accidental
          )
        )
          return;
        const y =
          baseTopOffset + staffStepToY(pitchToStaffStep(pitch, targetClef), lineSpacing) + 4;
        const endX = Math.max(18, getItemX(0) - 5);
        renderedTiesAndSlurs.push(
          <path
            key={`incoming-tie-${index}`}
            d={`M 1 ${y} Q ${endX / 2} ${y + 10} ${endX} ${y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="pointer-events-none"
          />
        );
      });
    }
  }

  targetItems.forEach((item, itemIdx) => {
    if (item.type !== 'note') return;
    if (!item.isTied && item.slur !== 'start') return;

    const itemX = getItemX(itemIdx);
    const currentP = getItemPitches(item);
    if (currentP.length === 0) return;

    // Determine destination item and x2
    let destItem: ScoreItem | null = null;
    let destX = itemX + 35; // default fallback
    if (itemIdx + 1 < targetItems.length) {
      destItem = targetItems[itemIdx + 1];
      destX = getItemX(itemIdx + 1);
    } else {
      // Next measure in this staff
      const nextMeasure = (score.staves[staffIdx] || primaryStaff)?.measures[actualMeasureIdx + 1];
      if (nextMeasure && nextMeasure.items.length > 0) {
        destItem = nextMeasure.items[0];
        destX = availableMeasureWidth + 16;
      } else {
        destX = availableMeasureWidth + 12;
      }
    }

    const beamedNote = beamedInfoMap.get(itemIdx);
    const isBeamed = beamedItemIndices.has(itemIdx) && !!beamedNote;
    const avgStep =
      currentP.reduce((s, p) => s + pitchToStaffStep(p, targetClef), 0) / currentP.length;
    const stemUp = isBeamed ? beamedNote.stemUp : avgStep > 4;

    if (item.isTied) {
      currentP.forEach((p, pIdx) => {
        const step = pitchToStaffStep(p, targetClef);
        const y1 = baseTopOffset + staffStepToY(step, lineSpacing);
        let y2 = y1;
        if (destItem && destItem.type === 'note') {
          const destP = getItemPitches(destItem);
          const matching =
            destP.find(
              (dp) => dp.step === p.step && dp.octave === p.octave && dp.accidental === p.accidental
            ) || destP[0];
          if (matching) {
            const destStep = pitchToStaffStep(matching, targetClef);
            y2 = baseTopOffset + staffStepToY(destStep, lineSpacing);
          }
        }

        const startX = itemX + 5;
        const endX = Math.max(startX + 14, destX - 5);
        const midX = (startX + endX) / 2;
        const arcOffset = stemUp ? 9 : -9;
        const ctrlY = (y1 + y2) / 2 + arcOffset;

        renderedTiesAndSlurs.push(
          <path
            key={`tie-${actualMeasureIdx}-${staffIdx}-${item.id}-${pIdx}`}
            d={`M ${startX} ${y1 + (stemUp ? 3.5 : -3.5)} Q ${midX} ${ctrlY} ${endX} ${y2 + (stemUp ? 3.5 : -3.5)}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="pointer-events-none select-none text-slate-800 dark:text-slate-200"
          />
        );
      });
    }

    if (item.slur === 'start') {
      let endIdx = itemIdx + 1;
      while (endIdx < targetItems.length && targetItems[endIdx].slur !== 'stop') {
        endIdx++;
      }
      const stopItem = targetItems[Math.min(endIdx, targetItems.length - 1)];
      const slurEndX = endIdx < targetItems.length ? getItemX(endIdx) : availableMeasureWidth + 14;

      const startStep = pitchToStaffStep(currentP[0], targetClef);
      const y1 = baseTopOffset + staffStepToY(startStep, lineSpacing);
      let y2 = y1;
      if (stopItem && stopItem.type === 'note') {
        const stopP = getItemPitches(stopItem)[0];
        if (stopP) {
          y2 = baseTopOffset + staffStepToY(pitchToStaffStep(stopP, targetClef), lineSpacing);
        }
      }

      const startX = itemX + 5;
      const endX = Math.max(startX + 20, slurEndX - 5);
      const midX = (startX + endX) / 2;
      const slurArcOffset = stemUp
        ? Math.max(14, (endX - startX) * 0.18)
        : -Math.max(14, (endX - startX) * 0.18);
      const ctrlY = (y1 + y2) / 2 + slurArcOffset;

      renderedTiesAndSlurs.push(
        <path
          key={`slur-${actualMeasureIdx}-${staffIdx}-${item.id}`}
          d={`M ${startX} ${y1 + (stemUp ? 5 : -5)} Q ${midX} ${ctrlY} ${endX} ${y2 + (stemUp ? 5 : -5)}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="pointer-events-none select-none text-slate-800 dark:text-slate-200"
        />
      );
    }
  });

  const renderedHairpins: React.ReactNode[] = [];
  targetItems.forEach((item, idx) => {
    if (item.hairpin === 'cresc' || item.hairpin === 'decresc') {
      const startX = getItemX(idx);
      let endIdx = idx + 1;
      while (endIdx < targetItems.length && targetItems[endIdx].hairpin !== 'stop') {
        endIdx++;
      }
      const endX = endIdx < targetItems.length ? getItemX(endIdx) : availableMeasureWidth - 10;
      const hpY = baseTopOffset + staffHeight + 18;
      const isCresc = item.hairpin === 'cresc';

      renderedHairpins.push(
        <g
          key={`hairpin-${actualMeasureIdx}-${staffIdx}-${item.id}`}
          className="text-slate-800 dark:text-slate-200 pointer-events-none select-none"
        >
          {isCresc ? (
            <>
              <line
                x1={startX}
                y1={hpY}
                x2={endX}
                y2={hpY - 5}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <line
                x1={startX}
                y1={hpY}
                x2={endX}
                y2={hpY + 5}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <line
                x1={startX}
                y1={hpY - 5}
                x2={endX}
                y2={hpY}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <line
                x1={startX}
                y1={hpY + 5}
                x2={endX}
                y2={hpY}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </>
          )}
        </g>
      );
    }
  });

  return (
    <React.Fragment key={`staff-group-${staffIdx}-${actualMeasureIdx}`}>
      {renderedItems}
      {renderedBeams}
      {renderedTupletBrackets}
      {renderedTiesAndSlurs}
      {renderedHairpins}
    </React.Fragment>
  );
};

export const StaffItemsRenderer = React.memo(StaffItemsRendererImpl);
StaffItemsRenderer.displayName = 'StaffItemsRenderer';
