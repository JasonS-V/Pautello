import { useEffect, useRef, useState } from 'react';
import type { NoteDuration, Score, ScoreItem, Step } from '../../types/music';
import type { OmrResult } from '../../omr/omrEngine';
import type { OmrSourceSpan } from '../../omr/omrDecode';
import { ScoreView } from '../ScoreView/ScoreView';
import { OmrReviewPanel } from './OmrReviewPanel';

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
        <h3 className="text-sm font-semibold">Notación editable</h3>
        <div className="flex gap-2 text-xs">
          <label>
            Parte
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
              className="block rounded border p-1 text-slate-900"
            >
              {score.staves.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Compás
            <select
              aria-label="Compás de la revisión"
              value={measure.id}
              onChange={(e) => {
                setMeasureId(e.target.value);
                setItemId(null);
                setFocusSource(undefined);
                setRegionalItems(null);
              }}
              className="block rounded border p-1 text-slate-900"
            >
              {staff.measures.map((entry, index) => (
                <option key={entry.id} value={entry.id}>
                  {entry.printedNumber ?? index + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="inline-flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={reviewedMeasureIds.includes(measure.id)}
            onChange={() => onToggleMeasureReviewed(measure.id)}
          />
          {reviewedMeasureIds.includes(measure.id)
            ? 'Compás verificado por persona'
            : 'Compás pendiente de verificar'}
        </label>
        <div
          ref={notationRef}
          className="max-h-56 overflow-auto rounded border bg-white text-slate-900"
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
        <div className="flex flex-wrap gap-1" aria-label="Eventos del compás">
          {measure.items.map((entry, index) => (
            <button
              type="button"
              key={entry.id}
              onClick={() => selectItem(entry.id)}
              aria-pressed={entry.id === item?.id}
              className="rounded border px-2 py-1 text-xs aria-pressed:bg-amber-200"
            >
              {index + 1}.{' '}
              {entry.type === 'rest'
                ? 'Silencio'
                : `${entry.pitch?.step ?? '?'}${entry.pitch?.octave ?? ''}`}{' '}
              {entry.duration}
              {entry.isDotted ? '.' : ''}
            </button>
          ))}
        </div>
        {item && (
          <fieldset className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded border p-2 text-xs">
            <legend>Corregir evento seleccionado</legend>
            <label>
              Tipo
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
                className="block w-full rounded border p-1 text-slate-900"
              >
                <option value="note">Nota</option>
                <option value="rest">Silencio</option>
              </select>
            </label>
            {item.type === 'note' && (
              <>
                <label>
                  Altura
                  <select
                    aria-label="Altura del evento"
                    value={item.pitch?.step ?? 'C'}
                    onChange={(e) =>
                      edit((target) => {
                        target.pitch = { ...target.pitch!, step: e.target.value as Step };
                        target.pitches = [target.pitch];
                      })
                    }
                    className="block w-full rounded border p-1 text-slate-900"
                  >
                    {STEPS.map((step) => (
                      <option key={step}>{step}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Octava
                  <input
                    aria-label="Octava del evento"
                    type="number"
                    min="1"
                    max="7"
                    value={item.pitch?.octave ?? 4}
                    onChange={(e) =>
                      edit((target) => {
                        target.pitch = { ...target.pitch!, octave: Number(e.target.value) };
                        target.pitches = [target.pitch];
                      })
                    }
                    className="block w-full rounded border p-1 text-slate-900"
                  />
                </label>
              </>
            )}
            <label>
              Figura
              <select
                aria-label="Figura del evento"
                value={item.duration}
                onChange={(e) =>
                  edit((target) => {
                    target.duration = e.target.value as NoteDuration;
                  })
                }
                className="block w-full rounded border p-1 text-slate-900"
              >
                {DURATIONS.map((duration) => (
                  <option key={duration}>{duration}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={Boolean(item.isDotted)}
                onChange={(e) =>
                  edit((target) => {
                    target.isDotted = e.target.checked;
                  })
                }
              />
              Puntillo
            </label>
            <label>
              Barra
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
                className="block w-full rounded border p-1 text-slate-900"
              >
                <option value="standard">Simple</option>
                <option value="double">Doble</option>
                <option value="final">Final</option>
              </select>
            </label>
            {score.staves.length > 1 && (
              <label>
                Asignar a parte
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
                  className="block w-full rounded border p-1 text-slate-900"
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
              <label>
                Destino de navegación
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
                  className="block w-full rounded border p-1 text-slate-900"
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
          </fieldset>
        )}
        <button
          type="button"
          disabled={regionBusy}
          onClick={() => void recognizeRegion()}
          className="rounded border px-2 py-1 text-xs disabled:opacity-50"
        >
          {regionBusy ? 'Reconociendo región…' : 'Volver a reconocer este compás'}
        </button>
        {regionError && (
          <p role="alert" className="text-xs text-red-700">
            {regionError}
          </p>
        )}
        {regionalItems && (
          <div className="rounded border border-amber-400 p-2 text-xs space-y-2">
            <p>
              Propuesta regional: {regionalItems.length} evento(s). Comprueba la fuente antes de
              reemplazar este compás.
            </p>
            <button
              type="button"
              className="underline"
              onClick={() => {
                const next = structuredClone(score);
                next.staves
                  .find((s) => s.id === staff.id)!
                  .measures.find((m) => m.id === measure.id)!.items = regionalItems;
                onEdit(next, measure.id);
                setRegionalItems(null);
              }}
            >
              Aceptar propuesta regional
            </button>{' '}
            <button type="button" className="underline" onClick={() => setRegionalItems(null)}>
              Descartar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
