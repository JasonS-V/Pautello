import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Undo,
  Redo,
  PanelRightClose,
  PanelRightOpen,
  Music,
  Settings,
} from '../ui/icons';
import {
  Score,
  ScoreItem,
  Clef,
  TimeSignature,
  KeySignature,
  Pitch,
  Step,
  NoteDuration,
  Accidental,
  Articulation,
  Dynamic,
  Ornament,
  BarlineType,
  NavigationMark,
  NamingConvention,
  isPianoGrandStaff,
} from '../../types/music';

import { NoteInspectorTab } from './tabs/NoteInspectorTab';
import { MeasureInspectorTab } from './tabs/MeasureInspectorTab';
import { ScoreMetadataTab } from './tabs/ScoreMetadataTab';

export interface ScoreInspectorProps {
  score: Score;
  selectedMeasureIdx: number;
  selectedItemId: string | null;
  namingConvention: NamingConvention;
  clef: Clef;
  onUpdateClef: (clef: Clef) => void;
  timeSignature: TimeSignature;
  onUpdateTimeSignature: (timeSig: TimeSignature) => void;
  keySignature: KeySignature;
  onUpdateKeySignature: (keySig: KeySignature) => void;
  onChangeKeySignatureAndTranspose?: (newKey: KeySignature, transposeNotes: boolean) => void;
  onTransposeScore?: (semitones: number) => void;
  onAddMeasure: () => void;
  onDeleteMeasure: () => void;
  onDeleteSelected: () => void;
  onTransposeSelected: (semitones: number) => void;
  onChangeDuration?: (duration: NoteDuration) => void;
  onToggleDot?: () => void;
  onSetAccidental?: (acc: Accidental) => void;
  onUpdateLyric: (lyric: string) => void;
  onUpdateChord?: (chord: string | undefined) => void;
  onUpdateStep: (step: Step) => void;
  onAddPitchToChord?: (pitch: Pitch) => void;
  onRemovePitchFromChord?: (pitchIndex: number) => void;
  onClearScore?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isGrandStaff?: boolean;
  onToggleGrandStaff?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onToggleRepeatStart?: (measureIdx: number) => void;
  onToggleRepeatEnd?: (measureIdx: number) => void;
  onSetVolta?: (measureIdx: number, volta?: string | null) => void;
  onToggleTuplet?: () => void;
  onToggleTie?: () => void;
  onToggleSlur?: () => void;
  onSetArticulation?: (art: Articulation | null) => void;
  onSetDynamic?: (dyn: Dynamic | null) => void;
  onSetItemVoice?: (voice: 1 | 2) => void;
  onSetAnacrusis?: (measureIdx: number, isAnacrusis: boolean, pickupBeats?: number) => void;
  onToggleSystemBreak?: (measureIdx: number) => void;
  onTogglePageBreak?: (measureIdx: number) => void;
  onSetMultimeasureRest?: (measureIdx: number, count?: number) => void;
  onAutoConsolidateTacets?: (staffIdx?: number) => void;
  onClearAllTacets?: (staffIdx?: number) => void;
  measuresPerSystem?: number;
  onSetMeasuresPerSystem?: (count: number) => void;
  layoutMode?: 'continuous' | 'paged';
  onSelectLayoutMode?: (mode: 'continuous' | 'paged') => void;
  viewMode?: 'full' | 'part';
  activePartStaffIdx?: number;
  onSelectViewMode?: (mode: 'full' | 'part') => void;
  onSelectPartStaffIdx?: (idx: number) => void;
  selectedStaffIdx?: number;
  onSelectStaff?: (staffIdx: number) => void;
  onAddStaff?: (name?: string, clef?: Clef) => void;
  onRemoveStaff?: (staffIdx: number) => void;
  onUpdateStaffName?: (staffIdx: number, name: string) => void;
  onUpdateStaffClef?: (staffIdx: number, clef: Clef) => void;
  measureRange?: { start: number; end: number } | null;
  onCopyMeasureRange?: () => void;
  onPasteMeasureRange?: () => void;
  onDeleteSelectedMeasures?: () => void;
  hasClipboardMeasures?: boolean;
  onSetOrnament?: (ornament: Ornament | null) => void;
  onSetHairpin?: (hairpin: 'cresc' | 'decresc' | 'stop' | null) => void;
  onSetNoteType?: (
    noteType: 'standard' | 'grace' | 'slash',
    graceType?: 'acciaccatura' | 'appoggiatura'
  ) => void;
  onSetFingering?: (fingering?: number) => void;
  onSetPedal?: (pedal?: 'start' | 'stop') => void;
  onSetBarline?: (measureIdx: number, barline?: BarlineType) => void;
  onSetNavigationMark?: (measureIdx: number, mark?: NavigationMark) => void;
  onSetRehearsalMark?: (measureIdx: number, mark?: string) => void;
  onToggleRepeatSign?: (measureIdx: number) => void;
  onToggleCaesura?: (measureIdx: number) => void;
  onToggleBreathMark?: (measureIdx: number) => void;
  onSetTempoText?: (measureIdx: number, text?: string, bpm?: number) => void;
  onSetTimeSignatureChange?: (measureIdx: number, timeSig?: TimeSignature) => void;
  onSetKeySignatureChange?: (measureIdx: number, keySig?: KeySignature) => void;
  onUpdateScoreMetadata?: (meta: {
    subtitle?: string;
    lyricist?: string;
    partName?: string;
    copyright?: string;
  }) => void;
  onUpdateStaffShortName?: (staffIdx: number, shortName: string) => void;
  onUpdateStaffTransposition?: (staffIdx: number, transposition: number) => void;
}

