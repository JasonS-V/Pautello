import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Clipboard,
  Repeat,
  Sliders,
  AlertTriangle,
} from '../../ui/icons';
import {
  Score,
  Measure,
  BarlineType,
  NavigationMark,
  TimeSignature,
  KeySignature,
} from '../../../types/music';
import { getItemBeats, KEY_SIGNATURE_DATA } from '../../../constants/pitches';
import { resolveMeasureCapacity } from '../../../utils/measureTiming';
import { CustomSelect, CustomSelectOption } from '../../ui/CustomSelect';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

export interface MeasureInspectorTabProps {
  score: Score;
  currentMeasure: Measure | undefined;
  selectedMeasureIdx: number;
  measureRange?: { start: number; end: number } | null;
  hasClipboardMeasures?: boolean;
  layoutMode?: 'continuous' | 'paged';
  measuresPerSystem?: number;
  onAddMeasure: () => void;
  onDeleteMeasure: () => void;
  onCopyMeasureRange?: () => void;
  onPasteMeasureRange?: () => void;
  onDeleteSelectedMeasures?: () => void;
  onToggleRepeatStart?: (measureIdx: number) => void;
  onToggleRepeatEnd?: (measureIdx: number) => void;
  onSetVolta?: (measureIdx: number, volta?: string | null) => void;
  onSetAnacrusis?: (measureIdx: number, isAnacrusis: boolean, pickupBeats?: number) => void;
  onToggleSystemBreak?: (measureIdx: number) => void;
  onTogglePageBreak?: (measureIdx: number) => void;
  onSetMultimeasureRest?: (measureIdx: number, count?: number) => void;
  onAutoConsolidateTacets?: (staffIdx?: number) => void;
  onClearAllTacets?: (staffIdx?: number) => void;
  onSetMeasuresPerSystem?: (count: number) => void;
  onSelectLayoutMode?: (mode: 'continuous' | 'paged') => void;
}

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

const BARLINE_LABELS: Record<BarlineType, string> = {
  standard: 'Simple',
  double: 'Doble',
  final: 'Final',
};

const NAVIGATION_LABELS: Record<Exclude<NavigationMark, null>, string> = {
  segno: 'Segno',
  coda: 'Coda',
  daCapo: 'D.C.',
  dalSegno: 'D.S.',
  daCapoAlFine: 'D.C. al Fine',
  dalSegnoAlCoda: 'D.S. al Coda',
  toCoda: 'To Coda',
  fine: 'Fine',
};

const VOLTA_OPTIONS: CustomSelectOption<string>[] = [
  { value: 'none', label: 'Sin casilla' },
  { value: '1.', label: 'Casilla 1.' },
  { value: '2.', label: 'Casilla 2.' },
  { value: '1, 3.', label: 'Casillas 1, 3.' },
  { value: '2, 4.', label: 'Casillas 2, 4.' },
];

const PER_SYSTEM_OPTIONS = [2, 3, 4, 5, 6, 8];
const BEAT_EPSILON = 0.001;

/* ------------------------------------------------------------------ */
/* Estilos compartidos                                                 */
/* ------------------------------------------------------------------ */

const CARD =
  'rounded-lg border border-slate-200/80 bg-slate-50 dark:border-studio-border dark:bg-studio-card';
const SECTION_TITLE =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400';
const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100';
const BTN_NEUTRAL = `${BTN_BASE} border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-studio-border dark:bg-studio-surface dark:text-slate-200 dark:hover:bg-studio-raised`;
const BTN_DANGER = `${BTN_BASE} border-rose-300/70 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20`;
const BTN_PRIMARY = `${BTN_BASE} border-amber-400/60 bg-amber-400/90 text-slate-900 hover:bg-amber-400 dark:border-amber-500/50 dark:bg-amber-500/90 dark:hover:bg-amber-400`;

