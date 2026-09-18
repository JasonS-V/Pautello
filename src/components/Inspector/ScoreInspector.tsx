import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Undo,
  Redo,
  PanelRightClose,
  PanelRightOpen,
  Type,
  Music,
  Copy,
  Clipboard,
  BookOpen,
  Settings,
  FileText,
  Layers,
  LayoutGrid,
  ScrollText,
  FileStack,
  Printer,
  X,
} from '../ui/icons';
import {
  Score,
  ScoreItem,
  Clef,
  TimeSignature,
  KeySignature,
  NamingConvention,
  Step,
  NoteDuration,
  Accidental,
  Pitch,
  Articulation,
  Dynamic,
  Ornament,
  BarlineType,
  NavigationMark,
  getItemPitches,
  isPianoGrandStaff,
} from '../../types/music';
import { TRANSPOSITION_PRESETS } from '../../utils/transposition';
import {
  formatPitchName,
  pitchToFrequency,
  pitchToMidi,
  getItemBeats,
} from '../../constants/pitches';
import { resolveMeasureCapacity } from '../../utils/measureTiming';
import { getDiatonicChordsForKey } from '../../utils/chordUtils';
import { CustomSelect, CustomSelectOption } from '../ui/CustomSelect';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const DURATION_INFO: Record<NoteDuration, { symbol: string; label: string }> = {
  w: { symbol: '𝅝', label: 'Redonda' },
  h: { symbol: '𝅗𝅥', label: 'Blanca' },
  q: { symbol: '𝅘𝅥', label: 'Negra' },
  '8': { symbol: '𝅘𝅥𝅮', label: 'Corchea' },
  '16': { symbol: '𝅘𝅥𝅯', label: 'Semicorchea' },
  '32': { symbol: '𝅘𝅥𝅰', label: 'Fusa' },
};