export const ScoreInspector: React.FC<ScoreInspectorProps> = ({
  score,
  selectedMeasureIdx,
  selectedItemId,
  namingConvention,
  clef,
  onUpdateClef,
  timeSignature,
  onUpdateTimeSignature,
  keySignature,
  onUpdateKeySignature,
  onChangeKeySignatureAndTranspose,
  onTransposeScore,
  onAddMeasure,
  onDeleteMeasure,
  onDeleteSelected,
  onTransposeSelected,
  onChangeDuration,
  onToggleDot,
  onSetAccidental,
  onUpdateLyric,
  onUpdateChord,
  onUpdateStep,
  onAddPitchToChord,
  onRemovePitchFromChord,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isGrandStaff = false,
  onToggleGrandStaff,
  isCollapsed = false,
  onToggleCollapse,
  onToggleRepeatStart,
  onToggleRepeatEnd,
  onSetVolta,
  onToggleTuplet,
  onToggleTie,
  onToggleSlur,
  onSetArticulation,
  onSetDynamic,
  onSetItemVoice,
  onSetOrnament,
  onSetHairpin,
  onSetNoteType,
  onSetFingering,
  onSetPedal,
  onSetAnacrusis,
  onToggleSystemBreak,
  onTogglePageBreak,
  onSetMultimeasureRest,
  onAutoConsolidateTacets,
  onClearAllTacets,
  measuresPerSystem = 3,
  onSetMeasuresPerSystem,
  layoutMode = 'continuous',
  onSelectLayoutMode,
  viewMode = 'full',
  activePartStaffIdx = 0,
  onSelectViewMode,
  onSelectPartStaffIdx,
  selectedStaffIdx = 0,
  onSelectStaff,
  onAddStaff,
  onRemoveStaff,
  onUpdateStaffName,
  onUpdateStaffClef,
  measureRange,
  onCopyMeasureRange,
  onPasteMeasureRange,
  onDeleteSelectedMeasures,
  hasClipboardMeasures = false,
}) => {
  const [activeTab, setActiveTab] = useState<'note' | 'measure' | 'score'>('note');
  const [prevSelectedItemId, setPrevSelectedItemId] = useState<string | null>(selectedItemId);

  if (selectedItemId !== prevSelectedItemId) {
    setPrevSelectedItemId(selectedItemId);
    if (selectedItemId !== null) {
      setActiveTab('note');
    }
  }

  const canToggleGrandStaff = score.staves.length === 1 || isPianoGrandStaff(score);
  const currentMeasure = score.staves[0]?.measures[selectedMeasureIdx];

  let selectedItem: ScoreItem | null = null;
  for (const staff of score.staves) {
    if (staff.measures[selectedMeasureIdx]) {
      const found = staff.measures[selectedMeasureIdx].items.find((it) => it.id === selectedItemId);
      if (found) {
        selectedItem = found;
        break;
      }
    }
  }

  if (isCollapsed) {
    return (
      <div className="w-12 border-l border-slate-200/80 dark:border-studio-border bg-white dark:bg-studio-surface flex flex-col items-center py-4 gap-3 shrink-0 no-print select-none">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover transition-all duration-150 active:scale-90"
            title="Abrir panel inspector"
            aria-label="Abrir panel inspector"
          >
            <PanelRightOpen className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <aside
      className="w-80 border-l border-slate-200/80 dark:border-studio-border bg-white dark:bg-studio-surface flex flex-col shrink-0 no-print select-none h-full transition-all duration-200"
      aria-label="Inspector de propiedades"
    >
      <div className="p-3 border-b border-slate-200/80 dark:border-studio-border flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Inspector
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-studio-hover transition-colors"
              title="Deshacer (Ctrl+Z)"
              aria-label="Deshacer"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-studio-hover transition-colors"
              title="Rehacer (Ctrl+Y)"
              aria-label="Rehacer"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover transition-all duration-150 active:scale-90 ml-0.5"
                title="Cerrar panel inspector"
                aria-label="Cerrar panel inspector"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-studio-card rounded-lg border border-slate-200/80 dark:border-studio-border">
          <button
            type="button"
            onClick={() => setActiveTab('note')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'note'
                ? 'bg-white dark:bg-studio-deep text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Propiedades de la Nota o Silencio seleccionado"
          >
            <Music className="w-3.5 h-3.5 shrink-0" />
            <span>Nota</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('measure')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'measure'
                ? 'bg-white dark:bg-studio-deep text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Propiedades del Compás actual"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>Compás</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('score')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'score'
                ? 'bg-white dark:bg-studio-deep text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Estructura e Instrumentos de la Partitura"
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span>Partitura</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'note' && (
          <NoteInspectorTab
            selectedItem={selectedItem}
            selectedMeasureIdx={selectedMeasureIdx}
            namingConvention={namingConvention}
            onTransposeSelected={onTransposeSelected}
            onDeleteSelected={onDeleteSelected}
            onChangeDuration={onChangeDuration}
            onToggleDot={onToggleDot}
            onSetAccidental={onSetAccidental}
            onUpdateLyric={onUpdateLyric}
            onUpdateChord={onUpdateChord}
            onUpdateStep={onUpdateStep}
            onAddPitchToChord={onAddPitchToChord}
            onRemovePitchFromChord={onRemovePitchFromChord}
            onToggleTuplet={onToggleTuplet}
            onToggleTie={onToggleTie}
            onToggleSlur={onToggleSlur}
            onSetArticulation={onSetArticulation}
            onSetDynamic={onSetDynamic}
            onSetItemVoice={onSetItemVoice}
            onSetOrnament={onSetOrnament}
            onSetHairpin={onSetHairpin}
            onSetNoteType={onSetNoteType}
            onSetFingering={onSetFingering}
            onSetPedal={(p) => onSetPedal?.(p === 'down' ? 'start' : p === 'up' ? 'stop' : undefined)}
          />
        )}

        {activeTab === 'measure' && (
          <MeasureInspectorTab
            score={score}
            currentMeasure={currentMeasure}
            selectedMeasureIdx={selectedMeasureIdx}
            measureRange={measureRange}
            hasClipboardMeasures={hasClipboardMeasures}
            layoutMode={layoutMode}
            measuresPerSystem={measuresPerSystem}
            onAddMeasure={onAddMeasure}
            onDeleteMeasure={onDeleteMeasure}
            onCopyMeasureRange={onCopyMeasureRange}
            onPasteMeasureRange={onPasteMeasureRange}
            onDeleteSelectedMeasures={onDeleteSelectedMeasures}
            onToggleRepeatStart={onToggleRepeatStart}
            onToggleRepeatEnd={onToggleRepeatEnd}
            onSetVolta={onSetVolta}
            onSetAnacrusis={onSetAnacrusis}
            onToggleSystemBreak={onToggleSystemBreak}
            onTogglePageBreak={onTogglePageBreak}
            onSetMultimeasureRest={onSetMultimeasureRest}
            onAutoConsolidateTacets={onAutoConsolidateTacets}
            onClearAllTacets={onClearAllTacets}
            onSetMeasuresPerSystem={onSetMeasuresPerSystem}
            onSelectLayoutMode={onSelectLayoutMode}
          />
        )}

        {activeTab === 'score' && (
          <ScoreMetadataTab
            score={score}
            isGrandStaff={isGrandStaff}
            canToggleGrandStaff={canToggleGrandStaff}
            onToggleGrandStaff={onToggleGrandStaff}
            viewMode={viewMode}
            activePartStaffIdx={activePartStaffIdx}
            onSelectViewMode={onSelectViewMode}
            onSelectPartStaffIdx={onSelectPartStaffIdx}
            selectedStaffIdx={selectedStaffIdx}
            onSelectStaff={onSelectStaff}
            onAddStaff={onAddStaff}
            onRemoveStaff={onRemoveStaff}
            onUpdateStaffName={onUpdateStaffName}
            onUpdateStaffClef={onUpdateStaffClef}
            clef={clef}
            onUpdateClef={onUpdateClef}
            timeSignature={timeSignature}
            onUpdateTimeSignature={onUpdateTimeSignature}
            keySignature={keySignature}
            onUpdateKeySignature={onUpdateKeySignature}
            onChangeKeySignatureAndTranspose={onChangeKeySignatureAndTranspose}
            onTransposeScore={onTransposeScore}
          />
        )}
      </div>
    </aside>
  );
};
