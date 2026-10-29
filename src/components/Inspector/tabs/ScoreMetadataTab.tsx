import React, { useState } from 'react';
import { Layers, LayoutGrid, Plus, Trash2, Wrench, Music } from '../../ui/icons';
import { Score, Clef, TimeSignature, KeySignature } from '../../../types/music';
import { KEY_SIGNATURE_DATA } from '../../../constants/pitches';
import { CustomSelect, CustomSelectOption } from '../../ui/CustomSelect';

export interface ScoreMetadataTabProps {
  score: Score;
  isGrandStaff?: boolean;
  canToggleGrandStaff?: boolean;
  onToggleGrandStaff?: () => void;
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
  clef: Clef;
  onUpdateClef: (clef: Clef) => void;
  timeSignature: TimeSignature;
  onUpdateTimeSignature: (timeSig: TimeSignature) => void;
  keySignature: KeySignature;
  onUpdateKeySignature: (keySig: KeySignature) => void;
  onChangeKeySignatureAndTranspose?: (newKey: KeySignature, transposeNotes: boolean) => void;
  onTransposeScore?: (semitones: number) => void;
}

const CLEF_OPTIONS: CustomSelectOption<Clef>[] = [
  { value: 'treble', label: 'Clave de Sol' },
  { value: 'bass', label: 'Clave de Fa' },
  { value: 'alto', label: 'Clave de Do' },
];

const TIME_SIGNATURES: TimeSignature[] = [
  { beats: 2, beatType: 4 },
  { beats: 3, beatType: 4 },
  { beats: 4, beatType: 4 },
  { beats: 5, beatType: 4 },
  { beats: 2, beatType: 2 },
  { beats: 3, beatType: 8 },
  { beats: 6, beatType: 8 },
  { beats: 9, beatType: 8 },
  { beats: 12, beatType: 8 },
];

const timeSigKey = (t: TimeSignature) => `${t.beats}/${t.beatType}`;

const TIME_OPTIONS: CustomSelectOption<string>[] = TIME_SIGNATURES.map((t) => ({
  value: timeSigKey(t),
  label: timeSigKey(t),
}));

const KEY_OPTIONS: CustomSelectOption<KeySignature>[] = (
  Object.keys(KEY_SIGNATURE_DATA) as KeySignature[]
).map((k) => ({
  value: k,
  label: KEY_SIGNATURE_DATA[k].name,
}));

const PANEL =
  'rounded-lg border border-slate-200/80 dark:border-studio-border bg-slate-50 dark:bg-studio-card p-3';
const LABEL =
  'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1';
const INPUT =
  'w-full rounded-md border border-slate-200/80 dark:border-studio-border bg-white dark:bg-studio-surface px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500';
const ICON_BTN =
  'inline-flex items-center justify-center rounded-md border border-slate-200/80 dark:border-studio-border bg-white dark:bg-studio-surface p-1.5 text-slate-500 dark:text-slate-300 transition-colors hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-amber-500';

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
    <span className="text-indigo-500 dark:text-indigo-400">{icon}</span>
    {children}
  </h3>
);