interface ScoreInspectorProps {
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
  onUpdateLyric,
  onUpdateChord,
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
  onSetArticulation,
  onSetDynamic,
  onSetItemVoice,
  onSetOrnament,
  onSetHairpin,
  onSetNoteType,
  onSetFingering,
  onSetPedal,
  onSetBarline,
  onSetNavigationMark,
  onSetRehearsalMark,
  onToggleRepeatSign,
  onToggleCaesura,
  onToggleBreathMark,
  onSetTempoText,
  onSetTimeSignatureChange,
  onSetKeySignatureChange,
  onUpdateScoreMetadata,
  onUpdateStaffShortName,
  onUpdateStaffTransposition,
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
  const [autoTransposeNotes, setAutoTransposeNotes] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'note' | 'measure' | 'score'>('note');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'single' | 'range';
    count?: number;
  } | null>(null);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffClef, setNewStaffClef] = useState<Clef>('treble');

  const handleAddCustomStaff = () => {
    const finalName = newStaffName.trim() || `Instrumento ${score.staves.length + 1}`;
    onAddStaff?.(finalName, newStaffClef);
    setNewStaffName('');
  };

  // El toggle de "Gran Pentagrama" solo aplica con 1 pentagrama (activarlo) o
  // con el par ya unido (desactivarlo). Mostrarlo con más pentagramas permitía
  // colapsar la obra entera y perder los instrumentos añadidos.
  const canToggleGrandStaff = score.staves.length === 1 || isPianoGrandStaff(score);

  // Al seleccionar una nota/silencio, saltar automáticamente a la pestaña de Nota
  useEffect(() => {
    if (selectedItemId) {
      setActiveTab('note');
    }
  }, [selectedItemId]);

  const currentMeasure = score.staves[0]?.measures[selectedMeasureIdx];

  // Find selected item across all staves
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

  const currentPitches = selectedItem ? getItemPitches(selectedItem) : [];
  const isChord = currentPitches.length > 1;

  const clefOptions: CustomSelectOption<Clef>[] = [
    { value: 'treble', label: 'Sol (Treble)', badge: '𝄞', description: 'Clave de Sol en 2ª' },
    { value: 'bass', label: 'Fa (Bass)', badge: '𝄢', description: 'Clave de Fa en 4ª' },
    { value: 'alto', label: 'Do en 3ª (Alto)', badge: '𝄡', description: 'Clave de Do en 3ª' },
  ];

  const timeSignatureOptions: CustomSelectOption<string>[] = [
    { value: '4/4', label: '4/4 Común', badge: '4/4', description: '4 tiempos de negra' },
    { value: '3/4', label: '3/4 Vals', badge: '3/4', description: '3 tiempos de negra' },
    { value: '2/4', label: '2/4 Marcha', badge: '2/4', description: '2 tiempos de negra' },
    { value: '6/8', label: '6/8 Compuesto', badge: '6/8', description: '2 pulsos ternarios' },
    { value: '2/2', label: '2/2 Compasillo', badge: '2/2', description: '2 tiempos de blanca' },
  ];

  const keySignatureOptions: CustomSelectOption<KeySignature>[] = [
    { value: 'C', label: 'Do Mayor / La menor', badge: '0 ♮', description: 'Sin alteraciones' },
    { value: 'G', label: 'Sol Mayor', badge: '1 ♯', description: 'Fa♯' },
    { value: 'D', label: 'Re Mayor', badge: '2 ♯', description: 'Fa♯, Do♯' },
    { value: 'A', label: 'La Mayor', badge: '3 ♯', description: 'Fa♯, Do♯, Sol♯' },
    { value: 'E', label: 'Mi Mayor', badge: '4 ♯', description: 'Fa♯, Do♯, Sol♯, Re♯' },
    { value: 'F', label: 'Fa Mayor', badge: '1 ♭', description: 'Si♭' },
    { value: 'Bb', label: 'Si♭ Mayor', badge: '2 ♭', description: 'Si♭, Mi♭' },
    { value: 'Eb', label: 'Mi♭ Mayor', badge: '3 ♭', description: 'Si♭, Mi♭, La♭' },
    { value: 'Am', label: 'La menor', badge: '0 ♮', description: 'Relativa de Do' },
    { value: 'Em', label: 'Mi menor', badge: '1 ♯', description: 'Fa♯' },
    { value: 'Dm', label: 'Re menor', badge: '1 ♭', description: 'Si♭' },
  ];

  const octaveOptions: CustomSelectOption<number>[] = [
    { value: 1, label: 'Octava 1', badge: 'C1', description: 'Muy grave' },
    { value: 2, label: 'Octava 2', badge: 'C2', description: 'Grave' },
    { value: 3, label: 'Octava 3', badge: 'C3', description: 'Medio grave' },
    { value: 4, label: 'Octava 4', badge: 'C4', description: 'Do Central' },
    { value: 5, label: 'Octava 5', badge: 'C5', description: 'Agudo' },
    { value: 6, label: 'Octava 6', badge: 'C6', description: 'Muy agudo' },
    { value: 7, label: 'Octava 7', badge: 'C7', description: 'Sobreagudo' },
  ];

  return (
    <aside
      id="inspector-container"
      className={`bg-white dark:bg-studio-surface border-l border-slate-200 dark:border-studio-border select-none shrink-0 transition-all duration-200 ease-out flex flex-col ${
        isCollapsed
          ? 'w-12 py-4 items-center overflow-hidden'
          : // ≥ lg: columna lateral de ancho fluido. < lg: cajón fijo superpuesto
            // (overlay) que no comprime el lienzo. El riel plegado de w-12 sigue
            // en flujo en todos los tamaños y sirve siempre de abridor.
            'w-[clamp(280px,22vw,360px)] p-3.5 gap-3 overflow-y-auto max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-sidebar max-lg:w-[min(320px,85vw)] max-lg:shadow-2xl'
      }`}
    >
      {/* Backdrop del modo overlay (< lg): cierra el panel al tocar fuera.
          Está dentro del aside para no reindentar el contenido; al ser fixed
          se posiciona respecto al viewport igualmente. */}
      {!isCollapsed && (
        <div
          aria-hidden="true"
          onClick={onToggleCollapse}
          className="fixed inset-0 z-base bg-black/60 backdrop-blur-xs lg:hidden no-print animate-fade-in"
        />
      )}

      {isCollapsed ? (
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover transition-all duration-150 hover:scale-110 active:scale-90"
            title="Expandir panel inspector"
            aria-label="Expandir panel inspector"
          >
            <PanelRightOpen className="w-5 h-5 text-amber-600 dark:text-studio-accent" />
          </button>
        </div>
      ) : (
        // z-content: mantiene el contenido por encima del backdrop del modo overlay
        <div className="w-full flex flex-col gap-3 relative z-content">
          {/* Header with Undo / Redo and Panel toggle */}
          <div className="flex items-center justify-between px-1 pb-0.5">
            <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
              Inspector
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-studio-hover transition-all duration-150 active:scale-90"
                title="Deshacer (Ctrl+Z)"
                aria-label="Deshacer (Ctrl+Z)"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-studio-hover transition-all duration-150 active:scale-90"
                title="Rehacer (Ctrl+Y)"
                aria-label="Rehacer (Ctrl+Y)"
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

          {/* 3 Fixed Tabs: Nota / Compás / Partitura */}
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

          {/* ========================================================= */}
          {/* TAB 1: NOTA (Contextual a selección) */}
          {/* ========================================================= */}
          {activeTab === 'note' && (
            <div className="space-y-3">
              {selectedItem && selectedItem.type === 'note' && currentPitches.length > 0 ? (
                <div className="space-y-3">
                  {/* Pitch Header: Single Note or Chord voices */}
                  {isChord ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                        Voces del Acorde ({currentPitches.length} notas):
                      </span>
                      <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-0.5">
                        {currentPitches.map((p, idx) => (
                          <div
                            key={`${p.step}-${p.octave}-${p.accidental}-${idx}`}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-studio-card border border-slate-200/80 dark:border-studio-border shadow-2xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-amber-600 dark:text-pastel-amber tracking-tight">
                                {formatPitchName(p, namingConvention)}
                              </span>
                              <span className="text-[9px] bg-amber-100/80 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                                {p.step}
                                {p.accidental || ''}
                                {p.octave}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {pitchToFrequency(p).toFixed(1)} Hz
                              </span>
                            </div>
                            {onRemovePitchFromChord && (
                              <button
                                type="button"
                                onClick={() => onRemovePitchFromChord(idx)}
                                className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                title="Quitar esta nota del acorde"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-studio-card border border-slate-200/80 dark:border-studio-border shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-amber-600 dark:text-pastel-amber tracking-tight">
                          {formatPitchName(currentPitches[0], namingConvention)}
                        </span>
                        <span className="text-[10px] bg-amber-100/80 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold">
                          {currentPitches[0].step}
                          {currentPitches[0].accidental || ''}
                          {currentPitches[0].octave}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-medium">
                        {pitchToFrequency(currentPitches[0]).toFixed(1)} Hz
                      </span>
                    </div>
                  )}

                  {/* Chord Builder: Quick Interval Stacking */}
                  {onAddPitchToChord && (
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                        Armar Acorde (Apilar Intervalos):
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { label: '+3ª m', semi: 3, title: 'Tercera menor (+3 semitonos)' },
                          { label: '+3ª M', semi: 4, title: 'Tercera mayor (+4 semitonos)' },
                          { label: '+5ª J', semi: 7, title: 'Quinta justa (+7 semitonos)' },
                          { label: '+8va', semi: 12, title: 'Octava superior (+12 semitonos)' },
                        ].map((interval) => {
                          const basePitch = currentPitches[currentPitches.length - 1];
                          const baseMidi = basePitch ? pitchToMidi(basePitch) : 60;
                          return (
                            <button
                              key={interval.label}
                              type="button"
                              onClick={() => {
                                const newMidi = baseMidi + interval.semi;
                                const SEMI_MAP: { step: Step; accidental: Accidental }[] = [
                                  { step: 'C', accidental: null },
                                  { step: 'C', accidental: '#' },
                                  { step: 'D', accidental: null },
                                  { step: 'E', accidental: 'b' },
                                  { step: 'E', accidental: null },
                                  { step: 'F', accidental: null },
                                  { step: 'F', accidental: '#' },
                                  { step: 'G', accidental: null },
                                  { step: 'A', accidental: 'b' },
                                  { step: 'A', accidental: null },
                                  { step: 'B', accidental: 'b' },
                                  { step: 'B', accidental: null },
                                ];
                                const bounded = Math.max(21, Math.min(108, newMidi));
                                const oct = Math.floor(bounded / 12) - 1;
                                const s = ((bounded % 12) + 12) % 12;
                                onAddPitchToChord({
                                  step: SEMI_MAP[s].step,
                                  octave: oct,
                                  accidental: SEMI_MAP[s].accidental,
                                });
                              }}
                              className="py-1 px-1 bg-amber-50 hover:bg-amber-100 dark:bg-studio-elevated dark:hover:bg-studio-raised text-amber-900 dark:text-amber-200 border border-amber-200/60 dark:border-amber-900/60 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                              title={interval.title}
                            >
                              {interval.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Read-Only Figure, Dot & Accidental Status (Fase 1: No duplicate toolbar buttons) */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-studio-card border border-slate-200/80 dark:border-studio-border space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Figura rítmica:
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span className="text-base font-serif leading-none">
                          {DURATION_INFO[selectedItem.duration]?.symbol || '𝅘𝅥'}
                        </span>
                        <span>{DURATION_INFO[selectedItem.duration]?.label || 'Negra'}</span>
                        {selectedItem.isDotted && (
                          <span className="text-purple-600 dark:text-purple-400 font-semibold">
                            • Puntillo
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Alteración:
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {currentPitches[0]?.accidental === '#'
                          ? '♯ Sostenido'
                          : currentPitches[0]?.accidental === 'b'
                            ? '♭ Bemol'
                            : '♮ Natural'}
                      </span>
                    </div>

                    {(selectedItem.tuplet || selectedItem.isTied || selectedItem.slur) && (
                      <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-200/60 dark:border-studio-deep/60 text-[10px]">
                        {selectedItem.tuplet && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-semibold">
                            Tresillo (3:2)
                          </span>
                        )}
                        {selectedItem.isTied && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
                            Ligadura (L)
                          </span>
                        )}
                        {selectedItem.slur && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold">
                            Fraseo (⌒)
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-[9px] text-slate-500 dark:text-slate-400 italic pt-0.5 leading-tight">
                      Edita figura y alteraciones con la barra superior o atajos (1–6, ., T, L, #,
                      -).
                    </p>
                  </div>

                  {/* Voice Selector for Selected Note */}
                  {onSetItemVoice && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-studio-card border border-slate-200/80 dark:border-studio-border space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          Voz polifónica:
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedItem.voice === 2 ? 'Voz 2 (Plicas ↓)' : 'Voz 1 (Plicas ↑)'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSetItemVoice(1)}
                          className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 ${
                            (selectedItem.voice || 1) === 1
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white dark:bg-studio-elevated text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-studio-border hover:bg-slate-100'
                          }`}
                        >
                          <span>Voz 1</span>
                          <span>↑</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetItemVoice(2)}
                          className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 ${
                            selectedItem.voice === 2
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-white dark:bg-studio-elevated text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-studio-border hover:bg-slate-100'
                          }`}
                        >
                          <span>Voz 2</span>
                          <span>↓</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Octave Selector for Selected Note */}
                  <div className="flex items-center justify-between py-1 border-y border-slate-200/60 dark:border-studio-deep/60">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Octava:
                    </span>
                    <CustomSelect<number>
                      value={currentPitches[0]?.octave || 4}
                      onChange={(newOctave) => {
                        const baseOctave = currentPitches[0]?.octave || 4;
                        onTransposeSelected((newOctave - baseOctave) * 12);
                      }}
                      options={octaveOptions}
                      className="w-40"
                    />
                  </div>

                  {/* Transposition Actions (Semitones & Octaves) */}
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                      Transportar Nota:
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        type="button"
                        onClick={() => onTransposeSelected(1)}
                        className="py-1 px-1.5 bg-amber-100/80 hover:bg-amber-200 dark:bg-studio-elevated dark:hover:bg-studio-raised text-amber-950 dark:text-amber-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95 shadow-xs"
                        title="Subir un semitono (+1)"
                      >
                        <ArrowUp className="w-2.5 h-2.5 stroke-[2.5]" />
                        <span>+1 Semi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onTransposeSelected(-1)}
                        className="py-1 px-1.5 bg-purple-100/80 hover:bg-purple-200 dark:bg-studio-elevated dark:hover:bg-studio-raised text-purple-950 dark:text-purple-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95 shadow-xs"
                        title="Bajar un semitono (-1)"
                      >
                        <ArrowDown className="w-2.5 h-2.5 stroke-[2.5]" />
                        <span>-1 Semi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onTransposeSelected(12)}
                        className="py-1 px-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-studio-deep dark:hover:bg-studio-raised text-slate-800 dark:text-slate-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95"
                        title="Subir 1 octava (+12 semitonos)"
                      >
                        <ArrowUp className="w-2.5 h-2.5" />
                        <span>+8va</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onTransposeSelected(-12)}
                        className="py-1 px-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-studio-deep dark:hover:bg-studio-raised text-slate-800 dark:text-slate-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95"
                        title="Bajar 1 octava (-12 semitonos)"
                      >
                        <ArrowDown className="w-2.5 h-2.5" />
                        <span>-8va</span>
                      </button>
                    </div>
                  </div>

                  {/* Articulaciones y Expresión (Consolidadas) */}
                  {onSetArticulation && (
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60 dark:border-studio-border">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                        Articulación / Expresión:
                      </span>
                      <div className="grid grid-cols-5 gap-1">
                        {[
                          { key: 'staccato' as const, label: '•', title: 'Staccato (picado)' },
                          { key: 'accent' as const, label: '>', title: 'Acento' },
                          { key: 'tenuto' as const, label: '—', title: 'Tenuto' },
                          { key: 'marcato' as const, label: '^', title: 'Marcato (acento fuerte)' },
                          { key: 'staccatissimo' as const, label: '▼', title: 'Staccatissimo' },
                          { key: 'portato' as const, label: '—•', title: 'Portato' },
                          { key: 'downBow' as const, label: '⊓', title: 'Arco Abajo (tirar)' },
                          { key: 'upBow' as const, label: '∨', title: 'Arco Arriba (empujar)' },
                          { key: 'harmonic' as const, label: '○', title: 'Armónico' },
                          { key: 'fermata' as const, label: '𝄐', title: 'Calderón (fermata)' },
                        ].map((art) => (
                          <button
                            key={art.key}
                            type="button"
                            onClick={() =>
                              onSetArticulation(
                                selectedItem?.articulation === art.key ? null : art.key
                              )
                            }
                            className={`py-1 px-1 rounded-lg text-xs font-bold transition-all active:scale-95 border ${
                              selectedItem.articulation === art.key
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                            }`}
                            title={art.title}
                          >
                            {art.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dinámica y Reguladores */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60 dark:border-studio-border">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                      Dinámica Musical:
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sfz', 'fp'].map((dyn) => (
                        <button
                          key={dyn}
                          type="button"
                          onClick={() =>
                            onSetDynamic?.(selectedItem.dynamic === dyn ? null : (dyn as Dynamic))
                          }
                          className={`py-0.5 px-1 rounded-lg text-[10px] font-serif font-black italic transition-all border ${
                            selectedItem.dynamic === dyn
                              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                              : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                          }`}
                        >
                          {dyn}
                        </button>
                      ))}
                    </div>

                    {/* Hairpins Crescendo / Decrescendo */}
                    <div className="grid grid-cols-3 gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onSetHairpin?.(selectedItem.hairpin === 'cresc' ? null : 'cresc')
                        }
                        className={`py-1 px-1 rounded-lg text-xs font-bold transition-all border ${
                          selectedItem.hairpin === 'cresc'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                        }`}
                        title="Iniciar Crescendo (<)"
                      >
                        &lt; Cresc.
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSetHairpin?.(selectedItem.hairpin === 'decresc' ? null : 'decresc')
                        }
                        className={`py-1 px-1 rounded-lg text-xs font-bold transition-all border ${
                          selectedItem.hairpin === 'decresc'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                        }`}
                        title="Iniciar Decrescendo (>)"
                      >
                        &gt; Decresc.
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSetHairpin?.(selectedItem.hairpin === 'stop' ? null : 'stop')
                        }
                        className={`py-1 px-1 rounded-lg text-xs font-bold transition-all border ${
                          selectedItem.hairpin === 'stop'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                        }`}
                        title="Finalizar cuña de regulador en esta nota"
                      >
                        Fin Cuña
                      </button>
                    </div>

                    {/* Piano Pedal */}
                    <div className="flex items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          onSetPedal?.(selectedItem.pedal === 'start' ? undefined : 'start')
                        }
                        className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-serif font-black italic transition-all border ${
                          selectedItem.pedal === 'start'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                        }`}
                        title="Presionar pedal de resonancia"
                      >
                        Pedal (Ped.)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSetPedal?.(selectedItem.pedal === 'stop' ? undefined : 'stop')
                        }
                        className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-serif font-black transition-all border ${
                          selectedItem.pedal === 'stop'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                        }`}
                        title="Liberar pedal de resonancia"
                      >
                        Soltar (*)
                      </button>
                    </div>
                  </div>

                  {/* Ornamentos, Digitación y Tipo de Nota */}
                  <div className="space-y-2 pt-1.5 border-t border-slate-200/60 dark:border-studio-border">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                        Ornamentos:
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { key: 'trill' as const, label: 'tr', title: 'Trino' },
                          { key: 'mordent' as const, label: '∿', title: 'Mordente' },
                          { key: 'turn' as const, label: '𝆗', title: 'Grupeto' },
                          { key: 'arpeggio' as const, label: '⌇', title: 'Arpegio' },
                        ].map((orn) => (
                          <button
                            key={orn.key}
                            type="button"
                            onClick={() =>
                              onSetOrnament?.(selectedItem.ornament === orn.key ? null : orn.key)
                            }
                            className={`py-1 px-1 rounded-lg text-xs font-serif font-bold italic transition-all active:scale-95 border ${
                              selectedItem.ornament === orn.key
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                            }`}
                            title={orn.title}
                          >
                            {orn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Digitación */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                        <span>Digitación:</span>
                        {selectedItem.fingering && (
                          <button
                            type="button"
                            onClick={() => onSetFingering?.(undefined)}
                            className="text-rose-500 hover:text-rose-600 font-bold"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() =>
                              onSetFingering?.(selectedItem.fingering === num ? undefined : num)
                            }
                            className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                              selectedItem.fingering === num
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tipo de Nota */}
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                        Tipo de Nota:
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        <button
                          type="button"
                          onClick={() => onSetNoteType?.('standard')}
                          className={`py-1 px-1 rounded-lg text-[10px] font-bold transition-all border ${
                            !selectedItem.noteType || selectedItem.noteType === 'standard'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                          }`}
                        >
                          Normal
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetNoteType?.('grace', 'acciaccatura')}
                          className={`py-1 px-1 rounded-lg text-[10px] font-bold transition-all border ${
                            selectedItem.noteType === 'grace' &&
                            selectedItem.graceType === 'acciaccatura'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                          }`}
                          title="Acciaccatura (nota breve tachada)"
                        >
                          Acciacc.
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetNoteType?.('grace', 'appoggiatura')}
                          className={`py-1 px-1 rounded-lg text-[10px] font-bold transition-all border ${
                            selectedItem.noteType === 'grace' &&
                            selectedItem.graceType === 'appoggiatura'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                          }`}
                          title="Appoggiatura"
                        >
                          Appogg.
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetNoteType?.('slash')}
                          className={`py-1 px-1 rounded-lg text-[10px] font-bold transition-all border ${
                            selectedItem.noteType === 'slash'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-hover text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                          }`}
                          title="Rasgueo rítmico"
                        >
                          Rasgueo
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Song Lyric / Syllable Input */}
                  <div className="pt-1.5 border-t border-slate-200/60 dark:border-studio-border">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                      <Type className="w-3 h-3" />
                      <span>Letra de la canción (Lírica):</span>
                    </div>
                    <input
                      type="text"
                      value={selectedItem.lyric || ''}
                      onChange={(e) => onUpdateLyric(e.target.value)}
                      placeholder="Ej: Glo- o ria"
                      className="w-full bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-studio-accent transition-colors"
                      title="Escribe la sílaba o palabra para esta nota"
                    />
                  </div>

                  {/* Chord Symbol / Lead Sheet */}
                  {onUpdateChord && (
                    <div className="pt-1.5 border-t border-slate-200/60 dark:border-studio-border">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                        <div className="flex items-center gap-1">
                          <Music className="w-3 h-3 text-amber-500" />
                          <span>Cifrado de Acorde:</span>
                        </div>
                        {selectedItem.chord && (
                          <button
                            type="button"
                            onClick={() => onUpdateChord(undefined)}
                            className="text-rose-500 hover:text-rose-600 font-bold"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={selectedItem.chord || ''}
                        onChange={(e) => onUpdateChord(e.target.value)}
                        placeholder="Ej: C, G7, Am, C/E..."
                        className="w-full bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-pastel-amber outline-none focus:border-studio-accent transition-all mb-1.5"
                      />
                      {/* Diatonic Chord Quick Pills */}
                      <div className="flex flex-wrap gap-1">
                        {getDiatonicChordsForKey(score.keySignature, namingConvention).map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => onUpdateChord(ch)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all active:scale-90 ${
                              selectedItem?.chord === ch
                                ? 'bg-amber-200 text-amber-950 ring-1 ring-amber-400 shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-studio-line'
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={onDeleteSelected}
                    className="w-full py-1.5 px-2 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs"
                    title="Eliminar nota seleccionada (Supr)"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Eliminar Nota (Supr)</span>
                  </button>
                </div>
              ) : selectedItem && selectedItem.type === 'rest' ? (
                /* Rest Selected View */
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-studio-card border border-slate-200/80 dark:border-studio-border">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                      Elemento Seleccionado:
                    </span>
                    <span className="text-sm font-bold text-amber-600 dark:text-pastel-amber block mt-0.5">
                      Silencio de {DURATION_INFO[selectedItem.duration]?.label || 'Negra'}
                    </span>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 italic mt-1 leading-tight">
                      Cambia la duración del silencio con los atajos numéricos 1–6 o la barra
                      superior.
                    </p>
                  </div>

                  {/* Chord Symbol on Rest */}
                  {onUpdateChord && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                        <div className="flex items-center gap-1">
                          <Music className="w-3 h-3 text-amber-500" />
                          <span>Cifrado de Acorde:</span>
                        </div>
                        {selectedItem.chord && (
                          <button
                            type="button"
                            onClick={() => onUpdateChord(undefined)}
                            className="text-rose-500 hover:text-rose-600 font-bold"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={selectedItem.chord || ''}
                        onChange={(e) => onUpdateChord(e.target.value)}
                        placeholder="Ej: C, G7, Am, C/E..."
                        className="w-full bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-pastel-amber outline-none focus:border-studio-accent mb-1.5"
                      />
                      <div className="flex flex-wrap gap-1">
                        {getDiatonicChordsForKey(score.keySignature, namingConvention).map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => onUpdateChord(ch)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all active:scale-90 ${
                              selectedItem?.chord === ch
                                ? 'bg-amber-200 text-amber-950 ring-1 ring-amber-400 shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-studio-line'
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onDeleteSelected}
                    className="w-full py-1.5 px-2 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Eliminar Silencio</span>
                  </button>
                </div>
              ) : (
                /* Empty State: Requisito 1.2 — No selection */
                <div className="p-5 rounded-2xl bg-slate-50/90 dark:bg-studio-card border border-dashed border-slate-200 dark:border-studio-lineSoft text-center space-y-3 my-1">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100/70 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                    <Music className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Sin nota seleccionada
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Haz clic en cualquier nota o silencio del pentagrama para ver y modificar su
                      altura, articulaciones y dinámica.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border text-left space-y-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                      Atajos rápidos:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-studio-deep font-mono text-[9px] text-slate-700 dark:text-slate-300 font-bold">
                        1–6
                      </kbd>
                      <span>Elegir figura (redonda a fusa)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-studio-deep font-mono text-[9px] text-slate-700 dark:text-slate-300 font-bold">
                        R
                      </kbd>
                      <span>Modo silencio</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-studio-deep font-mono text-[9px] text-slate-700 dark:text-slate-300 font-bold">
                        V
                      </kbd>
                      <span>Alternar entre Voz 1 y Voz 2</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-studio-deep font-mono text-[9px] text-slate-700 dark:text-slate-300 font-bold">
                        A–G
                      </kbd>
                      <span>Insertar notas directamente</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: COMPÁS (Contextual al compás seleccionado) */}
          {/* ========================================================= */}
          {activeTab === 'measure' && (
            <div className="space-y-3">
              {/* Header Info */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-studio-card border border-slate-200/80 dark:border-studio-border">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Compás Activo:
                  </span>
                  <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                    {currentMeasure?.isAnacrusis
                      ? 'Compás 0 (Anacrusa)'
                      : `Compás ${selectedMeasureIdx + 1} de ${score.staves[0]?.measures.length || 1}`}
                  </span>
                </div>
                {currentMeasure?.volta && (
                  <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                    Casilla {currentMeasure.volta}
                  </span>
                )}
              </div>

              {/* Indicador de capacidad métrica */}
              {(() => {
                const usedBeats = currentMeasure
                  ? currentMeasure.items.reduce(
                      (sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet),
                      0
                    )
                  : 0;
                const capacityBeats = currentMeasure
                  ? resolveMeasureCapacity(score, currentMeasure, selectedMeasureIdx)
                  : 4;
                const pct = capacityBeats > 0 ? Math.round((usedBeats / capacityBeats) * 100) : 0;
                const isOverfilled = usedBeats > capacityBeats + 0.001;
                const isComplete = Math.abs(usedBeats - capacityBeats) < 0.001;

                const statusColor = isOverfilled
                  ? 'text-rose-600 dark:text-rose-400'
                  : isComplete
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400';

                const barBg = isOverfilled
                  ? 'bg-rose-500'
                  : isComplete
                    ? 'bg-emerald-500'
                    : 'bg-amber-500';

                const statusLabel = isOverfilled
                  ? 'Desbordado'
                  : isComplete
                    ? 'Completo'
                    : 'Incompleto';

                return (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-studio-card border border-slate-200/80 dark:border-studio-border space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        Capacidad Métrica:
                      </span>
                      <span className={`font-bold ${statusColor}`}>
                        {statusLabel} ({Number(usedBeats.toFixed(2))} / {capacityBeats} pulsos)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-studio-surface rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barBg}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Compás de Anacrusa (si es el compás 0) */}
              {selectedMeasureIdx === 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-studio-card border border-slate-200/80 dark:border-studio-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Compás de Anacrusa (Entrada):
                    </span>
                    {currentMeasure?.isAnacrusis && (
                      <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                        {currentMeasure.pickupBeats ?? 1} tiempo(s)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onSetAnacrusis?.(
                        0,
                        !currentMeasure?.isAnacrusis,
                        currentMeasure?.pickupBeats || 1
                      )
                    }
                    className={`w-full py-1.5 px-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95 border ${
                      currentMeasure?.isAnacrusis
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-studio-surface dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                    }`}
                  >
                    <span>
                      {currentMeasure?.isAnacrusis
                        ? '✓ Compás 0 es Anacrusa'
                        : 'Convertir en Anacrusa'}
                    </span>
                  </button>
                  {currentMeasure?.isAnacrusis && (
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[0.5, 1, 2, 3].map((beats) => (
                        <button
                          key={beats}
                          type="button"
                          onClick={() => onSetAnacrusis?.(0, true, beats)}
                          className={`py-1 text-[10px] font-bold rounded-lg transition-all active:scale-95 border ${
                            (currentMeasure.pickupBeats ?? 1) === beats
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white hover:bg-slate-100 dark:bg-studio-surface text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                          }`}
                        >
                          {beats === 0.5 ? '½ t.' : `${beats} t.`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Repeticiones & Voltas */}
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Barras de Repetición y Voltas:
                </span>
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleRepeatStart?.(selectedMeasureIdx)}
                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 border ${
                      currentMeasure?.repeatStart
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                    }`}
                    title="Apertura de repetición (|:)"
                  >
                    <span className="font-mono text-sm leading-none">|:</span>
                    <span>Apertura</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleRepeatEnd?.(selectedMeasureIdx)}
                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 border ${
                      currentMeasure?.repeatEnd
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                    }`}
                    title="Cierre de repetición (:|)"
                  >
                    <span>Cierre</span>
                    <span className="font-mono text-sm leading-none">:|</span>
                  </button>
                </div>

                {/* Casillas de Repetición */}
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { val: '1.', label: '1.ª vez' },
                    { val: '2.', label: '2.ª vez' },
                    { val: '1, 3.', label: '1, 3.' },
                  ].map((v) => (
                    <button
                      key={v.val}
                      type="button"
                      onClick={() =>
                        onSetVolta?.(
                          selectedMeasureIdx,
                          currentMeasure?.volta === v.val ? null : v.val
                        )
                      }
                      className={`py-1 px-1 text-[10px] font-bold rounded-lg transition-all active:scale-95 border ${
                        currentMeasure?.volta === v.val
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onSetVolta?.(selectedMeasureIdx, null)}
                    className="py-1 px-1 text-[10px] font-medium rounded-lg text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-studio-line"
                  >
                    Quitar
                  </button>
                </div>
              </div>

              {/* Barra de Compás (Barline) */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Barra de Compás:
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'standard' as const, label: '| Normal' },
                    { id: 'double' as const, label: '|| Doble' },
                    { id: 'final' as const, label: '|] Final' },
                  ].map((bar) => {
                    const isCurrent =
                      (!currentMeasure?.barline && bar.id === 'standard') ||
                      currentMeasure?.barline === bar.id;
                    return (
                      <button
                        key={bar.id}
                        type="button"
                        onClick={() =>
                          onSetBarline?.(
                            selectedMeasureIdx,
                            bar.id === 'standard' ? undefined : bar.id
                          )
                        }
                        className={`py-1 px-1 text-[10px] font-bold rounded-lg transition-all border ${
                          isCurrent
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                        }`}
                      >
                        {bar.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navegación y Forma Musical */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Navegación / Forma Musical:
                </span>
                <div className="grid grid-cols-3 gap-1 mb-1">
                  {[
                    { id: 'segno' as const, label: '𝄋 Segno' },
                    { id: 'coda' as const, label: '𝄌 Coda' },
                    { id: 'fine' as const, label: 'Fine' },
                    { id: 'dalSegno' as const, label: 'D.S.' },
                    { id: 'daCapo' as const, label: 'D.C.' },
                    { id: 'toCoda' as const, label: 'To Coda' },
                  ].map((nav) => {
                    const isSelected = currentMeasure?.navigationMark === nav.id;
                    return (
                      <button
                        key={nav.id}
                        type="button"
                        onClick={() =>
                          onSetNavigationMark?.(selectedMeasureIdx, isSelected ? undefined : nav.id)
                        }
                        className={`py-1 px-1 text-[10px] font-bold rounded-lg transition-all border ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                        }`}
                      >
                        {nav.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Letra de Ensayo (Rehearsal Mark) */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Letra de Ensayo:
                  </span>
                  {currentMeasure?.rehearsalMark && (
                    <button
                      type="button"
                      onClick={() => onSetRehearsalMark?.(selectedMeasureIdx, undefined)}
                      className="text-[9px] text-rose-500 hover:text-rose-600 font-bold"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 mb-1">
                  {['A', 'B', 'C', 'Intro', 'Coro'].map((mark) => (
                    <button
                      key={mark}
                      type="button"
                      onClick={() =>
                        onSetRehearsalMark?.(
                          selectedMeasureIdx,
                          currentMeasure?.rehearsalMark === mark ? undefined : mark
                        )
                      }
                      className={`flex-1 py-0.5 rounded text-[10px] font-bold border transition-all ${
                        currentMeasure?.rehearsalMark === mark
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                      }`}
                    >
                      [{mark}]
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={currentMeasure?.rehearsalMark || ''}
                  onChange={(e) =>
                    onSetRehearsalMark?.(selectedMeasureIdx, e.target.value || undefined)
                  }
                  placeholder="Texto o letra personalizada (ej: [E])"
                  className="w-full bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2 py-0.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Signos de Compás: Repetición %, Cesura //, Respiración */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Signos del Compás:
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleRepeatSign?.(selectedMeasureIdx)}
                    className={`py-1 px-1 text-[10px] font-bold rounded-lg transition-all border ${
                      currentMeasure?.isMeasureRepeat
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                    }`}
                    title="Repetición de compás (signo %)"
                  >
                    % Repetir
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleCaesura?.(selectedMeasureIdx)}
                    className={`py-1 px-1 text-[10px] font-bold rounded-lg transition-all border ${
                      currentMeasure?.caesura
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                    }`}
                    title="Cesura (pausa //)"
                  >
                    // Cesura
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleBreathMark?.(selectedMeasureIdx)}
                    className={`py-1 px-1 text-[10px] font-bold rounded-lg transition-all border ${
                      currentMeasure?.breathMark
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                    }`}
                    title="Respiración"
                  >
                    ’ Respirac.
                  </button>
                </div>
              </div>

              {/* Tempo Local */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Tempo Local en este Compás:
                </span>
                <div className="flex items-center gap-1 mb-1">
                  <input
                    type="text"
                    value={currentMeasure?.tempoText || ''}
                    onChange={(e) =>
                      onSetTempoText?.(
                        selectedMeasureIdx,
                        e.target.value || undefined,
                        currentMeasure?.tempoBpm
                      )
                    }
                    placeholder="Ej: Andante, Rit., A tempo"
                    className="flex-1 bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2 py-0.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  />
                  <input
                    type="number"
                    value={currentMeasure?.tempoBpm ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                      onSetTempoText?.(selectedMeasureIdx, currentMeasure?.tempoText, val);
                    }}
                    placeholder="BPM"
                    className="w-16 bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2 py-0.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Cambio Métrico Local */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Cambio de Compás local:
                  </span>
                  {currentMeasure?.timeSignatureChange && (
                    <button
                      type="button"
                      onClick={() => onSetTimeSignatureChange?.(selectedMeasureIdx, undefined)}
                      className="text-[9px] text-rose-500 hover:text-rose-600 font-bold"
                    >
                      Heredar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { beats: 2, beatType: 4 },
                    { beats: 3, beatType: 4 },
                    { beats: 4, beatType: 4 },
                    { beats: 6, beatType: 8 },
                    { beats: 12, beatType: 8 },
                  ].map((ts) => {
                    const isCurrent =
                      currentMeasure?.timeSignatureChange?.beats === ts.beats &&
                      currentMeasure?.timeSignatureChange?.beatType === ts.beatType;
                    return (
                      <button
                        key={`${ts.beats}/${ts.beatType}`}
                        type="button"
                        onClick={() =>
                          onSetTimeSignatureChange?.(selectedMeasureIdx, isCurrent ? undefined : ts)
                        }
                        className={`py-0.5 rounded text-[10px] font-bold border transition-all ${
                          isCurrent
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                        }`}
                      >
                        {ts.beats}/{ts.beatType}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cambio de Tonalidad Local */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Cambio de Tonalidad local:
                  </span>
                  {currentMeasure?.keySignatureChange && (
                    <button
                      type="button"
                      onClick={() => onSetKeySignatureChange?.(selectedMeasureIdx, undefined)}
                      className="text-[9px] text-rose-500 hover:text-rose-600 font-bold"
                    >
                      Heredar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(['C', 'G', 'D', 'F', 'Bb'] as KeySignature[]).map((ks) => (
                    <button
                      key={ks}
                      type="button"
                      onClick={() =>
                        onSetKeySignatureChange?.(
                          selectedMeasureIdx,
                          currentMeasure?.keySignatureChange === ks ? undefined : ks
                        )
                      }
                      className={`flex-1 py-0.5 rounded text-[10px] font-bold border transition-all ${
                        currentMeasure?.keySignatureChange === ks
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                      }`}
                    >
                      {ks}
                    </button>
                  ))}
                </div>
              </div>

              {/* Saltos de Formato (Sistema y Página) */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Maquetación del Compás:
                </span>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => onToggleSystemBreak?.(selectedMeasureIdx)}
                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95 border ${
                      currentMeasure?.systemBreak
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                    }`}
                    title="Forzar salto de línea/sistema tras este compás"
                  >
                    <span>↵ Salto Sistema</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTogglePageBreak?.(selectedMeasureIdx)}
                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95 border ${
                      currentMeasure?.pageBreak
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                    }`}
                    title="Forzar salto de página tras este compás"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Salto Página</span>
                  </button>
                </div>

                {/* Silencio Multicompás (Tacet) */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-400 font-medium">
                    Silencio Multicompás (Tacet):
                  </span>
                  {currentMeasure?.multimeasureRest && (
                    <span className="text-[9px] bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">
                      {currentMeasure.multimeasureRest} c.
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: 'Normal', count: undefined },
                    { label: '2 c.', count: 2 },
                    { label: '4 c.', count: 4 },
                    { label: '8 c.', count: 8 },
                  ].map(({ label, count }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onSetMultimeasureRest?.(selectedMeasureIdx, count)}
                      className={`py-1 px-1 text-[10px] font-bold rounded-lg transition-all border ${
                        (!count && !currentMeasure?.multimeasureRest) ||
                        currentMeasure?.multimeasureRest === count
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 dark:bg-studio-card text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 pt-1.5">
                  <button
                    type="button"
                    onClick={() => onAutoConsolidateTacets?.(selectedStaffIdx)}
                    className="flex-1 py-1 px-1 text-[9px] font-semibold rounded-md border border-slate-200 dark:border-studio-line hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    title="Agrupa automáticamente todos los silencios vacíos continuos de 2 o más compases"
                  >
                    Auto Tacets
                  </button>
                  <button
                    type="button"
                    onClick={() => onClearAllTacets?.(selectedStaffIdx)}
                    className="py-1 px-1.5 text-[9px] font-semibold rounded-md border border-slate-200 dark:border-studio-line hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    title="Deshace los tacets y muestra todos los compases individuales"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Portapapeles de Compases */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Portapapeles de Compases:
                  </span>
                  {measureRange && (
                    <span className="text-[9px] bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">
                      {Math.abs(measureRange.end - measureRange.start) + 1} c. selec.
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <button
                    type="button"
                    onClick={onCopyMeasureRange}
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-studio-card dark:hover:bg-studio-deep text-slate-700 dark:text-slate-300 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95 border border-slate-200 dark:border-studio-line"
                    title="Copiar compás o rango (Ctrl+C)"
                  >
                    <Copy className="w-3 h-3 text-blue-500" />
                    <span>Copiar</span>
                  </button>

                  <button
                    type="button"
                    onClick={onPasteMeasureRange}
                    disabled={!hasClipboardMeasures}
                    className={`py-1.5 px-2 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95 border ${
                      hasClipboardMeasures
                        ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-studio-card text-slate-400 border-slate-200 dark:border-studio-line cursor-not-allowed opacity-60'
                    }`}
                    title="Pegar compases copiados (Ctrl+V)"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Pegar</span>
                  </button>
                </div>

                {measureRange &&
                  Math.abs(measureRange.end - measureRange.start) > 0 &&
                  onDeleteSelectedMeasures && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'range',
                          count: Math.abs(measureRange.end - measureRange.start) + 1,
                        })
                      }
                      className="w-full py-1.5 px-2 mb-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95 border border-rose-200 dark:border-rose-900/50"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>
                        Eliminar Rango ({Math.abs(measureRange.end - measureRange.start) + 1}{' '}
                        compases)
                      </span>
                    </button>
                  )}
              </div>

              {/* Add / Delete Measure Buttons */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-studio-border">
                <button
                  type="button"
                  onClick={onAddMeasure}
                  className="flex-1 py-1.5 px-2 bg-lime-100 hover:bg-lime-200 dark:bg-lime-950/40 text-lime-950 dark:text-lime-300 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 border border-lime-300 dark:border-lime-800 shadow-xs"
                  title="Añadir un compás al final"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>Añadir Compás</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ type: 'single' })}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-studio-card text-slate-700 dark:text-slate-300 font-semibold text-[11px] rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-studio-line"
                  title="Eliminar el último compás"
                >
                  - Eliminar
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: PARTITURA (Global y Metadatos) */}
          {/* ========================================================= */}
          {activeTab === 'score' && (
            <div className="space-y-3">
              {/* Grand Staff & System Type */}
              {onToggleGrandStaff && canToggleGrandStaff && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-studio-border">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    Sistema:
                  </span>
                  <button
                    type="button"
                    onClick={onToggleGrandStaff}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                      isGrandStaff
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-studio-card text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-studio-line'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{isGrandStaff ? 'Gran Pentagrama' : 'Pentagrama Único'}</span>
                  </button>
                </div>
              )}

              {/* View mode: General score vs one part (moved out of the document flow) */}
              {onSelectViewMode && score.staves.length > 1 && (
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-studio-border">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium shrink-0">
                    Vista:
                  </span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => onSelectViewMode('full')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
                        viewMode === 'full'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-studio-card text-slate-600 dark:text-slate-300'
                      }`}
                      title="Partitura general con todos los pentagramas"
                    >
                      <LayoutGrid className="w-3 h-3" />
                      <span>General</span>
                    </button>
                    {score.staves.map((st, sIdx) => (
                      <button
                        key={st.id || `view-staff-${sIdx}`}
                        type="button"
                        onClick={() => {
                          onSelectViewMode('part');
                          onSelectPartStaffIdx?.(sIdx);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          viewMode === 'part' && activePartStaffIdx === sIdx
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-studio-card text-slate-600 dark:text-slate-300'
                        }`}
                        title={`Ver solo el pentagrama: ${st.name || `Instrumento ${sIdx + 1}`}`}
                      >
                        {st.name || `Instr. ${sIdx + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Format & Layout Mode */}
              {onSelectLayoutMode && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-studio-border">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    Maquetación:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectLayoutMode('continuous')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
                        layoutMode === 'continuous'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-studio-card text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <ScrollText className="w-3 h-3" />
                      <span>Continuo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectLayoutMode('paged')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
                        layoutMode === 'paged'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-studio-card text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <FileStack className="w-3 h-3" />
                      <span>Páginas A4</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Measures Per System */}
              {onSetMeasuresPerSystem && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-studio-border">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    Compases/Línea:
                  </span>
                  <div className="flex items-center gap-1">
                    {[2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => onSetMeasuresPerSystem(num)}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
                          measuresPerSystem === num
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-studio-card text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Print / PDF (moved out of the document flow) */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-studio-border">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  Impresión:
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2 py-0.5 rounded text-[10px] font-bold transition-all bg-slate-100 hover:bg-slate-200 dark:bg-studio-card text-slate-600 dark:text-slate-300 active:scale-95 flex items-center gap-1"
                  title="Imprimir partitura o exportar a PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>
              </div>

              {/* Clef selector */}
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-studio-deep/60">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  Clave:
                </span>
                <CustomSelect<Clef>
                  value={clef}
                  onChange={onUpdateClef}
                  options={clefOptions}
                  className="w-44"
                />
              </div>

              {/* Time signature selector */}
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-studio-deep/60">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  Compás:
                </span>
                <CustomSelect<string>
                  value={`${timeSignature.beats}/${timeSignature.beatType}`}
                  onChange={(val) => {
                    const parts = val.split('/');
                    const b = parseInt(parts[0], 10) || 4;
                    const bt = parseInt(parts[1], 10) || 4;
                    onUpdateTimeSignature({ beats: b, beatType: bt });
                  }}
                  options={timeSignatureOptions}
                  className="w-44"
                />
              </div>

              {/* Key signature selector */}
              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  Tonalidad:
                </span>
                <CustomSelect<KeySignature>
                  value={keySignature}
                  onChange={(newKey) => {
                    if (onChangeKeySignatureAndTranspose) {
                      onChangeKeySignatureAndTranspose(newKey, autoTransposeNotes);
                    } else {
                      onUpdateKeySignature(newKey);
                    }
                  }}
                  options={keySignatureOptions}
                  className="w-44"
                />
              </div>

              <div className="flex items-center gap-2 pt-0.5 pb-2 border-b border-slate-200/60 dark:border-studio-border">
                <input
                  type="checkbox"
                  id="auto-trans-check"
                  checked={autoTransposeNotes}
                  onChange={(e) => setAutoTransposeNotes(e.target.checked)}
                  className="w-3.5 h-3.5 accent-studio-accent rounded cursor-pointer"
                />
                <label
                  htmlFor="auto-trans-check"
                  className="text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer select-none font-medium"
                >
                  Transponer notas al cambiar tonalidad
                </label>
              </div>

              {/* Whole Score Transposition */}
              {onTransposeScore && (
                <div className="pb-2 border-b border-slate-200/60 dark:border-studio-border">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                    Transponer toda la obra:
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => onTransposeScore(1)}
                      className="py-1 px-1 bg-amber-100 hover:bg-amber-200 dark:bg-studio-elevated text-amber-950 dark:text-amber-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95 shadow-2xs"
                      title="Subir toda la obra 1 semitono"
                    >
                      <ArrowUp className="w-2.5 h-2.5" />
                      <span>+1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTransposeScore(-1)}
                      className="py-1 px-1 bg-purple-100 hover:bg-purple-200 dark:bg-studio-elevated text-purple-950 dark:text-purple-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95 shadow-2xs"
                      title="Bajar toda la obra 1 semitono"
                    >
                      <ArrowDown className="w-2.5 h-2.5" />
                      <span>-1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTransposeScore(12)}
                      className="py-1 px-1 bg-slate-100 hover:bg-slate-200 dark:bg-studio-deep text-slate-800 dark:text-slate-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95 shadow-2xs"
                      title="Subir toda la obra 1 octava"
                    >
                      <ArrowUp className="w-2.5 h-2.5" />
                      <span>+8va</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTransposeScore(-12)}
                      className="py-1 px-1 bg-slate-100 hover:bg-slate-200 dark:bg-studio-deep text-slate-800 dark:text-slate-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95 shadow-2xs"
                      title="Bajar toda la obra 1 octava"
                    >
                      <ArrowDown className="w-2.5 h-2.5" />
                      <span>-8va</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Instrumentos / Ensamble */}
              <div className="pb-2 border-b border-slate-200/60 dark:border-studio-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Instrumentos ({score.staves.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => onAddStaff?.()}
                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1 transition-all active:scale-95"
                  >
                    <span>+ Añadir</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {score.staves.map((st, sIdx) => {
                    const isSelected = (selectedStaffIdx ?? 0) === sIdx;
                    return (
                      <div
                        key={st.id || `inspector-staff-${sIdx}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectStaff?.(sIdx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectStaff?.(sIdx);
                          }
                        }}
                        className={`p-2 rounded-lg border text-[11px] transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-studio-card border-slate-200 dark:border-studio-line'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <input
                            type="text"
                            value={st.name}
                            onChange={(e) => onUpdateStaffName?.(sIdx, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none rounded px-1 py-0.5 w-full text-xs"
                            placeholder="Nombre del instrumento"
                          />
                          {score.staves.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveStaff?.(sIdx);
                              }}
                              className="text-rose-500 hover:text-rose-700 p-0.5 rounded"
                              title="Eliminar este instrumento"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <span>Clave:</span>
                          <div className="flex items-center gap-1">
                            {(['treble', 'bass', 'alto'] as Clef[]).map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateStaffClef?.(sIdx, c);
                                }}
                                className={`px-1.5 py-0.5 rounded font-mono font-bold transition-all ${
                                  st.clef === c
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-200 dark:bg-studio-deep text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {c === 'treble' ? 'Sol' : c === 'bass' ? 'Fa' : 'Do'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Presets y Añadir Instrumento (Opción A: Universal y Funcional) */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-studio-border space-y-2">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block">
                    Añadir rápido:
                  </span>

                  {/* Atajos universales: Melodía, Bajo, Armonía, Piano */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAddStaff?.('Melodía', 'treble')}
                      className="px-2 py-1 text-[10px] font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-600 dark:bg-studio-card dark:hover:bg-blue-950/40 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-studio-line flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
                      title="Añadir pentagrama melódico en Clave de Sol (Voz, Flauta, Violín, Guitarra, etc.)"
                    >
                      <span>+ Melodía</span>
                      <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-slate-200 dark:bg-studio-deep text-slate-600 dark:text-slate-400">
                        Sol
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onAddStaff?.('Bajo', 'bass')}
                      className="px-2 py-1 text-[10px] font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-600 dark:bg-studio-card dark:hover:bg-blue-950/40 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-studio-line flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
                      title="Añadir pentagrama grave en Clave de Fa (Bajo eléctrico, Contrabajo, Cello, etc.)"
                    >
                      <span>+ Bajo</span>
                      <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-slate-200 dark:bg-studio-deep text-slate-600 dark:text-slate-400">
                        Fa
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onAddStaff?.('Armonía', 'alto')}
                      className="px-2 py-1 text-[10px] font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-600 dark:bg-studio-card dark:hover:bg-blue-950/40 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-studio-line flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
                      title="Añadir pentagrama intermedio en Clave de Do (Viola, etc.)"
                    >
                      <span>+ Armonía</span>
                      <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-slate-200 dark:bg-studio-deep text-slate-600 dark:text-slate-400">
                        Do
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (canToggleGrandStaff && onToggleGrandStaff && !isGrandStaff) {
                          onToggleGrandStaff();
                        } else {
                          onAddStaff?.('Piano', 'treble');
                        }
                      }}
                      className={`px-2 py-1 text-[10px] font-medium rounded-md border flex items-center justify-between transition-colors shadow-2xs cursor-pointer ${
                        isGrandStaff
                          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-100 hover:bg-purple-50 hover:text-purple-600 dark:bg-studio-card dark:hover:bg-purple-950/40 dark:hover:text-purple-400 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                      }`}
                      title={
                        isGrandStaff
                          ? 'Gran Pentagrama ya activo'
                          : 'Gran Pentagrama para piano/teclado (Sol + Fa unidos con llave)'
                      }
                    >
                      <span>{isGrandStaff ? 'Piano (Activo)' : '+ Piano'}</span>
                      <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                        Sol+Fa
                      </span>
                    </button>
                  </div>

                  {/* Añadir instrumento personalizado con nombre y clave */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                      O instrumento personalizado:
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomStaff();
                          }
                        }}
                        placeholder="Ej: Guitarra, Saxofón..."
                        className="flex-1 min-w-0 bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded px-2 py-1 text-[11px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-normal"
                      />

                      <div className="flex rounded border border-slate-200 dark:border-studio-line overflow-hidden shrink-0 bg-slate-50 dark:bg-studio-deep">
                        {(['treble', 'bass', 'alto'] as Clef[]).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewStaffClef(c)}
                            className={`px-1.5 py-1 text-[9px] font-mono font-bold transition-all cursor-pointer ${
                              newStaffClef === c
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-studio-card'
                            }`}
                            title={`Clave de ${c === 'treble' ? 'Sol' : c === 'bass' ? 'Fa' : 'Do'}`}
                          >
                            {c === 'treble' ? 'Sol' : c === 'bass' ? 'Fa' : 'Do'}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddCustomStaff}
                        className="px-2 py-1 text-[10px] font-bold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-xs shrink-0 transition-all active:scale-95 cursor-pointer"
                        title="Añadir este instrumento a la partitura"
                      >
                        + Añadir
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadatos y Publicación */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                  <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                  <span>Metadatos de Publicación:</span>
                </div>

                {/* Subtítulo */}
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">
                    <span>Subtítulo:</span>
                    <input
                      type="text"
                      value={score.subtitle || ''}
                      onChange={(e) => onUpdateScoreMetadata?.({ subtitle: e.target.value })}
                      placeholder="Ej: Para Orquesta de Cuerdas"
                      className="w-full mt-0.5 bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-studio-accent font-normal"
                    />
                  </label>
                </div>

                {/* Letrista */}
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">
                    <span>Letrista / Arreglista:</span>
                    <input
                      type="text"
                      value={score.lyricist || ''}
                      onChange={(e) => onUpdateScoreMetadata?.({ lyricist: e.target.value })}
                      placeholder="Ej: Letra: A. Machado"
                      className="w-full mt-0.5 bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-studio-accent font-normal"
                    />
                  </label>
                </div>

                {/* Particella */}
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">
                    <span>Nombre de Particella:</span>
                    <input
                      type="text"
                      value={score.partName || ''}
                      onChange={(e) => onUpdateScoreMetadata?.({ partName: e.target.value })}
                      placeholder="Ej: Trompeta I en Si♭"
                      className="w-full mt-0.5 bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-studio-accent font-normal"
                    />
                  </label>
                </div>

                {/* Copyright */}
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">
                    <span>Copyright:</span>
                    <input
                      type="text"
                      value={score.copyright || ''}
                      onChange={(e) => onUpdateScoreMetadata?.({ copyright: e.target.value })}
                      placeholder="Ej: © 2026 Editorial Musical"
                      className="w-full mt-0.5 bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-studio-accent font-normal"
                    />
                  </label>
                </div>

                {/* Configuración del Pentagrama / Instrumento Seleccionado */}
                {score.staves[selectedStaffIdx] && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-studio-border space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block">
                      Instrumento: {score.staves[selectedStaffIdx].name}
                    </span>

                    <div>
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">
                        <span>Abreviatura (sistemas siguientes):</span>
                        <input
                          type="text"
                          value={score.staves[selectedStaffIdx].shortName || ''}
                          onChange={(e) =>
                            onUpdateStaffShortName?.(selectedStaffIdx, e.target.value)
                          }
                          placeholder="Ej: Tpt., Cl., Vln."
                          className="w-full mt-0.5 bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-studio-accent font-normal"
                        />
                      </label>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">
                        Transporte Instrumental (Particella):
                      </span>
                      <div className="grid grid-cols-2 gap-1">
                        {TRANSPOSITION_PRESETS.map((preset) => {
                          const isSelected =
                            (score.staves[selectedStaffIdx].transposition ?? 0) ===
                            preset.semitones;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                onUpdateStaffTransposition?.(selectedStaffIdx, preset.semitones)
                              }
                              className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                isSelected
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                  : 'bg-white hover:bg-slate-100 dark:bg-studio-surface text-slate-700 dark:text-slate-300 border-slate-200 dark:border-studio-line'
                              }`}
                            >
                              {preset.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación para eliminar compás o rango */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={
          deleteConfirm?.type === 'range'
            ? 'Eliminar compases seleccionados'
            : 'Eliminar último compás'
        }
        description={
          deleteConfirm?.type === 'range'
            ? `¿Estás seguro de que deseas eliminar los ${deleteConfirm.count} compases seleccionados? Esta acción eliminará permanentemente todas sus notas y configuraciones.`
            : '¿Estás seguro de que deseas eliminar el último compás de la partitura?'
        }
        details={
          deleteConfirm?.type === 'range'
            ? [
                `Se eliminarán ${deleteConfirm.count} compases del compás seleccionado.`,
                'Esta acción afectará a todos los pentagramas del sistema.',
              ]
            : ['Se eliminará el último compás y sus notas asociadas.']
        }
        confirmLabel={deleteConfirm?.type === 'range' ? 'Eliminar compases' : 'Eliminar compás'}
        tone="danger"
        onConfirm={() => {
          if (deleteConfirm?.type === 'range') {
            onDeleteSelectedMeasures?.();
          } else {
            onDeleteMeasure();
          }
          setDeleteConfirm(null);
        }}
        onClose={() => setDeleteConfirm(null)}
      />
    </aside>
  );
};