const toggleClass = (active: boolean): string =>
  `${BTN_BASE} ${
    active
      ? 'border-amber-400/70 bg-amber-100 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300'
      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-studio-border dark:bg-studio-surface dark:text-slate-300 dark:hover:bg-studio-raised'
  }`;

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const formatBeats = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

type FillState = 'complete' | 'incomplete' | 'overflow';

const FILL_STYLES: Record<FillState, { bar: string; text: string; label: string }> = {
  complete: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    label: 'Completo',
  },
  incomplete: {
    bar: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'Incompleto',
  },
  overflow: {
    bar: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    label: 'Desbordado',
  },
};

/* ------------------------------------------------------------------ */
/* Subcomponentes                                                      */
/* ------------------------------------------------------------------ */

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className={`${CARD} space-y-2.5 p-3`}>
    <h3 className={SECTION_TITLE}>{title}</h3>
    {children}
  </section>
);

const MetaRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 text-xs">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="truncate font-mono tabular-nums text-slate-800 dark:text-slate-100">
      {value}
    </span>
  </div>
);

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

export const MeasureInspectorTab: React.FC<MeasureInspectorTabProps> = ({
  score,
  currentMeasure,
  selectedMeasureIdx,
  measureRange,
  hasClipboardMeasures = false,
  layoutMode = 'continuous',
  measuresPerSystem = 4,
  onAddMeasure,
  onDeleteMeasure,
  onCopyMeasureRange,
  onPasteMeasureRange,
  onDeleteSelectedMeasures,
  onToggleRepeatStart,
  onToggleRepeatEnd,
  onSetVolta,
  onSetAnacrusis,
  onToggleSystemBreak,
  onTogglePageBreak,
  onSetMultimeasureRest,
  onAutoConsolidateTacets,
  onClearAllTacets,
  onSetMeasuresPerSystem,
  onSelectLayoutMode,
}) => {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const totalMeasures = score.staves[0]?.measures.length ?? 0;

  const hasRange =
    !!measureRange && measureRange.end >= measureRange.start && measureRange.start >= 0;
  const rangeCount = hasRange && measureRange ? measureRange.end - measureRange.start + 1 : 1;
  const isMultiSelection = rangeCount > 1;

  /* Compas efectivo: ultimo cambio de compas / tonalidad hasta el compas seleccionado. */
  const { effectiveTime, effectiveKey } = useMemo(() => {
    let time: TimeSignature = score.timeSignature;
    let key: KeySignature = score.keySignature;
    const measures = score.staves[0]?.measures ?? [];
    for (let i = 0; i <= selectedMeasureIdx && i < measures.length; i += 1) {
      const m = measures[i];
      if (m.timeSignatureChange) time = m.timeSignatureChange;
      if (m.keySignatureChange) key = m.keySignatureChange;
    }
    return { effectiveTime: time, effectiveKey: key };
  }, [score, selectedMeasureIdx]);

  /* Ocupacion metrica (solo voz principal para no duplicar el conteo). */
  const metrics = useMemo(() => {
    if (!currentMeasure) return null;
    const capacity = resolveMeasureCapacity(score, currentMeasure, selectedMeasureIdx);
    const occupied = currentMeasure.items.reduce((sum, item) => {
      const voice = (item as { voice?: number }).voice;
      if (voice === 2) return sum;
      return sum + getItemBeats(item.duration, item.isDotted, item.tuplet);
    }, 0);
    let state: FillState = 'incomplete';
    if (occupied > capacity + BEAT_EPSILON) state = 'overflow';
    else if (Math.abs(occupied - capacity) <= BEAT_EPSILON) state = 'complete';
    const ratio = capacity > 0 ? Math.min(occupied / capacity, 1) : 0;
    return { capacity, occupied, state, ratio };
  }, [score, currentMeasure, selectedMeasureIdx]);

  /* Cuadricula de compases (primer pentagrama como referencia). */
  const measureGrid = useMemo(() => {
    const measures = score.staves[0]?.measures ?? [];
    return measures.map((m, idx) => {
      const capacity = resolveMeasureCapacity(score, m, idx);
      const occupied = m.items.reduce((sum, item) => {
        const voice = (item as { voice?: number }).voice;
        if (voice === 2) return sum;
        return sum + getItemBeats(item.duration, item.isDotted, item.tuplet);
      }, 0);
      let state: FillState = 'incomplete';
      if (occupied > capacity + BEAT_EPSILON) state = 'overflow';
      else if (Math.abs(occupied - capacity) <= BEAT_EPSILON) state = 'complete';
      return { idx, state };
    });
  }, [score]);

  const handleConfirmDelete = () => {
    if (isMultiSelection && onDeleteSelectedMeasures) onDeleteSelectedMeasures();
    else onDeleteMeasure();
    setConfirmDeleteOpen(false);
  };

  const keyInfo = KEY_SIGNATURE_DATA[effectiveKey];
  const keyLabel = keyInfo ? keyInfo.name : String(effectiveKey);

  const navigationLabel = currentMeasure?.navigationMark
    ? NAVIGATION_LABELS[currentMeasure.navigationMark]
    : 'Ninguna';

  const multimeasureCount = currentMeasure?.multimeasureRest ?? 0;
  const pickupBeats = currentMeasure?.pickupBeats ?? 1;
  const cannotDelete = totalMeasures <= 1;

  /* Sin compas seleccionado */
  if (!currentMeasure) {
    return (
      <div className="space-y-3 p-3">
        <div className={`${CARD} flex flex-col items-center gap-2 px-4 py-8 text-center`}>
          <Sliders className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selecciona un compas para editar sus propiedades.
          </p>
          <button type="button" className={BTN_PRIMARY} onClick={onAddMeasure}>
            <Plus className="h-3.5 w-3.5" />
            Agregar compas
          </button>
        </div>
      </div>
    );
  }

  const fill = metrics ? FILL_STYLES[metrics.state] : FILL_STYLES.incomplete;

  return (
    <div className="space-y-3 text-slate-800 dark:text-slate-100">
      {/* Cabecera */}
      <header className="flex items-end justify-between gap-2">
        <div>
          <p className={SECTION_TITLE}>Compas</p>
          <p className="font-mono text-lg font-semibold tabular-nums leading-tight">
            {selectedMeasureIdx + 1}
            <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
              {' '}
              / {totalMeasures}
            </span>
          </p>
        </div>
        {isMultiSelection && measureRange && (
          <span className="rounded-md border border-amber-400/50 bg-amber-100 px-2 py-0.5 font-mono text-[11px] tabular-nums text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
            Rango {measureRange.start + 1}-{measureRange.end + 1} ({rangeCount})
          </span>
        )}
      </header>

      {/* Ocupacion metrica */}
      {metrics && (
        <Section title="Ocupacion metrica">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-xs font-medium ${fill.text}`}>
              {metrics.state === 'overflow' && (
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              )}
              {fill.label}
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
              {formatBeats(metrics.occupied)} / {formatBeats(metrics.capacity)} tiempos
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Ocupacion metrica del compas"
            aria-valuemin={0}
            aria-valuemax={metrics.capacity}
            aria-valuenow={Number(metrics.occupied.toFixed(3))}
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-studio-deep"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ease-out ${fill.bar}`}
              style={{ width: `${metrics.ratio * 100}%` }}
            />
          </div>
          {metrics.state === 'overflow' && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400">
              El contenido excede la capacidad del compas en{' '}
              {formatBeats(metrics.occupied - metrics.capacity)} tiempos.
            </p>
          )}
          <div className="space-y-1 border-t border-slate-200/80 pt-2 dark:border-studio-border">
            <MetaRow label="Compas" value={`${effectiveTime.beats}/${effectiveTime.beatType}`} />
            <MetaRow label="Tonalidad" value={keyLabel} />
            <MetaRow
              label="Barra final"
              value={BARLINE_LABELS[currentMeasure.barline ?? 'standard']}
            />
            <MetaRow label="Navegacion" value={navigationLabel} />
          </div>
        </Section>
      )}

      {/* Cuadricula de compases */}
      {measureGrid.length > 0 && (
        <Section title="Estado por compas">
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-1"
            role="list"
            aria-label="Estado metrico de cada compas"
          >
            {measureGrid.map(({ idx, state }) => {
              const inRange = hasRange && measureRange
                ? idx >= measureRange.start && idx <= measureRange.end
                : false;
              const isCurrent = idx === selectedMeasureIdx;
              const stateStyle =
                state === 'complete'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : state === 'overflow'
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
              return (
                <div
                  key={idx}
                  role="listitem"
                  aria-current={isCurrent ? 'true' : undefined}
                  title={`Compas ${idx + 1}: ${FILL_STYLES[state].label}`}
                  className={`flex h-7 select-none items-center justify-center rounded border font-mono text-[10px] tabular-nums transition-transform duration-150 active:scale-[0.98] ${stateStyle} ${
                    isCurrent
                      ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-50 dark:ring-offset-studio-card'
                      : inRange
                        ? 'ring-1 ring-amber-400/60'
                        : ''
                  }`}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-emerald-500" />
              Completo
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-amber-500" />
              Incompleto
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-rose-500" />
              Desbordado
            </span>
          </div>
        </Section>
      )}

      {/* Acciones de compas */}
      <Section title="Acciones">
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className={BTN_PRIMARY} onClick={onAddMeasure}>
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </button>
          <button
            type="button"
            className={BTN_DANGER}
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={cannotDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isMultiSelection ? `Eliminar (${rangeCount})` : 'Eliminar'}
          </button>
          <button
            type="button"
            className={BTN_NEUTRAL}
            onClick={onCopyMeasureRange}
            disabled={!onCopyMeasureRange}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </button>
          <button
            type="button"
            className={BTN_NEUTRAL}
            onClick={onPasteMeasureRange}
            disabled={!onPasteMeasureRange || !hasClipboardMeasures}
          >
            <Clipboard className="h-3.5 w-3.5" />
            Pegar
          </button>
        </div>
      </Section>

      {/* Repeticiones y casillas */}
      <Section title="Repeticiones">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            aria-pressed={!!currentMeasure.repeatStart}
            className={toggleClass(!!currentMeasure.repeatStart)}
            onClick={() => onToggleRepeatStart?.(selectedMeasureIdx)}
            disabled={!onToggleRepeatStart}
          >
            <Repeat className="h-3.5 w-3.5" />
            Inicio
          </button>
          <button
            type="button"
            aria-pressed={!!currentMeasure.repeatEnd}
            className={toggleClass(!!currentMeasure.repeatEnd)}
            onClick={() => onToggleRepeatEnd?.(selectedMeasureIdx)}
            disabled={!onToggleRepeatEnd}
          >
            <Repeat className="h-3.5 w-3.5" />
            Fin
          </button>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Casilla de volta</span>
          <CustomSelect<string>
            value={currentMeasure.volta ?? 'none'}
            options={VOLTA_OPTIONS}
            disabled={!onSetVolta}
            onChange={(value) => onSetVolta?.(selectedMeasureIdx, value === 'none' ? null : value)}
          />
        </div>
      </Section>

      {/* Anacrusa */}
      <Section title="Anacrusa">
        <button
          type="button"
          aria-pressed={!!currentMeasure.isAnacrusis}
          className={`${toggleClass(!!currentMeasure.isAnacrusis)} w-full`}
          onClick={() =>
            onSetAnacrusis?.(
              selectedMeasureIdx,
              !currentMeasure.isAnacrusis,
              currentMeasure.isAnacrusis ? undefined : pickupBeats
            )
          }
          disabled={!onSetAnacrusis}
        >
          {currentMeasure.isAnacrusis ? 'Compas anacrusico activo' : 'Marcar como anacrusa'}
        </button>
        {currentMeasure.isAnacrusis && (
          <label className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            Tiempos de anacrusa
            <input
              type="number"
              min={0.25}
              step={0.25}
              max={Math.max(effectiveTime.beats, 1)}
              value={pickupBeats}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (Number.isFinite(next) && next > 0) {
                  onSetAnacrusis?.(selectedMeasureIdx, true, next);
                }
              }}
              className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs tabular-nums text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-studio-border dark:bg-studio-surface dark:text-slate-100"
            />
          </label>
        )}
      </Section>

      {/* Silencios multicompas */}
      <Section title="Silencio multicompas (tacet)">
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            Compases
            <input
              type="number"
              min={0}
              max={Math.max(totalMeasures - selectedMeasureIdx, 1)}
              step={1}
              value={multimeasureCount}
              disabled={!onSetMultimeasureRest}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10);
                onSetMultimeasureRest?.(
                  selectedMeasureIdx,
                  Number.isFinite(next) && next > 1 ? next : undefined
                );
              }}
              className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs tabular-nums text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-40 dark:border-studio-border dark:bg-studio-surface dark:text-slate-100"
            />
          </label>
          {multimeasureCount > 0 && (
            <button
              type="button"
              className={BTN_NEUTRAL}
              onClick={() => onSetMultimeasureRest?.(selectedMeasureIdx, undefined)}
            >
              Quitar
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className={BTN_NEUTRAL}
            onClick={() => onAutoConsolidateTacets?.()}
            disabled={!onAutoConsolidateTacets}
          >
            Consolidar todo
          </button>
          <button
            type="button"
            className={BTN_NEUTRAL}
            onClick={() => onClearAllTacets?.()}
            disabled={!onClearAllTacets}
          >
            Limpiar todo
          </button>
        </div>
      </Section>

      {/* Maquetacion */}
      <Section title="Maquetacion">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            aria-pressed={layoutMode === 'continuous'}
            className={toggleClass(layoutMode === 'continuous')}
            onClick={() => onSelectLayoutMode?.('continuous')}
            disabled={!onSelectLayoutMode}
          >
            Continuo
          </button>
          <button
            type="button"
            aria-pressed={layoutMode === 'paged'}
            className={toggleClass(layoutMode === 'paged')}
            onClick={() => onSelectLayoutMode?.('paged')}
            disabled={!onSelectLayoutMode}
          >
            Paginado
          </button>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Compases por sistema
          </span>
          <div className="grid grid-cols-6 gap-1" role="group" aria-label="Compases por sistema">
            {PER_SYSTEM_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={measuresPerSystem === count}
                className={`${toggleClass(measuresPerSystem === count)} px-0 font-mono tabular-nums`}
                onClick={() => onSetMeasuresPerSystem?.(count)}
                disabled={!onSetMeasuresPerSystem}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            aria-pressed={!!currentMeasure.systemBreak}
            className={toggleClass(!!currentMeasure.systemBreak)}
            onClick={() => onToggleSystemBreak?.(selectedMeasureIdx)}
            disabled={!onToggleSystemBreak}
          >
            Salto de sistema
          </button>
          <button
            type="button"
            aria-pressed={!!currentMeasure.pageBreak}
            className={toggleClass(!!currentMeasure.pageBreak)}
            onClick={() => onTogglePageBreak?.(selectedMeasureIdx)}
            disabled={!onTogglePageBreak}
          >
            Salto de pagina
          </button>
        </div>
      </Section>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title={isMultiSelection ? 'Eliminar compases seleccionados' : 'Eliminar compas'}
        description={
          isMultiSelection
            ? `Se eliminaran ${rangeCount} compases con todo su contenido en todos los pentagramas.`
            : `Se eliminara el compas ${selectedMeasureIdx + 1} con todo su contenido en todos los pentagramas.`
        }
        details={
          currentMeasure.items.length > 0 && !isMultiSelection
            ? [`${currentMeasure.items.length} elementos musicales se perderan.`]
            : undefined
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};

export default MeasureInspectorTab;
