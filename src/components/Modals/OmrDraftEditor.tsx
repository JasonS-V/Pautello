import { useEffect, useRef, useState } from 'react';
import type { NoteDuration, Score, ScoreItem, Step } from '../../types/music';
import type { OmrResult } from '../../omr/omrEngine';
import type { OmrSourceSpan } from '../../omr/omrDecode';
import { ScoreView } from '../ScoreView/ScoreView';
import { OmrReviewPanel } from './OmrReviewPanel';
import { Plus, Trash2, Check, AlertCircle, RotateCcw } from '../ui/icons';

const DURATIONS: NoteDuration[] = ['w', 'h', 'q', '8', '16', '32'];
const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function OmrDraftEditor({
  score,
  result,
  onEdit,
  onRerecognize,
  reviewedWarningIds,
  onToggleReviewed,
  reviewedMeasureIds,
  onToggleMeasureReviewed,
}: {
  score: Score;
  result: OmrResult;
  onEdit: (score: Score, measureId: string) => void;
  onRerecognize: (staffId: string, measureId: string) => Promise<ScoreItem[]>;
  reviewedWarningIds: string[];
  onToggleReviewed: (id: string) => void;
  reviewedMeasureIds: string[];
  onToggleMeasureReviewed: (id: string) => void;
}) {
  const [staffId, setStaffId] = useState(score.staves[0]?.id ?? '');
  const staff = score.staves.find((entry) => entry.id === staffId) ?? score.staves[0];
  const [measureId, setMeasureId] = useState(staff?.measures[0]?.id ?? '');
  const measure = staff?.measures.find((entry) => entry.id === measureId) ?? staff?.measures[0];
  const [itemId, setItemId] = useState<string | null>(null);
  const item = measure?.items.find((entry) => entry.id === itemId) ?? measure?.items[0];
  const [focusSource, setFocusSource] = useState<OmrSourceSpan | undefined>();
  const [regionalItems, setRegionalItems] = useState<ScoreItem[] | null>(null);
  const [regionError, setRegionError] = useState('');
  const [regionBusy, setRegionBusy] = useState(false);
  const notationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = notationRef.current;
    const target = container?.querySelector('[data-measure-idx]');
    if (container && target)
      container.scrollTop +=
        target.getBoundingClientRect().top - container.getBoundingClientRect().top - 12;
  }, [measure?.id]);
  if (!staff || !measure) return null;

  const selectItem = (id: string) => {
    setItemId(id);
    setFocusSource(
      result.sourceLinks.find((link) => link.itemId === id)?.src ??
        result.sourceLinks.find((link) => link.measureId === measure.id)?.src
    );
  };
  const edit = (change: (selected: ScoreItem, target: Score) => void) => {
    const next = structuredClone(score);
    const target = next.staves
      .find((entry) => entry.id === staff.id)!
      .measures.find((entry) => entry.id === measure.id)!;
    const selected = target.items.find((entry) => entry.id === item.id)!;
    change(selected, next);
    onEdit(next, measure.id);
  };
  const previewScore: Score = { ...score, staves: [{ ...staff, measures: [measure] }] };
  const chooseWarning = (index: number) => {
    const src = result.warnings[index]?.src;
    setFocusSource(src);
    if (!src) return;
    const nearest = result.sourceLinks
      .filter(
        (link) => link.src?.page === src.page && link.src.system === src.system && link.measureId
      )
      .sort(
        (a, b) =>
          Math.abs((a.src?.bbox[0] ?? 0) - src.bbox[0]) -
          Math.abs((b.src?.bbox[0] ?? 0) - src.bbox[0])
      )[0];
    if (nearest?.staffId && nearest.measureId) {
      setStaffId(nearest.staffId);
      setMeasureId(nearest.measureId);
      setItemId(nearest.itemId);
    }
  };
  const recognizeRegion = async () => {
    setRegionBusy(true);
    setRegionError('');
    setRegionalItems(null);
    try {
      setRegionalItems(await onRerecognize(staff.id, measure.id));
    } catch (error) {
      setRegionError(error instanceof Error ? error.message : 'No se pudo reconocer la región.');
    } finally {
      setRegionBusy(false);
    }
  };

  return (
    <section aria-label="Comparar y corregir borrador OMR" className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0">
        <OmrReviewPanel
          result={result}
          focusSource={focusSource}
          reviewedWarningIds={reviewedWarningIds}
          onToggleReviewed={onToggleReviewed}
          onSelectWarning={chooseWarning}
        />
      </div>
      <div className="min-w-0 space-y-3">
        <div className="p-3 rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50/70 dark:bg-studio-elevated space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Notación editable
            </h3>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={reviewedMeasureIds.includes(measure.id)}
                onChange={() => onToggleMeasureReviewed(measure.id)}
                className="w-4 h-4 accent-studio-accent rounded cursor-pointer"
              />
              <span>
                {reviewedMeasureIds.includes(measure.id)
                  ? 'Compás verificado por persona'
                  : 'Compás pendiente de verificar'}
              </span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="space-y-1 text-slate-700 dark:text-slate-300 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">Parte</span>
              <select
                aria-label="Parte de la revisión"
                value={staff.id}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  setMeasureId(
                    score.staves.find((s) => s.id === e.target.value)?.measures[0]?.id ?? ''
                  );
                  setItemId(null);
                  setFocusSource(undefined);
                }}
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              >
                {score.staves.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-slate-700 dark:text-slate-300 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">Compás</span>
              <select
                aria-label="Compás de la revisión"
                value={measure.id}
                onChange={(e) => {
                  setMeasureId(e.target.value);
                  setItemId(null);
                  setFocusSource(undefined);
                  setRegionalItems(null);
                }}
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              >
                {staff.measures.map((entry, index) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.printedNumber ?? index + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {score.staves.length === 2 && (
            <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-studio-line/60 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Gran Pentagrama (Piano)"
                checked={Boolean(score.isGrandStaff)}
                onChange={(e) =>
                  edit((_target, next) => {
                    next.isGrandStaff = e.target.checked ? true : undefined;
                  })
                }
                className="w-4 h-4 accent-studio-accent rounded cursor-pointer"
              />
              <span className="font-medium">Piano (Gran Pentagrama)</span>
            </label>
          )}
        </div>

        <div
          ref={notationRef}
          className="max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-studio-line bg-white text-slate-900 p-2 shadow-inner"
        >
          <ScoreView
            score={previewScore}
            selectedItemId={item?.id ?? null}
            selectedMeasureIdx={0}
            onSelectItem={(_index, id) => {
              if (id) selectItem(id);
            }}
            onInsertNoteAt={() => {}}
            onInsertRestAt={() => {}}
            onDeleteMeasure={() => {}}
            activeDuration="q"
            activeAccidental={null}
            isRestMode={false}
            namingConvention="latin"
            showNoteNames={false}
            playbackState={{
              isPlaying: false,
              isPaused: false,
              currentMeasureIndex: -1,
              currentItemIndex: -1,
              currentBeat: 0,
            }}
          />
        </div>

        <div
          className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50/70 dark:bg-studio-elevated"
          aria-label="Eventos del compás"
        >
          {measure.items.map((entry, index) => {
            const isSelected = entry.id === item?.id;
            return (
              <button
                type="button"
                key={entry.id}
                onClick={() => selectItem(entry.id)}
                aria-pressed={isSelected}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 border-amber-500 text-slate-950 shadow-xs'
                    : 'bg-white dark:bg-studio-surface border-slate-200 dark:border-studio-line text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-studio-hover'
                }`}
              >
                <span className="opacity-70 mr-1">{index + 1}.</span>
                {entry.type === 'rest'
                  ? 'Silencio'
                  : `${entry.pitch?.step ?? '?'}${entry.pitch?.octave ?? ''}`}{' '}
                {entry.duration}
                {entry.isDotted ? '.' : ''}
              </button>
            );
          })}
        </div>

        {item && (
          <fieldset className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50/70 dark:bg-studio-elevated p-3.5 text-xs text-slate-800 dark:text-slate-200">
            <legend className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 px-1">
              Corregir evento seleccionado
            </legend>
            <label className="space-y-1 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">Tipo</span>
              <select
                aria-label="Tipo del evento"
                value={item.type}
                onChange={(e) =>
                  edit((target) => {
                    target.type = e.target.value as ScoreItem['type'];
                    if (target.type === 'rest') {
                      delete target.pitch;
                      delete target.pitches;
                    } else if (!target.pitch) {
                      target.pitch = { step: 'C', octave: 4, accidental: null };
                      target.pitches = [target.pitch];
                    }
                  })
                }
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              >
                <option value="note">Nota</option>
                <option value="rest">Silencio</option>
              </select>
            </label>
            {item.type === 'note' && (
              <div className="col-span-full space-y-2.5 rounded-lg border border-slate-200 dark:border-studio-line bg-white dark:bg-studio-surface p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>
                    Alturas del evento{' '}
                    {(item.pitches?.length ?? 1) > 1
                      ? `(Acorde: ${item.pitches!.length} notas)`
                      : '(Nota simple)'}
                  </span>
                  {(item.pitches?.length ?? 1) < 6 && (
                    <button
                      type="button"
                      aria-label="Añadir nota al acorde"
                      className="inline-flex items-center gap-1 rounded-md bg-amber-500 hover:bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow-xs transition-colors cursor-pointer"
                      onClick={() =>
                        edit((target) => {
                          const current = target.pitches?.length
                            ? [...target.pitches]
                            : target.pitch
                              ? [target.pitch]
                              : [{ step: 'C' as Step, octave: 4, accidental: null }];
                          current.push({ step: 'E' as Step, octave: 4, accidental: null });
                          target.pitches = current;
                          target.pitch = current[0];
                        })
                      }
                    >
                      <Plus className="w-3 h-3" />
                      <span>Añadir nota al acorde</span>
                    </button>
                  )}
                </div>
                {(item.pitches?.length
                  ? item.pitches
                  : item.pitch
                    ? [item.pitch]
                    : [{ step: 'C' as Step, octave: 4, accidental: null }]
                ).map((p, pIdx) => (
                  <div
                    key={pIdx}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end border-t border-slate-100 dark:border-studio-line/60 pt-2 first:border-0 first:pt-0"
                  >
                    <label className="space-y-1">
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {pIdx === 0 ? 'Altura' : `Altura nota ${pIdx + 1}`}
                      </span>
                      <select
                        aria-label={pIdx === 0 ? 'Altura del evento' : `Altura nota ${pIdx + 1}`}
                        value={p.step}
                        onChange={(e) =>
                          edit((target) => {
                            const current = target.pitches?.length
                              ? [...target.pitches]
                              : [target.pitch!];
                            current[pIdx] = { ...current[pIdx], step: e.target.value as Step };
                            target.pitches = current;
                            target.pitch = current[0];
                          })
                        }
                        className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-elevated text-slate-900 dark:text-slate-100 px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
                      >
                        {STEPS.map((step) => (
                          <option key={step}>{step}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {pIdx === 0 ? 'Octava' : `Octava nota ${pIdx + 1}`}
                      </span>
                      <input
                        aria-label={pIdx === 0 ? 'Octava del evento' : `Octava nota ${pIdx + 1}`}
                        type="number"
                        min="1"
                        max="7"
                        value={p.octave}
                        onChange={(e) =>
                          edit((target) => {
                            const current = target.pitches?.length
                              ? [...target.pitches]
                              : [target.pitch!];
                            current[pIdx] = { ...current[pIdx], octave: Number(e.target.value) };
                            target.pitches = current;
                            target.pitch = current[0];
                          })
                        }
                        className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-elevated text-slate-900 dark:text-slate-100 px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {pIdx === 0 ? 'Alteración' : `Alteración nota ${pIdx + 1}`}
                      </span>
                      <select
                        aria-label={
                          pIdx === 0 ? 'Alteración del evento' : `Alteración nota ${pIdx + 1}`
                        }
                        value={p.accidental ?? ''}
                        onChange={(e) =>
                          edit((target) => {
                            const current = target.pitches?.length
                              ? [...target.pitches]
                              : [target.pitch!];
                            const acc = (e.target.value || null) as '#' | 'b' | 'n' | null;
                            current[pIdx] = { ...current[pIdx], accidental: acc };
                            target.pitches = current;
                            target.pitch = current[0];
                          })
                        }
                        className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-elevated text-slate-900 dark:text-slate-100 px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
                      >
                        <option value="">Ninguna</option>
                        <option value="#">Sostenido (#)</option>
                        <option value="b">Bemol (b)</option>
                        <option value="n">Becuadro (n)</option>
                      </select>
                    </label>
                    <div>
                      {(item.pitches?.length ?? 0) > 1 && (
                        <button
                          type="button"
                          aria-label={`Eliminar nota ${pIdx + 1} del acorde`}
                          className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                          onClick={() =>
                            edit((target) => {
                              const current = (
                                target.pitches?.length ? [...target.pitches] : [target.pitch!]
                              ).filter((_, i) => i !== pIdx);
                              target.pitches = current;
                              target.pitch = current[0];
                            })
                          }
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Quitar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <label className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-studio-line/60 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label="Ligadura de salida"
                    checked={Boolean(item.isTied)}
                    onChange={(e) =>
                      edit((target) => {
                        target.isTied = e.target.checked || undefined;
                      })
                    }
                    className="w-4 h-4 accent-studio-accent rounded cursor-pointer"
                  />
                  <span>Ligadura de salida</span>
                </label>
              </div>
            )}
            <label className="space-y-1 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">Figura</span>
              <select
                aria-label="Figura del evento"
                value={item.duration}
                onChange={(e) =>
                  edit((target) => {
                    target.duration = e.target.value as NoteDuration;
                  })
                }
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              >
                {DURATIONS.map((duration) => (
                  <option key={duration}>{duration}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">Voz</span>
              <select
                aria-label="Voz del evento"
                value={item.voice ?? 1}
                onChange={(e) =>
                  edit((target) => {
                    target.voice = Number(e.target.value) === 2 ? 2 : 1;
                  })
                }
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              >
                <option value="1">Voz 1 (plicas arriba)</option>
                <option value="2">Voz 2 (plicas abajo)</option>
              </select>
            </label>
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(item.isDotted)}
                  onChange={(e) =>
                    edit((target) => {
                      target.isDotted = e.target.checked;
                    })
                  }
                  className="w-4 h-4 accent-studio-accent rounded cursor-pointer"
                />
                <span>Puntillo</span>
              </label>
              <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  aria-label="Calderón del evento"
                  checked={item.articulation === 'fermata'}
                  onChange={(e) =>
                    edit((target) => {
                      target.articulation = e.target.checked ? 'fermata' : undefined;
                    })
                  }
                  className="w-4 h-4 accent-studio-accent rounded cursor-pointer"
                />
                <span>Calderón</span>
              </label>
            </div>
            <label className="space-y-1 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">Barra</span>
              <select
                aria-label="Barra del compás"
                value={measure.barline ?? 'standard'}
                onChange={(e) =>
                  edit((_target, next) => {
                    next.staves
                      .find((s) => s.id === staff.id)!
                      .measures.find((m) => m.id === measure.id)!.barline = e.target.value as
                      'standard' | 'double' | 'final';
                  })
                }
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              >
                <option value="standard">Simple</option>
                <option value="double">Doble</option>
                <option value="final">Final</option>
              </select>
            </label>
            {score.staves.length > 1 && (
              <label className="space-y-1 font-medium">
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                  Asignar a parte
                </span>
                <select
                  aria-label="Asignar evento a parte"
                  value={staff.id}
                  onChange={(e) => {
                    const destinationId = e.target.value;
                    const index = staff.measures.findIndex((entry) => entry.id === measure.id);
                    if (!score.staves.find((entry) => entry.id === destinationId)?.measures[index])
                      return;
                    edit((selected, next) => {
                      const source = next.staves.find((entry) => entry.id === staff.id)!.measures[
                        index
                      ];
                      const destination = next.staves.find((entry) => entry.id === destinationId)!
                        .measures[index];
                      source.items = source.items.filter((entry) => entry.id !== selected.id);
                      if (!source.items.length)
                        source.items = [
                          {
                            id: `omr-empty-${crypto.randomUUID()}`,
                            type: 'rest',
                            duration: 'w',
                            omrPlaceholder: true,
                          },
                        ];
                      destination.items.push(selected);
                    });
                    setStaffId(destinationId);
                    setItemId(item.id);
                  }}
                  className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
                >
                  {score.staves.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {measure.navigationMark && (
              <label className="space-y-1 font-medium">
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                  Destino de navegación
                </span>
                <select
                  aria-label="Destino de navegación"
                  value={measure.navigationTargetMeasureId ?? ''}
                  onChange={(e) =>
                    edit((_target, next) => {
                      next.staves
                        .find((s) => s.id === staff.id)!
                        .measures.find((m) => m.id === measure.id)!.navigationTargetMeasureId =
                        e.target.value || undefined;
                    })
                  }
                  className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
                >
                  <option value="">Pendiente</option>
                  {staff.measures.map((entry, index) => (
                    <option key={entry.id} value={entry.id}>
                      Compás {entry.printedNumber ?? index + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="col-span-full flex flex-wrap gap-2 pt-2 border-t border-slate-200/80 dark:border-studio-line">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-studio-hover transition-colors cursor-pointer"
                onClick={() => {
                  const next = structuredClone(score);
                  const targetMeasure = next.staves
                    .find((s) => s.id === staff.id)!
                    .measures.find((m) => m.id === measure.id)!;
                  const newItem: ScoreItem = {
                    id: `omr-manual-${crypto.randomUUID()}`,
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'C', octave: staff.clef === 'bass' ? 3 : 4, accidental: null },
                  };
                  targetMeasure.items.push(newItem);
                  onEdit(next, measure.id);
                  setItemId(newItem.id);
                }}
              >
                <Plus className="w-3.5 h-3.5 text-amber-500" />
                <span>Añadir evento al compás</span>
              </button>
              {measure.items.length > 1 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  onClick={() => {
                    const next = structuredClone(score);
                    const targetMeasure = next.staves
                      .find((s) => s.id === staff.id)!
                      .measures.find((m) => m.id === measure.id)!;
                    targetMeasure.items = targetMeasure.items.filter(
                      (entry) => entry.id !== item.id
                    );
                    onEdit(next, measure.id);
                    setItemId(targetMeasure.items[0]?.id ?? null);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar evento seleccionado</span>
                </button>
              )}
            </div>
          </fieldset>
        )}

        <details className="rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50/70 dark:bg-studio-elevated p-3.5 text-xs text-slate-800 dark:text-slate-200">
          <summary className="cursor-pointer font-bold select-none text-slate-700 dark:text-slate-200">
            Propiedades e indicaciones del compás
          </summary>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <label className="space-y-1 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Número impreso
              </span>
              <input
                aria-label="Número impreso del compás"
                type="number"
                min="1"
                value={measure.printedNumber ?? ''}
                onChange={(e) => {
                  const next = structuredClone(score);
                  const targetMeasure = next.staves
                    .find((s) => s.id === staff.id)!
                    .measures.find((m) => m.id === measure.id)!;
                  targetMeasure.printedNumber = e.target.value ? Number(e.target.value) : undefined;
                  onEdit(next, measure.id);
                }}
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              />
            </label>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-1.5 py-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  aria-label="Anacrusa del compás"
                  checked={Boolean(measure.isAnacrusis)}
                  onChange={(e) => {
                    const next = structuredClone(score);
                    const targetMeasure = next.staves
                      .find((s) => s.id === staff.id)!
                      .measures.find((m) => m.id === measure.id)!;
                    targetMeasure.isAnacrusis = e.target.checked || undefined;
                    onEdit(next, measure.id);
                  }}
                  className="w-4 h-4 accent-studio-accent rounded cursor-pointer"
                />
                <span>Anacrusa</span>
              </label>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-1.5 py-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  aria-label="Salto de sistema"
                  checked={Boolean(measure.systemBreak)}
                  onChange={(e) => {
                    const next = structuredClone(score);
                    const targetMeasure = next.staves
                      .find((s) => s.id === staff.id)!
                      .measures.find((m) => m.id === measure.id)!;
                    targetMeasure.systemBreak = e.target.checked || undefined;
                    onEdit(next, measure.id);
                  }}
                  className="w-4 h-4 accent-studio-accent rounded cursor-pointer"
                />
                <span>Salto de sistema</span>
              </label>
            </div>
            <label className="space-y-1 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Métrica local
              </span>
              <select
                aria-label="Métrica local del compás"
                value={
                  measure.timeSignatureChange
                    ? `${measure.timeSignatureChange.beats}/${measure.timeSignatureChange.beatType}${
                        measure.meterGlyph ? `-${measure.meterGlyph}` : ''
                      }`
                    : ''
                }
                onChange={(e) => {
                  const next = structuredClone(score);
                  const targetMeasure = next.staves
                    .find((s) => s.id === staff.id)!
                    .measures.find((m) => m.id === measure.id)!;
                  const val = e.target.value;
                  if (!val) {
                    delete targetMeasure.timeSignatureChange;
                    delete targetMeasure.meterGlyph;
                  } else {
                    const [meterPart, glyphPart] = val.split('-');
                    const [beats, beatType] = meterPart.split('/').map(Number);
                    targetMeasure.timeSignatureChange = { beats, beatType };
                    targetMeasure.meterGlyph = glyphPart === 'common' ? 'common' : undefined;
                  }
                  onEdit(next, measure.id);
                }}
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              >
                <option value="">Sin cambio</option>
                <option value="3/4">3/4</option>
                <option value="4/4">4/4</option>
                <option value="4/4-common">4/4 (Compasillo C)</option>
                <option value="2/4">2/4</option>
                <option value="6/8">6/8</option>
              </select>
            </label>
            <label className="space-y-1 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Marca de ensayo
              </span>
              <input
                aria-label="Marca de ensayo del compás"
                type="text"
                maxLength={12}
                value={measure.rehearsalMark ?? ''}
                onChange={(e) => {
                  const next = structuredClone(score);
                  const targetMeasure = next.staves
                    .find((s) => s.id === staff.id)!
                    .measures.find((m) => m.id === measure.id)!;
                  targetMeasure.rehearsalMark = e.target.value || undefined;
                  onEdit(next, measure.id);
                }}
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              />
            </label>
            <label className="space-y-1 font-medium">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Texto de estilo o tempo
              </span>
              <input
                aria-label="Texto de estilo o tempo"
                type="text"
                maxLength={60}
                value={measure.tempoText ?? ''}
                onChange={(e) => {
                  const next = structuredClone(score);
                  const targetMeasure = next.staves
                    .find((s) => s.id === staff.id)!
                    .measures.find((m) => m.id === measure.id)!;
                  targetMeasure.tempoText = e.target.value || undefined;
                  onEdit(next, measure.id);
                }}
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              />
            </label>
            <label className="space-y-1 font-medium sm:col-span-2">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Marca de navegación
              </span>
              <select
                aria-label="Marca de navegación del compás"
                value={measure.navigationMark ?? ''}
                onChange={(e) => {
                  const next = structuredClone(score);
                  const targetMeasure = next.staves
                    .find((s) => s.id === staff.id)!
                    .measures.find((m) => m.id === measure.id)!;
                  targetMeasure.navigationMark = (e.target.value || undefined) as
                    'segno' | 'toCoda' | 'dalSegnoAlCoda' | 'coda' | undefined;
                  onEdit(next, measure.id);
                }}
                className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
              >
                <option value="">Ninguna</option>
                <option value="segno">Segno</option>
                <option value="toCoda">To Coda</option>
                <option value="dalSegnoAlCoda">D.S. al Coda</option>
                <option value="coda">Coda</option>
              </select>
            </label>
          </div>
        </details>

        <button
          type="button"
          disabled={regionBusy}
          onClick={() => void recognizeRegion()}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-elevated text-slate-700 dark:text-slate-200 hover:border-amber-500/60 dark:hover:border-studio-accent hover:text-amber-700 dark:hover:text-amber-400 transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${regionBusy ? 'animate-spin' : ''}`} />
          <span>{regionBusy ? 'Reconociendo región…' : 'Volver a reconocer este compás'}</span>
        </button>

        {regionError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <p role="alert">{regionError}</p>
          </div>
        )}

        {regionalItems && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/40 p-3.5 text-xs text-amber-950 dark:text-amber-100 space-y-2.5">
            <p className="font-semibold">
              Propuesta regional: {regionalItems.length} evento(s). Comprueba la fuente antes de
              reemplazar este compás.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition-colors cursor-pointer"
                onClick={() => {
                  const next = structuredClone(score);
                  next.staves
                    .find((s) => s.id === staff.id)!
                    .measures.find((m) => m.id === measure.id)!.items = regionalItems;
                  onEdit(next, measure.id);
                  setRegionalItems(null);
                }}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Aceptar propuesta regional</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 dark:border-amber-800 bg-white/80 dark:bg-studio-surface text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-studio-hover transition-colors cursor-pointer"
                onClick={() => setRegionalItems(null)}
              >
                Descartar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
