import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Music } from '../../ui/icons';
import {
  ScoreItem,
  Pitch,
  Step,
  NoteDuration,
  Accidental,
  Articulation,
  Dynamic,
  Ornament,
  NamingConvention,
  getItemPitches,
} from '../../../types/music';
import {
  formatPitchName,
  pitchToFrequency,
  pitchToMidi,
  midiToPitch,
  KEY_SIGNATURE_DATA,
} from '../../../constants/pitches';
import { DURATION_INFO } from '../constants';
import { getDiatonicChordsForKey } from '../../../utils/chordUtils';

export interface NoteInspectorTabProps {
  selectedItem: ScoreItem | null;
  selectedMeasureIdx: number;
  namingConvention: NamingConvention;
  onTransposeSelected: (semitones: number) => void;
  onDeleteSelected: () => void;
  onChangeDuration?: (duration: NoteDuration) => void;
  onToggleDot?: () => void;
  onSetAccidental?: (acc: Accidental) => void;
  onUpdateLyric: (lyric: string) => void;
  onUpdateChord?: (chord: string | undefined) => void;
  onUpdateStep: (step: Step) => void;
  onAddPitchToChord?: (pitch: Pitch) => void;
  onRemovePitchFromChord?: (pitchIndex: number) => void;
  onToggleTuplet?: () => void;
  onToggleTie?: () => void;
  onToggleSlur?: () => void;
  onSetArticulation?: (art: Articulation | null) => void;
  onSetDynamic?: (dyn: Dynamic | null) => void;
  onSetItemVoice?: (voice: 1 | 2) => void;
  onSetOrnament?: (ornament: Ornament | null) => void;
  onSetHairpin?: (hairpin: 'cresc' | 'decresc' | 'stop' | null) => void;
  onSetNoteType?: (
    noteType: 'standard' | 'grace' | 'slash',
    graceType?: 'acciaccatura' | 'appoggiatura'
  ) => void;
  onSetFingering?: (fingering?: number) => void;
  onSetPedal?: (pedal: 'down' | 'up' | null) => void;
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-pastel-amber dark:focus-visible:ring-offset-studio-card';

const BTN_BASE = `px-2 py-1.5 text-[11px] font-medium rounded-md border transition-all duration-150 active:scale-95 hover:border-amber-500/40 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 ${FOCUS}`;
const BTN_IDLE =
  'bg-white dark:bg-studio-elevated border-slate-200/80 dark:border-studio-border text-slate-700 dark:text-slate-300';
const BTN_ACTIVE =
  'bg-amber-50 dark:bg-amber-500/10 border-amber-500/60 text-amber-700 dark:text-pastel-amber';

const INPUT_CLS = `w-full px-2.5 py-1.5 text-xs rounded-md border bg-white dark:bg-studio-elevated border-slate-200/80 dark:border-studio-border text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors duration-150 hover:border-amber-500/40 ${FOCUS}`;

const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LATIN: Record<Step, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

const ACCIDENTALS: { value: Accidental; label: string; title: string }[] = [
  { value: 'bb', label: 'bb', title: 'Doble bemol' },
  { value: 'b', label: 'b', title: 'Bemol' },
  { value: 'n', label: 'n', title: 'Becuadro' },
  { value: '#', label: '#', title: 'Sostenido' },
  { value: '##', label: 'x', title: 'Doble sostenido' },
];

const ARTICULATIONS: { value: Exclude<Articulation, null>; label: string }[] = [
  { value: 'staccato', label: 'Staccato' },
  { value: 'staccatissimo', label: 'Staccatissimo' },
  { value: 'accent', label: 'Acento' },
  { value: 'marcato', label: 'Marcato' },
  { value: 'tenuto', label: 'Tenuto' },
  { value: 'portato', label: 'Portato' },
  { value: 'fermata', label: 'Fermata' },
  { value: 'downBow', label: 'Arco abajo' },
  { value: 'upBow', label: 'Arco arriba' },
  { value: 'harmonic', label: 'Armonico' },
];

const ORNAMENTS: { value: Exclude<Ornament, null>; label: string }[] = [
  { value: 'trill', label: 'Trino' },
  { value: 'mordent', label: 'Mordente' },
  { value: 'turn', label: 'Grupeto' },
  { value: 'arpeggio', label: 'Arpegio' },
  { value: 'glissando', label: 'Glissando' },
];

const DYNAMICS: Exclude<Dynamic, null>[] = [
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'sfz',
  'fp',
  'sfp',
  'rfz',
];

const HAIRPINS: { value: 'cresc' | 'decresc' | 'stop'; label: string }[] = [
  { value: 'cresc', label: 'Crescendo' },
  { value: 'decresc', label: 'Diminuendo' },
  { value: 'stop', label: 'Fin' },
];

const DURATIONS: NoteDuration[] = ['w', 'h', 'q', '8', '16', '32'];

interface SectionProps {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children, aside }) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {aside}
    </div>
    {children}
  </section>
);

