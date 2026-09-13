import React from 'react';
import {
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Printer,
  Music,
  FileCode,
  Undo,
  Redo,
  ChevronRight,
  Type,
  RotateCcw,
} from 'lucide-react';
import { Score, ScoreItem, Clef, TimeSignature, KeySignature, NamingConvention, Step, NoteDuration, Accidental } from '../../types/music';
import { formatPitchName, pitchToFrequency, LATIN_STEP_NAMES } from '../../constants/pitches';

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
  onAddMeasure: () => void;
  onDeleteMeasure: () => void;
  onDeleteSelected: () => void;
  onTransposeSelected: (semitones: number) => void;
  onChangeDuration: (duration: NoteDuration) => void;
  onToggleDot: () => void;
  onSetAccidental: (acc: Accidental) => void;
  onUpdateLyric: (lyric: string) => void;
  onUpdateStep: (step: Step) => void;
  onClearScore: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  onAddMeasure,
  onDeleteMeasure,
  onDeleteSelected,
  onTransposeSelected,
  onChangeDuration,
  onToggleDot,
  onSetAccidental,
  onUpdateLyric,
  onUpdateStep,
  onClearScore,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExport,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  // Find selected item if any
  const primaryStaff = score.staves[0];
  let selectedItem: ScoreItem | null = null;
  if (primaryStaff && primaryStaff.measures[selectedMeasureIdx]) {
    selectedItem =
      primaryStaff.measures[selectedMeasureIdx].items.find(
        (it) => it.id === selectedItemId
      ) || null;
  }

  const durationOptions: { key: NoteDuration; symbol: string; label: string }[] = [
    { key: 'w', symbol: '𝅝', label: 'Redonda' },
    { key: 'h', symbol: '𝅗𝅥', label: 'Blanca' },
    { key: 'q', symbol: '𝅘𝅥', label: 'Negra' },
    { key: '8', symbol: '𝅘𝅥𝅮', label: 'Corchea' },
    { key: '16', symbol: '𝅘𝅥𝅯', label: 'Semicorchea' },
  ];

  const diatonicSteps: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  if (isCollapsed) {
    return (
      <aside
        id="inspector-container"
        className="w-12 bg-white dark:bg-[#111319] border-l border-slate-200 dark:border-[#202433] py-4 flex flex-col items-center justify-between select-none shrink-0 transition-colors"
      >
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
          title="Expandir panel inspector"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      id="inspector-container"
      className="w-80 bg-white dark:bg-[#111319] border-l border-slate-200 dark:border-[#202433] p-4 flex flex-col gap-3.5 select-none shrink-0 overflow-y-auto transition-colors"
    >
      {/* Header with Undo / Redo */}
      <div className="flex items-center justify-between px-1 pb-1">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide uppercase">
          Propiedades & Inspector
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
            title="Deshacer (Ctrl+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
            title="Rehacer (Ctrl+Y)"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
              title="Colapsar inspector"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Card 1: Elemento Seleccionado con Edición Completa */}
      <div className="bg-slate-50 dark:bg-[#161922] rounded-2xl p-4 border border-slate-200 dark:border-[#232836] transition-all shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
            {selectedItem
              ? selectedItem.type === 'note'
                ? 'Nota Musical'
                : 'Silencio'
              : 'Selección Activa'}
          </h4>
          <span className="text-[10px] bg-slate-200 dark:bg-[#232836] text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
            Compás {selectedMeasureIdx + 1}
          </span>
        </div>

        {selectedItem && selectedItem.type === 'note' && selectedItem.pitch ? (
          <div className="space-y-3">
            {/* Pitch & Frequency */}
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-amber-600 dark:text-[#fed7aa]">
                {formatPitchName(selectedItem.pitch, namingConvention)}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-medium">
                {pitchToFrequency(selectedItem.pitch).toFixed(1)} Hz
              </span>
            </div>

            {/* Quick Diatonic Pitch Step Pills (Do, Re, Mi, Fa, Sol, La, Si) */}
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                Altura Diatónica:
              </span>
              <div className="flex items-center gap-1">
                {diatonicSteps.map((step) => {
                  const isCurrentStep = selectedItem?.pitch?.step === step;
                  const label = namingConvention === 'latin' ? LATIN_STEP_NAMES[step] : step;
                  return (
                    <button
                      key={step}
                      onClick={() => onUpdateStep(step)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        isCurrentStep
                          ? 'bg-[#fed7aa] text-amber-950 shadow-xs ring-1 ring-amber-400'
                          : 'bg-white hover:bg-slate-200 dark:bg-[#111319] dark:hover:bg-[#202534] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2a3044]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration Selector for Selected Note */}
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                Duración de la Figura:
              </span>
              <div className="flex items-center gap-1">
                {durationOptions.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => onChangeDuration(d.key)}
                    className={`flex-1 py-1 rounded-lg text-xs transition-all flex flex-col items-center ${
                      selectedItem?.duration === d.key
                        ? 'bg-[#bef264] text-lime-950 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-200 dark:bg-[#111319] dark:hover:bg-[#202534] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2a3044]'
                    }`}
                    title={d.label}
                  >
                    <span className="text-sm leading-none">{d.symbol}</span>
                  </button>
                ))}

                {/* Dot Toggle */}
                <button
                  onClick={onToggleDot}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    selectedItem?.isDotted
                      ? 'bg-[#c4b5fd] text-purple-950 shadow-xs'
                      : 'bg-white hover:bg-slate-200 dark:bg-[#111319] dark:hover:bg-[#202534] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2a3044]'
                  }`}
                  title="Puntillo (+50%)"
                >
                  • Punt.
                </button>
              </div>
            </div>

            {/* Accidental Selector for Selected Note */}
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                Alteración:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSetAccidental(null)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    !selectedItem?.pitch?.accidental
                      ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white font-bold'
                      : 'bg-white dark:bg-[#111319] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2a3044]'
                  }`}
                >
                  Natural
                </button>
                <button
                  onClick={() => onSetAccidental('#')}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedItem?.pitch?.accidental === '#'
                      ? 'bg-[#fed7aa] text-amber-950 font-bold'
                      : 'bg-white dark:bg-[#111319] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2a3044]'
                  }`}
                >
                  ♯ Sostenido
                </button>
                <button
                  onClick={() => onSetAccidental('b')}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedItem?.pitch?.accidental === 'b'
                      ? 'bg-[#c4b5fd] text-purple-950 font-bold'
                      : 'bg-white dark:bg-[#111319] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2a3044]'
                  }`}
                >
                  ♭ Bemol
                </button>
              </div>
            </div>

            {/* Transposition Actions (Semitones & Octaves) */}
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                Transporte:
              </span>
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => onTransposeSelected(1)}
                  className="py-1 px-1.5 bg-[#fed7aa] hover:bg-[#fcd34d] text-amber-950 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-transform active:scale-95 shadow-xs"
                  title="Subir un semitono (+1)"
                >
                  <ArrowUp className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>+1 Semi</span>
                </button>

                <button
                  onClick={() => onTransposeSelected(-1)}
                  className="py-1 px-1.5 bg-[#c4b5fd] hover:bg-[#a78bfa] text-purple-950 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-transform active:scale-95 shadow-xs"
                  title="Bajar un semitono (-1)"
                >
                  <ArrowDown className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>-1 Semi</span>
                </button>

                <button
                  onClick={() => onTransposeSelected(12)}
                  className="py-1 px-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#202534] dark:hover:bg-[#282f42] text-slate-800 dark:text-slate-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-transform active:scale-95"
                  title="Subir 1 octava (+12 semitonos)"
                >
                  <ArrowUp className="w-2.5 h-2.5" />
                  <span>+8va</span>
                </button>

                <button
                  onClick={() => onTransposeSelected(-12)}
                  className="py-1 px-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#202534] dark:hover:bg-[#282f42] text-slate-800 dark:text-slate-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 transition-transform active:scale-95"
                  title="Bajar 1 octava (-12 semitonos)"
                >
                  <ArrowDown className="w-2.5 h-2.5" />
                  <span>-8va</span>
                </button>
              </div>
            </div>

            {/* Song Lyric / Syllable Input for Note */}
            <div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                <Type className="w-3 h-3" />
                <span>Letra de la canción (Lírica):</span>
              </div>
              <input
                type="text"
                value={selectedItem.lyric || ''}
                onChange={(e) => onUpdateLyric(e.target.value)}
                placeholder="Ej: Glo- o ria"
                className="w-full bg-white dark:bg-[#111319] border border-slate-200 dark:border-[#2a3044] rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-[#f59e0b] transition-colors"
                title="Escribe la sílaba o palabra asociada a esta nota"
              />
            </div>

            {/* Delete button */}
            <button
              onClick={onDeleteSelected}
              className="w-full py-1.5 px-2 bg-[#fca5a5] hover:bg-[#f87171] text-red-950 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-transform active:scale-95 shadow-xs"
              title="Eliminar nota seleccionada (Supr)"
            >
              <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Eliminar Nota</span>
            </button>
          </div>
        ) : selectedItem && selectedItem.type === 'rest' ? (
          <div className="space-y-3">
            <div className="text-sm font-bold text-amber-600 dark:text-[#fed7aa]">
              Silencio de {selectedItem.duration === 'w' ? 'Redonda' : selectedItem.duration === 'h' ? 'Blanca' : selectedItem.duration === 'q' ? 'Negra' : selectedItem.duration === '8' ? 'Corchea' : 'Semicorchea'}
            </div>

            {/* Duration Selector for Selected Rest */}
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                Cambiar Valor del Silencio:
              </span>
              <div className="flex items-center gap-1">
                {durationOptions.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => onChangeDuration(d.key)}
                    className={`flex-1 py-1 rounded-lg text-xs transition-all flex flex-col items-center ${
                      selectedItem?.duration === d.key
                        ? 'bg-[#fed7aa] text-amber-950 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-200 dark:bg-[#111319] dark:hover:bg-[#202534] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2a3044]'
                    }`}
                    title={d.label}
                  >
                    <span className="text-sm leading-none">{d.symbol}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onDeleteSelected}
              className="w-full py-1.5 px-2 bg-[#fca5a5] hover:bg-[#f87171] text-red-950 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-transform active:scale-95"
            >
              <Trash2 className="w-3 h-3 stroke-[2.5]" />
              <span>Eliminar Silencio</span>
            </button>
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Haz clic en una nota o compás para ver opciones de altura, duración, letra y transporte.
          </div>
        )}
      </div>

      {/* Card 2: Parámetros del Compás y Armadura */}
      <div className="bg-slate-50 dark:bg-[#161922] rounded-2xl p-4 border border-slate-200 dark:border-[#232836] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
            Estructura Musical
          </h4>
          <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
        </div>

        <div className="space-y-2 text-xs">
          {/* Clef selector */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Clave:</span>
            <select
              value={clef}
              onChange={(e) => onUpdateClef(e.target.value as Clef)}
              className="bg-white dark:bg-[#111319] border border-slate-200 dark:border-[#2c3244] text-slate-800 dark:text-slate-200 text-[11px] font-semibold rounded-lg px-2.5 py-1 outline-none cursor-pointer focus:border-[#f59e0b]"
            >
              <option value="treble">Sol (Treble)</option>
              <option value="bass">Fa (Bass)</option>
              <option value="alto">Do en 3ª (Alto)</option>
            </select>
          </div>

          {/* Time signature selector */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Compás:</span>
            <select
              value={`${timeSignature.beats}/${timeSignature.beatType}`}
              onChange={(e) => {
                const parts = e.target.value.split('/');
                const b = parseInt(parts[0], 10) || 4;
                const bt = parseInt(parts[1], 10) || 4;
                onUpdateTimeSignature({ beats: b, beatType: bt });
              }}
              className="bg-white dark:bg-[#111319] border border-slate-200 dark:border-[#2c3244] text-slate-800 dark:text-slate-200 text-[11px] font-semibold rounded-lg px-2.5 py-1 outline-none cursor-pointer focus:border-[#f59e0b]"
            >
              <option value="4/4">4/4 Común</option>
              <option value="3/4">3/4 Vals</option>
              <option value="2/4">2/4 Marcha</option>
              <option value="6/8">6/8 Compuesto</option>
              <option value="2/2">2/2 Compasillo</option>
            </select>
          </div>

          {/* Key signature selector */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Tonalidad:</span>
            <select
              value={keySignature}
              onChange={(e) => onUpdateKeySignature(e.target.value as KeySignature)}
              className="bg-white dark:bg-[#111319] border border-slate-200 dark:border-[#2c3244] text-slate-800 dark:text-slate-200 text-[11px] font-semibold rounded-lg px-2.5 py-1 outline-none cursor-pointer focus:border-[#f59e0b]"
            >
              <option value="C">Do Mayor / La menor</option>
              <option value="G">Sol Mayor (1 ♯)</option>
              <option value="D">Re Mayor (2 ♯)</option>
              <option value="A">La Mayor (3 ♯)</option>
              <option value="E">Mi Mayor (4 ♯)</option>
              <option value="F">Fa Mayor (1 ♭)</option>
              <option value="Bb">Si♭ Mayor (2 ♭)</option>
              <option value="Eb">Mi♭ Mayor (3 ♭)</option>
              <option value="Am">La menor (0)</option>
              <option value="Em">Mi menor (1 ♯)</option>
              <option value="Dm">Re menor (1 ♭)</option>
            </select>
          </div>
        </div>

        {/* Add / Delete Measure Buttons */}
        <div className="flex items-center gap-1.5 mt-3.5 pt-2.5 border-t border-slate-200 dark:border-[#232836]">
          <button
            onClick={onAddMeasure}
            className="flex-1 py-1.5 px-2 bg-[#bef264] hover:bg-[#a3e635] text-lime-950 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-transform active:scale-95 shadow-xs"
            title="Añadir un compás al final"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <span>+ Compás</span>
          </button>

          <button
            onClick={onDeleteMeasure}
            className="py-1.5 px-2 bg-slate-200 hover:bg-slate-300 dark:bg-[#1f2330] dark:hover:bg-[#262c3d] text-slate-700 dark:text-slate-300 font-semibold text-[11px] rounded-xl transition-transform active:scale-95 border border-slate-300 dark:border-[#2a3042]"
            title="Eliminar el último compás"
          >
            - Eliminar
          </button>
        </div>

        {/* Reset / Clear Score button */}
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-[#232836]">
          <button
            onClick={() => {
              if (window.confirm('¿Deseas reiniciar la partitura con un lienzo en blanco?')) {
                onClearScore();
              }
            }}
            className="w-full py-1 px-2 text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center gap-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
            title="Reiniciar con una partitura en blanco"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Nueva Partitura en Blanco</span>
          </button>
        </div>
      </div>

      {/* Card 3: Acciones de Exportación Directa (Pill buttons from reference) */}
      <div className="bg-slate-50 dark:bg-[#161922] rounded-2xl p-4 border border-slate-200 dark:border-[#232836] shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
            Exportación Rápida
          </h4>
          <span className="text-[10px] text-amber-700 dark:text-[#fed7aa] font-bold">100% Libre</span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">
          Descarga en formatos estándar para impresión, DAWs y editores:
        </p>

        <div className="space-y-2">
          <button
            onClick={onOpenExport}
            className="w-full py-2 px-3 bg-[#fed7aa] hover:bg-[#fcd34d] text-amber-950 font-bold text-xs rounded-xl flex items-center justify-between transition-all shadow-xs active:scale-95"
          >
            <div className="flex items-center gap-2">
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </div>
            <span className="text-[10px] opacity-75">A4 / Carta</span>
          </button>

          <button
            onClick={onOpenExport}
            className="w-full py-2 px-3 bg-[#c4b5fd] hover:bg-[#a78bfa] text-purple-950 font-bold text-xs rounded-xl flex items-center justify-between transition-all shadow-xs active:scale-95"
          >
            <div className="flex items-center gap-2">
              <Music className="w-3.5 h-3.5" />
              <span>Archivo MIDI</span>
            </div>
            <span className="text-[10px] opacity-75">.mid DAW</span>
          </button>

          <button
            onClick={onOpenExport}
            className="w-full py-2 px-3 bg-[#bef264] hover:bg-[#a3e635] text-lime-950 font-bold text-xs rounded-xl flex items-center justify-between transition-all shadow-xs active:scale-95"
          >
            <div className="flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5" />
              <span>MusicXML</span>
            </div>
            <span className="text-[10px] opacity-75">MuseScore / Sibelius</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