export const ScoreMetadataTab: React.FC<ScoreMetadataTabProps> = ({
  score,
  isGrandStaff = false,
  canToggleGrandStaff = false,
  onToggleGrandStaff,
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
  clef,
  onUpdateClef,
  timeSignature,
  onUpdateTimeSignature,
  keySignature,
  onUpdateKeySignature,
  onChangeKeySignatureAndTranspose,
  onTransposeScore,
}) => {
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffClef, setNewStaffClef] = useState<Clef>('treble');
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);
  const [transposeNotes, setTransposeNotes] = useState(false);
  const [semitones, setSemitones] = useState(0);

  const staves = score.staves;
  const canRemove = staves.length > 1;

  const handleKeyChange = (newKey: KeySignature) => {
    if (newKey === keySignature) return;
    if (onChangeKeySignatureAndTranspose) {
      onChangeKeySignatureAndTranspose(newKey, transposeNotes);
    } else {
      onUpdateKeySignature(newKey);
    }
  };

  const handleTimeChange = (key: string) => {
    const found = TIME_SIGNATURES.find((t) => timeSigKey(t) === key);
    if (found) onUpdateTimeSignature(found);
  };

  const handleAddStaff = () => {
    onAddStaff?.(newStaffName.trim() || undefined, newStaffClef);
    setNewStaffName('');
  };

  const handleConfirmRemove = (idx: number) => {
    onRemoveStaff?.(idx);
    setConfirmRemoveIdx(null);
  };

  const handleTranspose = () => {
    if (semitones !== 0) {
      onTransposeScore?.(semitones);
      setSemitones(0);
    }
  };

  return (
    <div className="flex flex-col gap-3 text-slate-800 dark:text-slate-100">
      {/* Armadura, compas y clave */}
      <section className={PANEL} aria-labelledby="score-meta-signatures">
        <div id="score-meta-signatures">
          <SectionTitle icon={<Music size={14} />}>Compás y tonalidad</SectionTitle>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className={LABEL}>Compás</span>
            <CustomSelect<string>
              value={timeSigKey(timeSignature)}
              onChange={handleTimeChange}
              options={TIME_OPTIONS}
              align="left"
            />
          </div>
          <div>
            <span className={LABEL}>Clave</span>
            <CustomSelect<Clef>
              value={clef}
              onChange={onUpdateClef}
              options={CLEF_OPTIONS}
              align="right"
            />
          </div>
        </div>
        <div className="mt-2">
          <span className={LABEL}>Armadura</span>
          <CustomSelect<KeySignature>
            value={keySignature}
            onChange={handleKeyChange}
            options={KEY_OPTIONS}
            align="left"
          />
          {onChangeKeySignatureAndTranspose && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={transposeNotes}
                onChange={(e) => setTransposeNotes(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-studio-border accent-indigo-500"
              />
              Transponer notas al cambiar la armadura
            </label>
          )}
        </div>
      </section>

      {/* Instrumentos y pentagramas */}
      <section className={PANEL} aria-labelledby="score-meta-staves">
        <div id="score-meta-staves" className="flex items-center justify-between">
          <SectionTitle icon={<Layers size={14} />}>Instrumentos y pentagramas</SectionTitle>
          <span className="mb-2 rounded-full border border-slate-200/80 dark:border-studio-border bg-white dark:bg-studio-surface px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            {staves.length}
          </span>
        </div>

        <ul className="flex flex-col gap-1.5">
          {staves.map((staff, idx) => {
            const isSelected = idx === selectedStaffIdx;
            const isConfirming = confirmRemoveIdx === idx;
            return (
              <li
                key={staff.id}
                className={`rounded-md border p-2 transition-colors ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'border-slate-200/80 dark:border-studio-border bg-white dark:bg-studio-surface'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectStaff?.(idx)}
                    aria-pressed={isSelected}
                    aria-label={`Seleccionar pentagrama ${idx + 1}`}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isSelected
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-200 dark:bg-studio-elevated text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                  <input
                    type="text"
                    value={staff.name}
                    onChange={(e) => onUpdateStaffName?.(idx, e.target.value)}
                    onFocus={() => onSelectStaff?.(idx)}
                    aria-label={`Nombre del pentagrama ${idx + 1}`}
                    placeholder="Nombre del instrumento"
                    className={INPUT}
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveIdx(isConfirming ? null : idx)}
                    disabled={!canRemove || !onRemoveStaff}
                    aria-label={`Eliminar pentagrama ${idx + 1}`}
                    title={canRemove ? 'Eliminar pentagrama' : 'Se requiere al menos un pentagrama'}
                    className={ICON_BTN}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-1.5 pl-[30px]">
                  <CustomSelect<Clef>
                    value={staff.clef}
                    onChange={(c) => onUpdateStaffClef?.(idx, c)}
                    options={CLEF_OPTIONS}
                    align="left"
                  />
                </div>

                {isConfirming && (
                  <div
                    role="alert"
                    className="mt-2 flex items-center justify-between gap-2 rounded-md border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 px-2 py-1.5"
                  >
                    <span className="text-xs text-red-700 dark:text-red-300">
                      Se eliminarán todos sus compases.
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveIdx(null)}
                        className="rounded border border-slate-300 dark:border-studio-border bg-white dark:bg-studio-surface px-2 py-0.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-studio-hover"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmRemove(idx)}
                        className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-500"
                      >
                        Eliminar
                      </button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {onAddStaff && (
          <div className="mt-2 flex items-center gap-1.5 border-t border-slate-200/80 dark:border-studio-border pt-2">
            <input
              type="text"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddStaff();
              }}
              aria-label="Nombre del nuevo instrumento"
              placeholder="Nuevo instrumento"
              className={INPUT}
            />
            <div className="w-32 shrink-0">
              <CustomSelect<Clef>
                value={newStaffClef}
                onChange={setNewStaffClef}
                options={CLEF_OPTIONS}
                align="right"
              />
            </div>
            <button
              type="button"
              onClick={handleAddStaff}
              aria-label="Agregar pentagrama"
              title="Agregar pentagrama"
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-indigo-600 p-1.5 text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        {canToggleGrandStaff && onToggleGrandStaff && (
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isGrandStaff}
              onChange={onToggleGrandStaff}
              className="h-3.5 w-3.5 rounded border-slate-300 dark:border-studio-border accent-indigo-500"
            />
            Sistema de piano (llave)
          </label>
        )}
      </section>

      {/* Vista */}
      {onSelectViewMode && (
        <section className={PANEL} aria-labelledby="score-meta-view">
          <div id="score-meta-view">
            <SectionTitle icon={<LayoutGrid size={14} />}>Vista</SectionTitle>
          </div>
          <div
            role="group"
            aria-label="Modo de vista"
            className="flex rounded-md border border-slate-200/80 dark:border-studio-border bg-white dark:bg-studio-surface p-0.5"
          >
            {(['full', 'part'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSelectViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                  viewMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-studio-hover'
                }`}
              >
                {mode === 'full' ? 'Partitura completa' : 'Parte individual'}
              </button>
            ))}
          </div>
          {viewMode === 'part' && onSelectPartStaffIdx && (
            <div className="mt-2">
              <span className={LABEL}>Parte activa</span>
              <CustomSelect<number>
                value={Math.min(activePartStaffIdx, Math.max(staves.length - 1, 0))}
                onChange={onSelectPartStaffIdx}
                options={staves.map((s, i) => ({
                  value: i,
                  label: s.name || `Pentagrama ${i + 1}`,
                }))}
                align="left"
              />
            </div>
          )}
        </section>
      )}

      {/* Transposicion */}
      {onTransposeScore && (
        <section className={PANEL} aria-labelledby="score-meta-transpose">
          <div id="score-meta-transpose">
            <SectionTitle icon={<Wrench size={14} />}>Transposición</SectionTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={-12}
              max={12}
              value={semitones}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setSemitones(Number.isNaN(n) ? 0 : Math.max(-12, Math.min(12, n)));
              }}
              aria-label="Semitonos a transponer"
              className={INPUT}
            />
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">semitonos</span>
            <button
              type="button"
              onClick={handleTranspose}
              disabled={semitones === 0}
              className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              Aplicar
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default ScoreMetadataTab;
