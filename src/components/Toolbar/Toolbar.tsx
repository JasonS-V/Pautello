import React from 'react';
import {
  Undo,
  Redo,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { NoteDuration, Accidental, Clef, KeySignature, TimeSignature, Articulation } from '../../types/music';
import { KEY_SIGNATURE_DATA } from '../../constants/pitches';

interface ToolbarProps {
  activeDuration: NoteDuration;
  onSelectDuration: (duration: NoteDuration) => void;
  isRestMode: boolean;
  onToggleRestMode: () => void;
  activeAccidental: Accidental;
  onSelectAccidental: (acc: Accidental) => void;
  isDotted: boolean;
  onToggleDot: () => void;
  selectedArticulation: Articulation;
  onSelectArticulation: (art: Articulation) => void;
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
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasSelectedNote: boolean;
  hasSelectedItem: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeDuration,
  onSelectDuration,
  isRestMode,
  onToggleRestMode,
  activeAccidental,
  onSelectAccidental,
  isDotted,
  onToggleDot,
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelectedNote,
  hasSelectedItem,
}) => {
  const durations: { key: NoteDuration; label: string; symbol: string; shortcut: string }[] = [
    { key: 'w', label: 'Redonda', symbol: '𝅝', shortcut: '1' },
    { key: 'h', label: 'Blanca', symbol: '𝅗𝅥', shortcut: '2' },
    { key: 'q', label: 'Negra', symbol: '𝅘𝅥', shortcut: '3' },
    { key: '8', label: 'Corchea', symbol: '𝅘𝅥𝅮', shortcut: '4' },
    { key: '16', label: 'Semicorchea', symbol: '𝅘𝅥𝅯', shortcut: '5' },
  ];

  return (
    <div className="bg-slate-50 dark:bg-[#161922] border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 select-none text-xs">
      {/* Note Durations & Rest */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#12151c] p-1 rounded-lg border border-slate-200 dark:border-slate-800">
        {durations.map((d) => (
          <button
            key={d.key}
            onClick={() => onSelectDuration(d.key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
              activeDuration === d.key
                ? (isRestMode
                    ? 'bg-amber-600 text-white font-semibold shadow-xs'
                    : 'bg-blue-600 text-white font-semibold shadow-xs')
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={`${d.label} (Tecla ${d.shortcut})`}
          >
            <span className="text-base leading-none">{d.symbol}</span>
            <span className="text-[11px] font-medium hidden sm:inline">{d.label}</span>
            <span className="text-[9px] opacity-60 ml-0.5">{d.shortcut}</span>
          </button>
        ))}

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Rest Toggle */}
        <button
          onClick={onToggleRestMode}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
            isRestMode
              ? 'bg-amber-600 text-white font-semibold shadow-xs ring-2 ring-amber-400/40'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Modo Silencio (Tecla R)"
        >
          <span className="text-sm">𝄽</span>
          <span className="text-[11px] font-medium">Silencio</span>
          <span className="text-[9px] opacity-60 ml-0.5">R</span>
        </button>

        {/* Dot Toggle */}
        <button
          onClick={onToggleDot}
          className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
            isDotted
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Puntillo: Añade el 50% del valor (Tecla .)"
        >
          <span className="text-sm font-bold leading-none">.</span>
          <span className="text-[11px]">Puntillo</span>
        </button>
      </div>

      {/* Accidentals */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#12151c] p-1 rounded-lg border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => onSelectAccidental(null)}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            activeAccidental === null
              ? 'bg-slate-200 dark:bg-slate-700 font-bold text-slate-800 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Sin alteración manual"
        >
          Natural
        </button>
        <button
          onClick={() => onSelectAccidental('#')}
          className={`px-2 py-1 rounded text-xs font-serif font-bold transition-colors ${
            activeAccidental === '#'
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Sostenido (♯)"
        >
          ♯
        </button>
        <button
          onClick={() => onSelectAccidental('b')}
          className={`px-2 py-1 rounded text-xs font-serif font-bold transition-colors ${
            activeAccidental === 'b'
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Bemol (♭)"
        >
          ♭
        </button>
        <button
          onClick={() => onSelectAccidental('n')}
          className={`px-2 py-1 rounded text-xs font-serif font-bold transition-colors ${
            activeAccidental === 'n'
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Becuadro (♮)"
        >
          ♮
        </button>
      </div>

      {/* Clef, Key, Time Signature Selectors */}
      <div className="flex items-center gap-2">
        {/* Clef */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-500 font-medium">Clave:</span>
          <select
            value={clef}
            onChange={(e) => onUpdateClef(e.target.value as Clef)}
            className="bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 outline-none text-xs font-medium cursor-pointer"
          >
            <option value="treble">Sol (Agudos)</option>
            <option value="bass">Fa (Graves)</option>
            <option value="alto">Do en 3ª (Viola)</option>
          </select>
        </div>

        {/* Time Signature */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-500 font-medium">Compás:</span>
          <select
            value={`${timeSignature.beats}/${timeSignature.beatType}`}
            onChange={(e) => {
              const [beats, beatType] = e.target.value.split('/').map(Number);
              onUpdateTimeSignature({ beats, beatType });
            }}
            className="bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 outline-none text-xs font-medium cursor-pointer"
          >
            <option value="4/4">4/4 (Común)</option>
            <option value="3/4">3/4 (Vals)</option>
            <option value="2/4">2/4 (Binario)</option>
            <option value="6/8">6/8 (Compuesto)</option>
            <option value="2/2">2/2 (Alla Breve)</option>
          </select>
        </div>

        {/* Key Signature */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-500 font-medium">Armadura:</span>
          <select
            value={keySignature}
            onChange={(e) => onUpdateKeySignature(e.target.value as KeySignature)}
            className="bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 outline-none text-xs font-medium cursor-pointer"
          >
            {Object.entries(KEY_SIGNATURE_DATA).map(([key, data]) => (
              <option key={key} value={key}>
                {key} ({data.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Measure Actions & Edit Controls */}
      <div className="flex items-center gap-1.5">
        {/* Add / Delete Measure */}
        <div className="flex items-center gap-1">
          <button
            onClick={onAddMeasure}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium transition-colors"
            title="Añadir nuevo compás al final"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Compás</span>
          </button>
          <button
            onClick={onDeleteMeasure}
            className="px-2 py-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium transition-colors"
            title="Eliminar compás seleccionado"
          >
            - Compás
          </button>
        </div>

        {/* Transpose Controls */}
        <div className="flex items-center bg-white dark:bg-[#12151c] border border-slate-200 dark:border-slate-800 rounded-md p-0.5">
          <button
            onClick={() => onTransposeSelected(1)}
            disabled={!hasSelectedNote}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Subir semitono (Flecha Arriba)"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onTransposeSelected(-1)}
            disabled={!hasSelectedNote}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Bajar semitono (Flecha Abajo)"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Delete note or rest */}
        <button
          onClick={onDeleteSelected}
          disabled={!hasSelectedItem}
          className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Eliminar elemento seleccionado (Supr / Backspace)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Deshacer (Ctrl+Z)"
        >
          <Undo className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Rehacer (Ctrl+Y)"
        >
          <Redo className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
