import React, { useState, useRef } from 'react';
import {
  Score,
  Clef,
  Pitch,
  ScoreItem,
  NoteDuration,
  Accidental,
  NamingConvention,
} from '../../types/music';
import {
  pitchToStaffStep,
  staffStepToY,
  yToStaffStep,
  staffStepToPitch,
  getLedgerLines,
} from '../../engraver/engraverMath';
import {
  formatPitchName,
  KEY_SIGNATURE_DATA,
  pitchToMidi,
} from '../../constants/pitches';
import { SVG_PATHS } from '../../engraver/glyphPaths';
import { PlaybackState } from '../../audio/player';
import { audioEngine } from '../../audio/synth';
import { pitchToGuitarTab } from '../../utils/guitarTab';

interface ScoreViewProps {
  score: Score;
  selectedItemId: string | null;
  selectedMeasureIdx: number;
  selectedStaffIdx?: number;
  onSelectItem: (measureIdx: number, itemId: string | null, staffIdx?: number) => void;
  onInsertNoteAt: (measureIdx: number, pitch: Pitch, staffIdx?: number) => void;
  onInsertRestAt: (measureIdx: number, staffIdx?: number) => void;
  onDeleteMeasure: (idx: number) => void;
  activeDuration: NoteDuration;
  activeAccidental: Accidental;
  isRestMode: boolean;
  namingConvention: NamingConvention;
  showNoteNames: boolean;
  showTablature?: boolean;
  practiceTargetNote?: { measureIdx: number; itemIdx: number } | null;
  practiceHitResult?: 'correct' | 'incorrect' | null;
  playbackState: PlaybackState;
}