interface ToggleBtnProps {
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

const ToggleBtn: React.FC<ToggleBtnProps> = ({
  active = false,
  disabled,
  title,
  onClick,
  children,
  className = '',
}) => (
  <button
    type="button"
    title={title}
    aria-pressed={active}
    disabled={disabled || !onClick}
    onClick={onClick}
    className={`${BTN_BASE} ${active ? BTN_ACTIVE : BTN_IDLE} ${className}`}
  >
    {children}
  </button>
);

const KEYS = Object.keys(KEY_SIGNATURE_DATA) as (keyof typeof KEY_SIGNATURE_DATA)[];

export const NoteInspectorTab: React.FC<NoteInspectorTabProps> = ({
  selectedItem,
  selectedMeasureIdx,
  namingConvention,
  onTransposeSelected,
  onDeleteSelected,
  onChangeDuration,
  onToggleDot,
  onSetAccidental,
  onUpdateLyric,
  onUpdateChord,
  onUpdateStep,
  onAddPitchToChord,
  onRemovePitchFromChord,
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
}) => {
  const [chordKey, setChordKey] = useState<(typeof KEYS)[number]>('C');

  if (!selectedItem) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4 px-6 py-14 rounded-lg border border-dashed border-slate-200/80 dark:border-studio-border bg-slate-50 dark:bg-studio-card">
        <div className="flex items-center justify-center w-12 h-12 rounded-full border border-slate-200/80 dark:border-studio-border text-amber-600 dark:text-pastel-amber">
          <Music size={22} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            Ninguna nota seleccionada
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Selecciona una nota o silencio en la partitura para editar sus propiedades.
          </p>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
          {[
            ['Clic', 'Seleccionar'],
            ['Flechas', 'Mover'],
            ['Shift + Flechas', 'Transponer'],
            ['Supr', 'Eliminar'],
          ].map(([k, d]) => (
            <li key={k} className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-studio-border bg-white dark:bg-studio-elevated font-mono text-[10px] text-slate-700 dark:text-slate-300">
                {k}
              </kbd>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const isNote = selectedItem.type === 'note';
  const pitches = getItemPitches(selectedItem);
  const primary = pitches[0];
  const isChord = pitches.length > 1;
  const noteType = selectedItem.noteType ?? 'standard';
  const voice = selectedItem.voice ?? 1;
  const diatonic = getDiatonicChordsForKey(chordKey as never, namingConvention);

  const addChordTone = (semitones: number) => {
    if (!onAddPitchToChord || !pitches.length) return;
    const top = pitches.reduce((a, b) => (pitchToMidi(b) > pitchToMidi(a) ? b : a));
    const midi = pitchToMidi(top) + semitones;
    if (midi < 0 || midi > 127) return;
    onAddPitchToChord(midiToPitch(midi));
  };

  const pedalValue =
    selectedItem.pedal === 'start' ? 'down' : selectedItem.pedal === 'stop' ? 'up' : null;

  return (
    <div className="space-y-4 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-pastel-amber">
            {isNote ? (isChord ? 'Acorde' : 'Nota') : 'Silencio'} / Compas {selectedMeasureIdx + 1}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums truncate">
            {isNote && primary ? formatPitchName(primary, namingConvention) : 'Silencio'}
          </p>
          {isNote && primary && (
            <p className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
              {pitchToFrequency(primary).toFixed(2)} Hz / MIDI {pitchToMidi(primary)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDeleteSelected}
          aria-label="Eliminar elemento seleccionado"
          title="Eliminar"
          className={`shrink-0 p-2 rounded-md border border-slate-200/80 dark:border-studio-border text-red-600 dark:text-red-400 bg-white dark:bg-studio-elevated transition-all duration-150 active:scale-95 hover:border-red-500/50 ${FOCUS}`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </header>

      {/* Pitch */}
      {isNote && (
        <Section title="Altura">
          <div className="grid grid-cols-7 gap-1" role="group" aria-label="Nombre de nota">
            {STEPS.map((s) => (
              <ToggleBtn
                key={s}
                active={primary?.step === s}
                onClick={() => onUpdateStep(s)}
                title={LATIN[s]}
              >
                {namingConvention === 'latin' ? LATIN[s] : s}
              </ToggleBtn>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1" role="group" aria-label="Alteracion">
            {ACCIDENTALS.map((a) => (
              <ToggleBtn
                key={a.label}
                active={primary?.accidental === a.value}
                onClick={onSetAccidental ? () => onSetAccidental(a.value) : undefined}
                title={a.title}
                className="font-mono"
              >
                {a.label}
              </ToggleBtn>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1" role="group" aria-label="Transponer">
            <button
              type="button"
              onClick={() => onTransposeSelected(1)}
              className={`${BTN_BASE} ${BTN_IDLE} flex items-center justify-center gap-1`}
            >
              <ArrowUp size={12} aria-hidden="true" />
              <span>1/2</span>
            </button>
            <button
              type="button"
              onClick={() => onTransposeSelected(-1)}
              className={`${BTN_BASE} ${BTN_IDLE} flex items-center justify-center gap-1`}
            >
              <ArrowDown size={12} aria-hidden="true" />
              <span>1/2</span>
            </button>
            <button
              type="button"
              onClick={() => onTransposeSelected(12)}
              className={`${BTN_BASE} ${BTN_IDLE} flex items-center justify-center gap-1`}
            >
              <ArrowUp size={12} aria-hidden="true" />
              <span>8va</span>
            </button>
            <button
              type="button"
              onClick={() => onTransposeSelected(-12)}
              className={`${BTN_BASE} ${BTN_IDLE} flex items-center justify-center gap-1`}
            >
              <ArrowDown size={12} aria-hidden="true" />
              <span>8va</span>
            </button>
          </div>
        </Section>
      )}

      {/* Duration */}
      <Section title="Duracion">
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Figura">
          {DURATIONS.map((d) => (
            <ToggleBtn
              key={d}
              active={selectedItem.duration === d}
              onClick={onChangeDuration ? () => onChangeDuration(d) : undefined}
            >
              {DURATION_INFO[d].label}
            </ToggleBtn>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <ToggleBtn active={!!selectedItem.isDotted} onClick={onToggleDot}>
            Puntillo
          </ToggleBtn>
          <ToggleBtn active={!!selectedItem.tuplet} onClick={onToggleTuplet}>
            Tresillo
          </ToggleBtn>
          {isNote && (
            <ToggleBtn active={!!selectedItem.isTied} onClick={onToggleTie}>
              Ligadura
            </ToggleBtn>
          )}
        </div>
        {isNote && (
          <ToggleBtn active={!!selectedItem.slur} onClick={onToggleSlur} className="w-full">
            Legato (slur)
          </ToggleBtn>
        )}
      </Section>

      {/* Chord tones */}
      {isNote && (
        <Section
          title="Notas del acorde"
          aside={
            <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
              {pitches.length}
            </span>
          }
        >
          <ul className="space-y-1">
            {pitches.map((p, i) => (
              <li
                key={`${p.step}${p.accidental ?? ''}${p.octave}-${i}`}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md border border-slate-200/80 dark:border-studio-border bg-white dark:bg-studio-elevated"
              >
                <span className="text-xs font-medium tabular-nums">
                  {formatPitchName(p, namingConvention)}
                </span>
                {isChord && onRemovePitchFromChord && (
                  <button
                    type="button"
                    onClick={() => onRemovePitchFromChord(i)}
                    aria-label={`Quitar ${formatPitchName(p, namingConvention)} del acorde`}
                    className={`p-1 rounded text-slate-500 dark:text-slate-400 transition-all duration-150 active:scale-95 hover:text-red-600 dark:hover:text-red-400 ${FOCUS}`}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {onAddPitchToChord && (
            <div
              className="grid grid-cols-4 gap-1"
              role="group"
              aria-label="Agregar nota al acorde"
            >
              {[
                { s: 3, l: '3m' },
                { s: 4, l: '3M' },
                { s: 7, l: '5J' },
                { s: 12, l: '8va' },
              ].map((iv) => (
                <button
                  key={iv.l}
                  type="button"
                  onClick={() => addChordTone(iv.s)}
                  title={`Agregar intervalo ${iv.l} sobre la nota mas aguda`}
                  className={`${BTN_BASE} ${BTN_IDLE} flex items-center justify-center gap-1`}
                >
                  <Plus size={11} aria-hidden="true" />
                  <span>{iv.l}</span>
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Expression */}
      {isNote && (
        <Section title="Articulacion">
          <div className="grid grid-cols-2 gap-1" role="group" aria-label="Articulacion">
            {ARTICULATIONS.map((a) => {
              const active = selectedItem.articulation === a.value;
              return (
                <ToggleBtn
                  key={a.value}
                  active={active}
                  onClick={
                    onSetArticulation ? () => onSetArticulation(active ? null : a.value) : undefined
                  }
                >
                  {a.label}
                </ToggleBtn>
              );
            })}
          </div>
        </Section>
      )}

      {isNote && (
        <Section title="Ornamento">
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Ornamento">
            {ORNAMENTS.map((o) => {
              const active = selectedItem.ornament === o.value;
              return (
                <ToggleBtn
                  key={o.value}
                  active={active}
                  onClick={onSetOrnament ? () => onSetOrnament(active ? null : o.value) : undefined}
                >
                  {o.label}
                </ToggleBtn>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Dinamica">
        <div className="grid grid-cols-6 gap-1" role="group" aria-label="Dinamica">
          {DYNAMICS.map((d) => {
            const active = selectedItem.dynamic === d;
            return (
              <ToggleBtn
                key={d}
                active={active}
                onClick={onSetDynamic ? () => onSetDynamic(active ? null : d) : undefined}
                className="font-mono italic"
              >
                {d}
              </ToggleBtn>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Reguladores">
          {HAIRPINS.map((h) => {
            const active = selectedItem.hairpin === h.value;
            return (
              <ToggleBtn
                key={h.value}
                active={active}
                onClick={onSetHairpin ? () => onSetHairpin(active ? null : h.value) : undefined}
              >
                {h.label}
              </ToggleBtn>
            );
          })}
        </div>
      </Section>

      {/* Voice / type / fingering / pedal */}
      {isNote && (
        <Section title="Voz y tipo">
          <div className="grid grid-cols-2 gap-1" role="group" aria-label="Voz">
            {([1, 2] as const).map((v) => (
              <ToggleBtn
                key={v}
                active={voice === v}
                onClick={onSetItemVoice ? () => onSetItemVoice(v) : undefined}
              >
                Voz {v}
              </ToggleBtn>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1" role="group" aria-label="Tipo de nota">
            <ToggleBtn
              active={noteType === 'standard'}
              onClick={onSetNoteType ? () => onSetNoteType('standard') : undefined}
            >
              Normal
            </ToggleBtn>
            <ToggleBtn
              active={noteType === 'slash'}
              onClick={onSetNoteType ? () => onSetNoteType('slash') : undefined}
            >
              Slash
            </ToggleBtn>
            <ToggleBtn
              active={noteType === 'grace' && selectedItem.graceType === 'acciaccatura'}
              onClick={onSetNoteType ? () => onSetNoteType('grace', 'acciaccatura') : undefined}
            >
              Acciaccatura
            </ToggleBtn>
            <ToggleBtn
              active={noteType === 'grace' && selectedItem.graceType === 'appoggiatura'}
              onClick={onSetNoteType ? () => onSetNoteType('grace', 'appoggiatura') : undefined}
            >
              Appoggiatura
            </ToggleBtn>
          </div>
        </Section>
      )}

      {isNote && (
        <Section title="Digitacion">
          <div className="grid grid-cols-6 gap-1" role="group" aria-label="Digitacion">
            {[1, 2, 3, 4, 5].map((f) => {
              const active = selectedItem.fingering === f;
              return (
                <ToggleBtn
                  key={f}
                  active={active}
                  onClick={
                    onSetFingering ? () => onSetFingering(active ? undefined : f) : undefined
                  }
                  className="tabular-nums"
                >
                  {f}
                </ToggleBtn>
              );
            })}
            <ToggleBtn
              active={false}
              disabled={selectedItem.fingering === undefined}
              onClick={onSetFingering ? () => onSetFingering(undefined) : undefined}
              title="Quitar digitacion"
            >
              Ninguno
            </ToggleBtn>
          </div>
        </Section>
      )}

      <Section title="Pedal">
        <div className="grid grid-cols-2 gap-1" role="group" aria-label="Pedal">
          <ToggleBtn
            active={pedalValue === 'down'}
            onClick={
              onSetPedal ? () => onSetPedal(pedalValue === 'down' ? null : 'down') : undefined
            }
          >
            Pedal abajo
          </ToggleBtn>
          <ToggleBtn
            active={pedalValue === 'up'}
            onClick={onSetPedal ? () => onSetPedal(pedalValue === 'up' ? null : 'up') : undefined}
          >
            Pedal arriba
          </ToggleBtn>
        </div>
      </Section>

      {/* Lead sheet chord */}
      <Section title="Cifrado de acorde">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={selectedItem.chord ?? ''}
            onChange={(e) =>
              onUpdateChord?.(e.target.value.trim() === '' ? undefined : e.target.value)
            }
            disabled={!onUpdateChord}
            placeholder="Ej. Am7, G/B"
            aria-label="Cifrado de acorde"
            className={`${INPUT_CLS} disabled:opacity-40`}
          />
          <select
            value={chordKey}
            onChange={(e) => setChordKey(e.target.value as (typeof KEYS)[number])}
            aria-label="Tonalidad para sugerencias de acordes"
            className={`${INPUT_CLS} !w-auto shrink-0`}
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Acordes diatonicos">
          {diatonic.map((c) => (
            <ToggleBtn
              key={c}
              active={selectedItem.chord === c}
              onClick={
                onUpdateChord
                  ? () => onUpdateChord(selectedItem.chord === c ? undefined : c)
                  : undefined
              }
              className="font-mono"
            >
              {c}
            </ToggleBtn>
          ))}
        </div>
      </Section>

      {/* Lyric */}
      <Section title="Letra">
        <input
          type="text"
          value={selectedItem.lyric ?? ''}
          onChange={(e) => onUpdateLyric(e.target.value)}
          placeholder="Silaba"
          aria-label="Letra de la nota"
          className={INPUT_CLS}
        />
      </Section>
    </div>
  );
};

export default NoteInspectorTab;