export const ScoreView: React.FC<ScoreViewProps> = ({
  score,
  selectedItemId,
  selectedMeasureIdx,
  selectedStaffIdx = 0,
  onSelectItem,
  onInsertNoteAt,
  onInsertRestAt,
  onDeleteMeasure,
  activeAccidental,
  isRestMode,
  namingConvention,
  showNoteNames,
  showTablature = false,
  practiceTargetNote = null,
  practiceHitResult = null,
  playbackState,
}) => {
  const [hoveredMeasureIdx, setHoveredMeasureIdx] = useState<number | null>(null);
  const [hoveredStaffStep, setHoveredStaffStep] = useState<number | null>(null);
  const [hoveredStaffIdx, setHoveredStaffIdx] = useState<number>(0);
  const [hoveredX, setHoveredX] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const primaryStaff = score.staves[0] || {
    id: 'staff-1',
    name: 'Voz',
    clef: 'treble' as Clef,
    measures: [],
  };
  const isGrandStaff = score.staves.length > 1;
  const lowerStaff = score.staves[1];

  const lineSpacing = 10;
  const staffHeight = 40;
  const staffTopOffset = 60; // Top padding for title & tempo
  const lowerStaffTopOffset = staffTopOffset + staffHeight + 45; // 145px (Middle C in classical grand staff sits at y=122.5)

  const systemHeight = isGrandStaff
    ? showTablature
      ? 310
      : 240
    : showTablature
    ? 215
    : 150;

  const tabTopOffset = isGrandStaff
    ? lowerStaffTopOffset + staffHeight + 35
    : staffTopOffset + staffHeight + 35;
  const tabLineSpacing = 7.5;

  // Group measures into systems (lines of score). E.g. 3 measures per line
  const measuresPerSystem = 3;
  const totalMeasures = primaryStaff.measures.length;
  const systemCount = Math.ceil(totalMeasures / measuresPerSystem);

  const keyData = KEY_SIGNATURE_DATA[score.keySignature] || { accidentals: 0, type: 'none' };

  // Calculate Key Signature sharp/flat vertical steps
  const getKeySignatureOffsets = (clef: Clef) => {
    const offsets: { step: number; type: '#' | 'b' }[] = [];
    if (keyData.type === '#') {
      const sharpStepsTreble = [0, 3, -1, 2, 5, 1, 4]; // F5, C5, G5, D5, A4, E5, B4
      const sharpStepsBass = [2, 5, 1, 4, 7, 3, 6];
      const sharpStepsAlto = [-1, 2, 5, 1, 4, 0, 3];
      const sourceSteps =
        clef === 'bass' ? sharpStepsBass : clef === 'alto' ? sharpStepsAlto : sharpStepsTreble;
      for (let i = 0; i < keyData.accidentals; i++) {
        offsets.push({ step: sourceSteps[i], type: '#' });
      }
    } else if (keyData.type === 'b') {
      const flatStepsTreble = [4, 1, 5, 2, 6, 3, 7]; // B4, E5, A4, D5, G4, C5, F4
      const flatStepsBass = [6, 3, 7, 4, 8, 5, 9];
      const flatStepsAlto = [3, 0, 4, 1, 5, 2, 6];
      const sourceSteps =
        clef === 'bass' ? flatStepsBass : clef === 'alto' ? flatStepsAlto : flatStepsTreble;
      for (let i = 0; i < keyData.accidentals; i++) {
        offsets.push({ step: sourceSteps[i], type: 'b' });
      }
    }
    return offsets;
  };

  const keyOffsetsTreble = getKeySignatureOffsets(primaryStaff.clef);
  const keyOffsetsBass = isGrandStaff ? getKeySignatureOffsets(lowerStaff?.clef || 'bass') : [];

  const handleStaffMouseMove = (
    e: React.MouseEvent<SVGElement>,
    mIdx: number,
    measureX: number
  ) => {
    const svgEl = e.currentTarget.ownerSVGElement || (e.currentTarget as unknown as SVGSVGElement);
    const svgRect = svgEl.getBoundingClientRect();
    const svgY = e.clientY - svgRect.top;
    const svgX = e.clientX - svgRect.left;
    const relX = svgX - measureX;

    let targetStaffIdx = 0;
    let relY = svgY - staffTopOffset;

    if (isGrandStaff && svgY > staffTopOffset + staffHeight + 22) {
      targetStaffIdx = 1;
      relY = svgY - lowerStaffTopOffset;
    }

    const step = yToStaffStep(relY, lineSpacing);
    setHoveredMeasureIdx(mIdx);
    setHoveredStaffStep(step);
    setHoveredStaffIdx(targetStaffIdx);
    setHoveredX(relX);
  };

  const handleStaffMouseLeave = () => {
    setHoveredMeasureIdx(null);
    setHoveredStaffStep(null);
    setHoveredX(null);
  };

  const handleStaffClick = (mIdx: number) => {
    if (isRestMode) {
      onInsertRestAt(mIdx, hoveredStaffIdx);
      return;
    }
    if (hoveredStaffStep !== null) {
      const targetClef = hoveredStaffIdx === 1 ? (lowerStaff?.clef || 'bass') : primaryStaff.clef;
      const pitch = staffStepToPitch(hoveredStaffStep, targetClef, activeAccidental);
      onInsertNoteAt(mIdx, pitch, hoveredStaffIdx);
    }
  };

  /**
   * Renders the note & rest items for a specific staff in a measure
   */
  const renderStaffItems = (
    targetItems: ScoreItem[],
    targetClef: Clef,
    baseTopOffset: number,
    staffIdx: number,
    actualMeasureIdx: number,
    availableMeasureWidth: number
  ) => {
    const itemCount = targetItems.length;
    const spacing = (availableMeasureWidth - 40) / Math.max(1, itemCount);

    return targetItems.map((item, itemIdx) => {
      const itemX = 20 + itemIdx * spacing + spacing * 0.4;
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
              <circle
                cx="0"
                cy={restY}
                r="14"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeDasharray="3 2"
              />
            )}

            {item.duration === 'w' && (
              <rect
                x="-7"
                y={baseTopOffset + 10}
                width="14"
                height="6"
                fill="currentColor"
                className={isItemPlaying ? 'fill-amber-500' : 'fill-current'}
              />
            )}

            {item.duration === 'h' && (
              <rect
                x="-7"
                y={baseTopOffset + 14}
                width="14"
                height="6"
                fill="currentColor"
                className={isItemPlaying ? 'fill-amber-500' : 'fill-current'}
              />
            )}

            {item.duration === 'q' && (
              <g
                transform={`translate(-6, ${baseTopOffset + 8}) scale(0.85)`}
                className={isItemPlaying ? 'fill-amber-500' : 'fill-current'}
              >
                <path d={SVG_PATHS.quarterRest} />
              </g>
            )}

            {item.duration === '8' && (
              <g
                transform={`translate(-6, ${baseTopOffset + 12}) scale(0.85)`}
                className={isItemPlaying ? 'fill-amber-500' : 'fill-current'}
              >
                <path d={SVG_PATHS.eighthRest} />
              </g>
            )}

            {(item.duration === '16' || item.duration === '32') && (
              <g
                transform={`translate(-6, ${baseTopOffset + 10}) scale(0.85)`}
                className={isItemPlaying ? 'fill-amber-500' : 'fill-current'}
              >
                <path d={SVG_PATHS.eighthRest} />
                <path d={SVG_PATHS.eighthRest} transform="translate(1, 7)" />
              </g>
            )}

            {item.chord && (
              <text
                x="0"
                y={baseTopOffset - 18}
                textAnchor="middle"
                className="text-xs font-sans font-black fill-amber-600 dark:fill-[#fed7aa] select-none tracking-tight"
              >
                {item.chord}
              </text>
            )}
          </g>
        );
      }

      // Note item
      if (!item.pitch) return null;
      const staffStep = pitchToStaffStep(item.pitch, targetClef);
      const noteY = baseTopOffset + staffStepToY(staffStep, lineSpacing);
      const ledgerLines = getLedgerLines(staffStep);
      const stemUp = staffStep > 4;

      const isPracticeTarget =
        practiceTargetNote?.measureIdx === actualMeasureIdx &&
        practiceTargetNote?.itemIdx === itemIdx &&
        staffIdx === 0;

      return (
        <g
          key={item.id}
          transform={`translate(${itemX}, 0)`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectItem(actualMeasureIdx, item.id, staffIdx);
            audioEngine.playMidi(pitchToMidi(item.pitch!), 0.35);
          }}
          className="cursor-pointer group"
        >
          {/* Selected Halo Ring */}
          {isItemSelected && (
            <circle
              cx="0"
              cy={noteY}
              r="13"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              className="animate-pulse"
            />
          )}

          {/* Practice Target Ring */}
          {isPracticeTarget && (
            <g className="pointer-events-none">
              <circle
                cx="0"
                cy={noteY}
                r="18"
                fill="none"
                stroke={
                  practiceHitResult === 'correct'
                    ? '#22c55e'
                    : practiceHitResult === 'incorrect'
                    ? '#ef4444'
                    : '#84cc16'
                }
                strokeWidth="3"
                className="animate-ping opacity-75"
              />
              <circle
                cx="0"
                cy={noteY}
                r="15"
                fill="none"
                stroke={
                  practiceHitResult === 'correct'
                    ? '#22c55e'
                    : practiceHitResult === 'incorrect'
                    ? '#ef4444'
                    : '#bef264'
                }
                strokeWidth="2"
              />
            </g>
          )}

          {/* Ledger lines */}
          {ledgerLines.map((lineY, lIdx) => (
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

          {/* Accidental Glyph */}
          {item.pitch.accidental && (
            <g
              transform={`translate(-14, ${noteY - 8}) scale(0.65)`}
              className="fill-current text-slate-900 dark:text-slate-100"
            >
              <path
                d={
                  item.pitch.accidental === '#'
                    ? SVG_PATHS.sharp
                    : item.pitch.accidental === 'b'
                    ? SVG_PATHS.flat
                    : SVG_PATHS.natural
                }
                fill="currentColor"
              />
            </g>
          )}

          {/* Notehead */}
          <ellipse
            cx="0"
            cy={noteY}
            rx="6.5"
            ry="4.5"
            transform={`rotate(-22 0 ${noteY})`}
            fill={
              isPracticeTarget && practiceHitResult === 'correct'
                ? '#22c55e'
                : isPracticeTarget && practiceHitResult === 'incorrect'
                ? '#ef4444'
                : isItemPlaying
                ? '#f59e0b'
                : item.duration === 'w' || item.duration === 'h'
                ? 'none'
                : 'currentColor'
            }
            stroke={
              isPracticeTarget && practiceHitResult === 'correct'
                ? '#22c55e'
                : isPracticeTarget && practiceHitResult === 'incorrect'
                ? '#ef4444'
                : isItemPlaying
                ? '#f59e0b'
                : 'currentColor'
            }
            strokeWidth={item.duration === 'w' || item.duration === 'h' ? '2.5' : '1'}
            className="group-hover:opacity-80 transition-opacity"
          />

          {/* Stem */}
          {item.duration !== 'w' && (
            <line
              x1={stemUp ? 5.8 : -5.8}
              y1={noteY}
              x2={stemUp ? 5.8 : -5.8}
              y2={stemUp ? noteY - 30 : noteY + 30}
              stroke={isItemPlaying ? '#f59e0b' : 'currentColor'}
              strokeWidth="1.5"
            />
          )}

          {/* Flag(s) */}
          {item.duration === '8' && (
            <path
              d={
                stemUp
                  ? `M 5.8 ${noteY - 30} C 12 ${noteY - 26} 14 ${noteY - 18} 12 ${noteY - 12}`
                  : `M -5.8 ${noteY + 30} C -12 ${noteY + 26} -14 ${noteY + 18} -12 ${noteY + 12}`
              }
              stroke={isItemPlaying ? '#f59e0b' : 'currentColor'}
              strokeWidth="2.5"
              fill="none"
            />
          )}
          {item.duration === '16' && (
            <>
              <path
                d={
                  stemUp
                    ? `M 5.8 ${noteY - 30} C 12 ${noteY - 26} 14 ${noteY - 18} 12 ${noteY - 12}`
                    : `M -5.8 ${noteY + 30} C -12 ${noteY + 26} -14 ${noteY + 18} -12 ${noteY + 12}`
                }
                stroke={isItemPlaying ? '#f59e0b' : 'currentColor'}
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d={
                  stemUp
                    ? `M 5.8 ${noteY - 22} C 12 ${noteY - 18} 14 ${noteY - 10} 12 ${noteY - 4}`
                    : `M -5.8 ${noteY + 22} C -12 ${noteY + 18} -14 ${noteY + 10} -12 ${noteY + 4}`
                }
                stroke={isItemPlaying ? '#f59e0b' : 'currentColor'}
                strokeWidth="2.5"
                fill="none"
              />
            </>
          )}
          {item.duration === '32' && (
            <>
              <path
                d={
                  stemUp
                    ? `M 5.8 ${noteY - 30} C 12 ${noteY - 26} 14 ${noteY - 18} 12 ${noteY - 12}`
                    : `M -5.8 ${noteY + 30} C -12 ${noteY + 26} -14 ${noteY + 18} -12 ${noteY + 12}`
                }
                stroke={isItemPlaying ? '#f59e0b' : 'currentColor'}
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d={
                  stemUp
                    ? `M 5.8 ${noteY - 22} C 12 ${noteY - 18} 14 ${noteY - 10} 12 ${noteY - 4}`
                    : `M -5.8 ${noteY + 22} C -12 ${noteY + 18} -14 ${noteY + 10} -12 ${noteY + 4}`
                }
                stroke={isItemPlaying ? '#f59e0b' : 'currentColor'}
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d={
                  stemUp
                    ? `M 5.8 ${noteY - 14} C 12 ${noteY - 10} 14 ${noteY - 2} 12 ${noteY + 4}`
                    : `M -5.8 ${noteY + 14} C -12 ${noteY + 10} -14 ${noteY + 2} -12 ${noteY - 4}`
                }
                stroke={isItemPlaying ? '#f59e0b' : 'currentColor'}
                strokeWidth="2.5"
                fill="none"
              />
            </>
          )}

          {/* Dotted Note Dot */}
          {item.isDotted && (
            <circle
              cx="10"
              cy={noteY - 1}
              r="2"
              fill={isItemPlaying ? '#f59e0b' : 'currentColor'}
            />
          )}

          {/* Pedagogical Note Label */}
          {showNoteNames && (
            <text
              x="0"
              y={
                item.lyric || noteY >= baseTopOffset + 40
                  ? stemUp && item.duration !== 'w'
                    ? noteY - 36
                    : noteY - 14
                  : stemUp
                  ? noteY + 16
                  : noteY - 14
              }
              textAnchor="middle"
              className="text-[10px] font-bold fill-blue-600 dark:fill-blue-400 select-none pointer-events-none"
            >
              {formatPitchName(item.pitch, namingConvention)}
            </text>
          )}

          {/* Lyrics beneath staff */}
          {item.lyric && (
            <text
              x="0"
              y={baseTopOffset + staffHeight + 25}
              textAnchor="middle"
              className="text-[11px] font-serif italic fill-slate-800 dark:fill-slate-200 select-none"
            >
              {item.lyric}
            </text>
          )}

          {/* Chord symbol above staff */}
          {item.chord && (
            <text
              x="0"
              y={baseTopOffset - 18}
              textAnchor="middle"
              className="text-xs font-sans font-black fill-amber-600 dark:fill-[#fed7aa] select-none tracking-tight"
            >
              {item.chord}
            </text>
          )}

          {/* Guitar Tablature Fret Number (only for staff 0) */}
          {showTablature && staffIdx === 0 && (() => {
            const tabPos = pitchToGuitarTab(item.pitch);
            if (!tabPos) return null;
            const tabY = tabTopOffset + (tabPos.stringNumber - 1) * tabLineSpacing;
            return (
              <g className="pointer-events-none select-none">
                <rect
                  x="-6"
                  y={tabY - 5.5}
                  width="12"
                  height="11"
                  rx="2"
                  className="fill-white dark:fill-[#161922]"
                />
                <text
                  x="0"
                  y={tabY + 3.5}
                  textAnchor="middle"
                  className={`text-[9.5px] font-mono font-bold select-none ${
                    isItemPlaying
                      ? 'fill-amber-500 font-black'
                      : 'fill-slate-800 dark:fill-slate-200'
                  }`}
                >
                  {tabPos.fret}
                </text>
              </g>
            );
          })()}
        </g>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      onClick={() => onSelectItem(selectedMeasureIdx, null, selectedStaffIdx)}
      className="flex-1 overflow-auto bg-slate-100 dark:bg-[#0c0d12] p-3 sm:p-6 flex justify-center items-start select-none"
    >
      {/* Paper Sheet container */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelectItem(selectedMeasureIdx, null, selectedStaffIdx);
        }}
        className="score-sheet bg-white dark:bg-[#161922] text-slate-900 dark:text-slate-100 shadow-xl rounded-2xl p-6 sm:p-8 min-w-[780px] max-w-[960px] border border-slate-200 dark:border-[#232836] transition-colors"
      >
        {/* Score Header */}
        <div className="text-center mb-8 border-b border-slate-100 dark:border-slate-800/80 pb-6 relative">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif">
            {score.title || 'Sin Título'}
          </h1>
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-2 px-2">
            <span className="font-mono">
              ♩ = {score.tempo} ({score.timeSignature.beats}/{score.timeSignature.beatType}) •{' '}
              {score.keySignature}
            </span>
            <span className="font-serif italic font-medium">
              {score.composer || 'Compositor'}
            </span>
          </div>
        </div>

        {/* Systems (Lines of Staffs) */}
        {Array.from({ length: systemCount }).map((_, systemIdx) => {
          const startMeasureIdx = systemIdx * measuresPerSystem;
          const endMeasureIdx = Math.min(startMeasureIdx + measuresPerSystem, totalMeasures);
          const systemMeasures = primaryStaff.measures.slice(startMeasureIdx, endMeasureIdx);
          const isFirstSystem = systemIdx === 0;

          // Width calculations
          const systemWidth = 840;
          const headerWidth = isFirstSystem ? 110 : 60;
          const availableMeasureWidth = (systemWidth - headerWidth) / systemMeasures.length;

          const systemBottomY = isGrandStaff
            ? lowerStaffTopOffset + staffHeight
            : showTablature
            ? tabTopOffset + 5 * tabLineSpacing
            : staffTopOffset + staffHeight;

          return (
            <div key={`system-${systemIdx}`} className="relative mb-12">
              <svg
                width={systemWidth}
                height={systemHeight}
                className="overflow-visible cursor-pointer"
                onMouseLeave={handleStaffMouseLeave}
              >
                {/* Grand Staff Piano Brace */}
                {isGrandStaff && (
                  <g className="grand-staff-brace select-none">
                    {/* Curly decorative bracket curve */}
                    <path
                      d={`M 12 ${staffTopOffset}
                         C 2 ${staffTopOffset + 20}, 0 ${staffTopOffset + 45}, -7 ${staffTopOffset + 62.5}
                         C 0 ${staffTopOffset + 80}, 2 ${staffTopOffset + 105}, 12 ${lowerStaffTopOffset + staffHeight}
                         C 6 ${staffTopOffset + 105}, 4 ${staffTopOffset + 80}, -2 ${staffTopOffset + 62.5}
                         C 4 ${staffTopOffset + 45}, 6 ${staffTopOffset + 20}, 12 ${staffTopOffset} Z`}
                      className="fill-slate-800 dark:fill-slate-200"
                    />
                    <line
                      x1={12}
                      y1={staffTopOffset}
                      x2={12}
                      y2={lowerStaffTopOffset + staffHeight}
                      stroke="currentColor"
                      strokeWidth="2.5"
                    />
                  </g>
                )}

                {/* System Bracket & Start Barline */}
                {!isGrandStaff && (
                  <line
                    x1={2}
                    y1={staffTopOffset}
                    x2={2}
                    y2={systemBottomY}
                    stroke="currentColor"
                    strokeWidth="2.5"
                  />
                )}

                {/* 5 Horizontal Staff Lines (Upper Staff / Treble) */}
                {[0, 1, 2, 3, 4].map((lineIdx) => (
                  <line
                    key={`upper-line-${lineIdx}`}
                    x1={0}
                    y1={staffTopOffset + lineIdx * lineSpacing}
                    x2={systemWidth}
                    y2={staffTopOffset + lineIdx * lineSpacing}
                    stroke="currentColor"
                    strokeWidth="1.2"
                    className="text-slate-300 dark:text-slate-700/80"
                  />
                ))}

                {/* 5 Horizontal Staff Lines (Lower Staff / Bass for Grand Staff) */}
                {isGrandStaff &&
                  [0, 1, 2, 3, 4].map((lineIdx) => (
                    <line
                      key={`lower-line-${lineIdx}`}
                      x1={0}
                      y1={lowerStaffTopOffset + lineIdx * lineSpacing}
                      x2={systemWidth}
                      y2={lowerStaffTopOffset + lineIdx * lineSpacing}
                      stroke="currentColor"
                      strokeWidth="1.2"
                      className="text-slate-300 dark:text-slate-700/80"
                    />
                  ))}

                {/* 6 Horizontal Guitar Tablature Lines */}
                {showTablature && (
                  <>
                    <text
                      x="8"
                      y={tabTopOffset + 15}
                      className="text-[10px] font-mono font-black fill-slate-400 select-none tracking-widest"
                      style={{ writingMode: 'vertical-rl' }}
                    >
                      TAB
                    </text>
                    {[0, 1, 2, 3, 4, 5].map((tabLineIdx) => (
                      <line
                        key={`tab-line-${tabLineIdx}`}
                        x1={0}
                        y1={tabTopOffset + tabLineIdx * tabLineSpacing}
                        x2={systemWidth}
                        y2={tabTopOffset + tabLineIdx * tabLineSpacing}
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeDasharray={tabLineIdx === 0 || tabLineIdx === 5 ? 'none' : 'none'}
                        className="text-slate-300/80 dark:text-slate-700/60"
                      />
                    ))}
                  </>
                )}

                {/* Upper Clef Glyph */}
                <g
                  transform={`translate(8, ${
                    primaryStaff.clef === 'bass'
                      ? staffTopOffset - 2
                      : primaryStaff.clef === 'alto'
                      ? staffTopOffset
                      : staffTopOffset - 8
                  }) scale(0.72)`}
                  className="text-slate-900 dark:text-slate-100"
                >
                  <path
                    d={
                      primaryStaff.clef === 'bass'
                        ? SVG_PATHS.bassClef
                        : primaryStaff.clef === 'alto'
                        ? SVG_PATHS.altoClef
                        : SVG_PATHS.trebleClef
                    }
                    fill="currentColor"
                  />
                  {primaryStaff.clef === 'bass' && (
                    <>
                      <circle cx="28" cy="18" r="2.2" fill="currentColor" />
                      <circle cx="28" cy="27" r="2.2" fill="currentColor" />
                    </>
                  )}
                </g>

                {/* Upper Key Signature Accidentals */}
                <g transform={`translate(${primaryStaff.clef === 'bass' ? 44 : 48}, 0)`}>
                  {keyOffsetsTreble.map((kOff, kIdx) => {
                    const ky = staffTopOffset + staffStepToY(kOff.step, lineSpacing);
                    return (
                      <g
                        key={`key-acc-${kIdx}`}
                        transform={`translate(${kIdx * 9}, ${ky - 10}) scale(0.6)`}
                        className="text-slate-800 dark:text-slate-200"
                      >
                        <path
                          d={kOff.type === '#' ? SVG_PATHS.sharp : SVG_PATHS.flat}
                          fill="currentColor"
                        />
                      </g>
                    );
                  })}
                </g>

                {/* Upper Time Signature (on first system only) */}
                {isFirstSystem && (
                  <g
                    transform={`translate(${headerWidth - 28}, ${staffTopOffset + 18})`}
                    className="font-serif font-bold text-lg fill-current select-none"
                  >
                    <text x="0" y="0" textAnchor="middle" className="text-[17px]">
                      {score.timeSignature.beats}
                    </text>
                    <text x="0" y="19" textAnchor="middle" className="text-[17px]">
                      {score.timeSignature.beatType}
                    </text>
                  </g>
                )}

                {/* Lower Staff Clef & Key/Time Signature for Grand Staff */}
                {isGrandStaff && (
                  <>
                    <g
                      transform={`translate(8, ${lowerStaffTopOffset - 2}) scale(0.72)`}
                      className="text-slate-900 dark:text-slate-100"
                    >
                      <path
                        d={
                          (lowerStaff?.clef || 'bass') === 'bass'
                            ? SVG_PATHS.bassClef
                            : SVG_PATHS.trebleClef
                        }
                        fill="currentColor"
                      />
                      {(lowerStaff?.clef || 'bass') === 'bass' && (
                        <>
                          <circle cx="28" cy="18" r="2.2" fill="currentColor" />
                          <circle cx="28" cy="27" r="2.2" fill="currentColor" />
                        </>
                      )}
                    </g>

                    <g transform={`translate(44, 0)`}>
                      {keyOffsetsBass.map((kOff, kIdx) => {
                        const ky = lowerStaffTopOffset + staffStepToY(kOff.step, lineSpacing);
                        return (
                          <g
                            key={`key-acc-bass-${kIdx}`}
                            transform={`translate(${kIdx * 9}, ${ky - 10}) scale(0.6)`}
                            className="text-slate-800 dark:text-slate-200"
                          >
                            <path
                              d={kOff.type === '#' ? SVG_PATHS.sharp : SVG_PATHS.flat}
                              fill="currentColor"
                            />
                          </g>
                        );
                      })}
                    </g>

                    {isFirstSystem && (
                      <g
                        transform={`translate(${headerWidth - 28}, ${lowerStaffTopOffset + 18})`}
                        className="font-serif font-bold text-lg fill-current select-none"
                      >
                        <text x="0" y="0" textAnchor="middle" className="text-[17px]">
                          {score.timeSignature.beats}
                        </text>
                        <text x="0" y="19" textAnchor="middle" className="text-[17px]">
                          {score.timeSignature.beatType}
                        </text>
                      </g>
                    )}
                  </>
                )}

                {/* Measures in this System */}
                {systemMeasures.map((measure, mSubIdx) => {
                  const actualMeasureIdx = startMeasureIdx + mSubIdx;
                  const measureX = headerWidth + mSubIdx * availableMeasureWidth;
                  const isSelectedMeasure = selectedMeasureIdx === actualMeasureIdx;
                  const isPlayingMeasure =
                    playbackState.isPlaying &&
                    playbackState.currentMeasureIndex === actualMeasureIdx;

                  const lowerMeasure = isGrandStaff
                    ? lowerStaff?.measures[actualMeasureIdx]
                    : undefined;

                  return (
                    <g
                      key={measure.id}
                      transform={`translate(${measureX}, 0)`}
                      onMouseMove={(e) => handleStaffMouseMove(e, actualMeasureIdx, measureX)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStaffClick(actualMeasureIdx);
                      }}
                    >
                      {/* Interactive click hotspot for measure */}
                      <rect
                        x={0}
                        y={staffTopOffset - 25}
                        width={availableMeasureWidth}
                        height={
                          isGrandStaff
                            ? lowerStaffTopOffset + staffHeight - staffTopOffset + 45
                            : staffHeight + 50
                        }
                        fill="transparent"
                        className="measure-hotspot hover:fill-blue-500/5 dark:hover:fill-blue-500/10 transition-colors no-print"
                      />

                      {/* Measure number label */}
                      <text
                        x={4}
                        y={staffTopOffset - 8}
                        className="text-[10px] font-mono fill-slate-400 select-none"
                      >
                        {actualMeasureIdx + 1}
                      </text>

                      {/* Selected Measure Visual Frame */}
                      {isSelectedMeasure && (
                        <rect
                          x={0}
                          y={staffTopOffset - 12}
                          width={availableMeasureWidth}
                          height={
                            isGrandStaff
                              ? lowerStaffTopOffset + staffHeight - staffTopOffset + 24
                              : staffHeight + 24
                          }
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="1.5"
                          strokeDasharray="4 2"
                          rx="4"
                          className="opacity-70 pointer-events-none"
                        />
                      )}

                      {/* Upper Staff Items (Mano Derecha / Melodía) */}
                      {renderStaffItems(
                        measure.items,
                        primaryStaff.clef,
                        staffTopOffset,
                        0,
                        actualMeasureIdx,
                        availableMeasureWidth
                      )}

                      {/* Lower Staff Items for Grand Staff (Mano Izquierda) */}
                      {isGrandStaff &&
                        lowerMeasure &&
                        renderStaffItems(
                          lowerMeasure.items,
                          lowerStaff?.clef || 'bass',
                          lowerStaffTopOffset,
                          1,
                          actualMeasureIdx,
                          availableMeasureWidth
                        )}

                      {/* Ghost Note Preview on Hover */}
                      {hoveredMeasureIdx === actualMeasureIdx &&
                        hoveredStaffStep !== null &&
                        hoveredX !== null &&
                        !isRestMode && (
                          <g
                            transform={`translate(${Math.max(
                              15,
                              Math.min(availableMeasureWidth - 25, hoveredX)
                            )}, 0)`}
                            className="pointer-events-none opacity-60 text-blue-500"
                          >
                            {/* Ghost notehead */}
                            <ellipse
                              cx="0"
                              cy={
                                (hoveredStaffIdx === 1 ? lowerStaffTopOffset : staffTopOffset) +
                                staffStepToY(hoveredStaffStep, lineSpacing)
                              }
                              rx="6.5"
                              ry="4.5"
                              transform={`rotate(-22 0 ${
                                (hoveredStaffIdx === 1 ? lowerStaffTopOffset : staffTopOffset) +
                                staffStepToY(hoveredStaffStep, lineSpacing)
                              })`}
                              fill="currentColor"
                            />
                            {/* Ghost tooltip showing note name */}
                            <text
                              x="0"
                              y={
                                (hoveredStaffIdx === 1 ? lowerStaffTopOffset : staffTopOffset) +
                                staffStepToY(hoveredStaffStep, lineSpacing) -
                                10
                              }
                              textAnchor="middle"
                              className="text-[10px] font-bold fill-blue-600 dark:fill-blue-400"
                            >
                              {formatPitchName(
                                staffStepToPitch(
                                  hoveredStaffStep,
                                  hoveredStaffIdx === 1
                                    ? lowerStaff?.clef || 'bass'
                                    : primaryStaff.clef,
                                  activeAccidental
                                ),
                                namingConvention
                              )}
                            </text>
                          </g>
                        )}

                      {/* Playback Cursor Line */}
                      {isPlayingMeasure && (
                        <line
                          x1={
                            measure.items.length > 0 && playbackState.currentItemIndex >= 0
                              ? 20 +
                                playbackState.currentItemIndex *
                                  ((availableMeasureWidth - 40) /
                                    Math.max(1, measure.items.length)) +
                                ((availableMeasureWidth - 40) /
                                  Math.max(1, measure.items.length)) *
                                  0.4
                              : 10
                          }
                          y1={staffTopOffset - 6}
                          x2={
                            measure.items.length > 0 && playbackState.currentItemIndex >= 0
                              ? 20 +
                                playbackState.currentItemIndex *
                                  ((availableMeasureWidth - 40) /
                                    Math.max(1, measure.items.length)) +
                                ((availableMeasureWidth - 40) /
                                  Math.max(1, measure.items.length)) *
                                  0.4
                              : 10
                          }
                          y2={systemBottomY + 6}
                          stroke="#f59e0b"
                          strokeWidth="2.5"
                          className="pointer-events-none"
                        />
                      )}

                      {/* Barline at the end of each measure */}
                      <line
                        x1={availableMeasureWidth}
                        y1={staffTopOffset}
                        x2={availableMeasureWidth}
                        y2={systemBottomY}
                        stroke="currentColor"
                        strokeWidth={actualMeasureIdx === totalMeasures - 1 ? '3' : '1.2'}
                        className="text-slate-400 dark:text-slate-600"
                      />
                      {actualMeasureIdx === totalMeasures - 1 && (
                        <line
                          x1={availableMeasureWidth - 4}
                          y1={staffTopOffset}
                          x2={availableMeasureWidth - 4}
                          y2={systemBottomY}
                          stroke="currentColor"
                          strokeWidth="1"
                          className="text-slate-400 dark:text-slate-600"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Measure control overlay (Delete Measure button) */}
              <div className="absolute right-0 top-0 flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
                {systemMeasures.map((_, smIdx) => {
                  const mIdx = startMeasureIdx + smIdx;
                  return (
                    <button
                      key={`del-m-${mIdx}`}
                      onClick={() => onDeleteMeasure(mIdx)}
                      className="text-[10px] text-rose-500 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/40"
                      title={`Eliminar compás ${mIdx + 1}`}
                    >
                      Borrar C{mIdx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Pedagogical Note Names Toggle Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-medium">💡 Guía Rápida:</span>
            <span>
              {isGrandStaff
                ? 'Piano activo: haz clic en pentagrama superior (Sol) o inferior (Fa) para colocar notas.'
                : 'Haz clic en el pentagrama para insertar notas. Usa las teclas A-G o el piano inferior.'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Total compases: {totalMeasures} • Sistema:{' '}
            {isGrandStaff ? 'Gran Pentagrama (Piano)' : `Clave ${primaryStaff.clef.toUpperCase()}`}
          </div>
        </div>
      </div>
    </div>
  );
};
