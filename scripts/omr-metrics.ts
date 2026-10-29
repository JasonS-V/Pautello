import assert from 'node:assert/strict';
import type { Score, NoteDuration } from '../src/types/music';
import type { OmrScoreIR, OmrWarning } from '../src/omr/omrDecode';
import { checkReference, type MusicalReference, type ReferenceEvent } from './omr-reference-check';

export interface NormalizedEvalEvent {
  id: string;
  measureNumber: number;
  pitch: string | null;
  accidental: '#' | 'b' | 'n' | null;
  duration: [number, number];
  dots: number;
  tiedOut: boolean;
}

export interface AlignmentOperation {
  type: 'match' | 'substitution' | 'deletion' | 'insertion';
  refIndex?: number;
  predIndex?: number;
}

export interface SequenceEditMetrics {
  definition: string;
  denominator: string;
  sourceOfTruth: string;
  referenceCount: number;
  predictedCount: number;
  matches: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  matchRate: number;
  editErrorRate: number;
  operations: AlignmentOperation[];
}

export interface ComponentMetricSummary {
  definition: string;
  denominator: string;
  sourceOfTruth: string;
  matched: number;
  referenceTotal: number;
  predictedTotal: number;
  rate: number;
}

export interface OmrEvaluationReport {
  sampleId: string;
  referenceId: string;
  referenceStatus: 'reviewed' | 'draft';
  category: {
    clef: string;
    condition: string;
    sourceType: string;
    partition: string;
  };
  confidenceVsAccuracy: {
    ctcConfidencePercent: number | null;
    exactEventMatchRatePercent: number;
    pitchAndDurationMatchRatePercent: number;
    overconfidenceGapPercent: number | null;
    confidenceIsAccuracy: false;
    note: string;
  };
  tokens: SequenceEditMetrics | null;
  events: {
    exact: SequenceEditMetrics;
    pitchAndDuration: SequenceEditMetrics;
  };
  components: {
    pitch: ComponentMetricSummary;
    notePitchOnly: ComponentMetricSummary;
    exactDuration: ComponentMetricSummary;
    accidental: ComponentMetricSummary;
    printedAccidentalRecall: ComponentMetricSummary;
    barlineAndMeasure: ComponentMetricSummary & {
      measureCountRatio: number;
    };
    clef: ComponentMetricSummary;
    meter: ComponentMetricSummary;
    tempoFigure: ComponentMetricSummary & {
      numericCoincidenceCount: number;
    };
    relationships: ComponentMetricSummary & {
      precision: number;
    };
  };
  structure: {
    referenceSystems: number;
    detectedSystems: number;
    stavesPerSystemMatch: boolean;
    referenceParts: number;
    detectedParts: number;
    partIdentityMatch: boolean;
    referenceMeasures: number;
    detectedMeasures: number;
    missingMeasures: number;
    extraMeasures: number;
    navigationJumps: ComponentMetricSummary;
    silentStructuralLosses: number;
  };
  humanEffort: {
    pagesCount: number;
    estimatedEventEdits: number;
    estimatedMeasureEdits: number;
    estimatedAttributeAndDirectionEdits: number;
    totalEstimatedEdits: number;
    editsPerPage: number;
    observedReviewSeconds: number | null;
  };
  targets: {
    targetProfile: string;
    cleanEventMatchTarget: number;
    passedCleanEventTarget: boolean;
    passedZeroSilentStructuralLoss: boolean;
    passedPartIdentity: boolean;
    overallGatePassed: boolean;
  };
}

export interface AcceptanceTargets {
  cleanEventMatchRateMin: number;
  maxSilentStructuralLosses: number;
  partIdentityRateMin: number;
}

export const DEFAULT_ACCEPTANCE_TARGETS: AcceptanceTargets = {
  cleanEventMatchRateMin: 0.98,
  maxSilentStructuralLosses: 0,
  partIdentityRateMin: 1.0,
};

const DURATION_MAP: Record<NoteDuration, [number, number]> = {
  w: [1, 1],
  h: [1, 2],
  q: [1, 4],
  '8': [1, 8],
  '16': [1, 16],
  '32': [1, 32],
};

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function alignSequences<T>(
  reference: readonly T[],
  predicted: readonly T[],
  equals: (a: T, b: T) => boolean,
  meta: { definition: string; denominator: string; sourceOfTruth: string }
): SequenceEditMetrics {
  const n = reference.length;
  const m = predicted.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const matchDp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (equals(reference[i - 1], predicted[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1];
        matchDp[i][j] = matchDp[i - 1][j - 1] + 1;
      } else {
        const subCost = dp[i - 1][j - 1] + 1;
        const delCost = dp[i - 1][j] + 1;
        const insCost = dp[i][j - 1] + 1;
        const bestCost = Math.min(subCost, delCost, insCost);
        dp[i][j] = bestCost;
        let bestMatches = -1;
        if (subCost === bestCost) bestMatches = Math.max(bestMatches, matchDp[i - 1][j - 1]);
        if (delCost === bestCost) bestMatches = Math.max(bestMatches, matchDp[i - 1][j]);
        if (insCost === bestCost) bestMatches = Math.max(bestMatches, matchDp[i][j - 1]);
        matchDp[i][j] = bestMatches;
      }
    }
  }

  const operations: AlignmentOperation[] = [];
  let i = n;
  let j = m;
  let matches = 0;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      equals(reference[i - 1], predicted[j - 1]) &&
      dp[i][j] === dp[i - 1][j - 1] &&
      matchDp[i][j] === matchDp[i - 1][j - 1] + 1
    ) {
      operations.push({ type: 'match', refIndex: i - 1, predIndex: j - 1 });
      matches += 1;
      i -= 1;
      j -= 1;
    } else if (
      i > 0 &&
      j > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + 1 &&
      matchDp[i][j] === matchDp[i - 1][j - 1]
    ) {
      operations.push({ type: 'substitution', refIndex: i - 1, predIndex: j - 1 });
      substitutions += 1;
      i -= 1;
      j -= 1;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1 && matchDp[i][j] === matchDp[i - 1][j]) {
      operations.push({ type: 'deletion', refIndex: i - 1 });
      deletions += 1;
      i -= 1;
    } else {
      operations.push({ type: 'insertion', predIndex: j - 1 });
      insertions += 1;
      j -= 1;
    }
  }
  operations.reverse();

  const matchRate = n > 0 ? round4(matches / n) : m === 0 ? 1 : 0;
  const editErrorRate =
    n > 0 ? round4((substitutions + deletions + insertions) / n) : m === 0 ? 0 : 1;

  return {
    definition: meta.definition,
    denominator: meta.denominator,
    sourceOfTruth: meta.sourceOfTruth,
    referenceCount: n,
    predictedCount: m,
    matches,
    substitutions,
    deletions,
    insertions,
    matchRate,
    editErrorRate,
    operations,
  };
}

export function extractReferenceEvents(reference: MusicalReference): NormalizedEvalEvent[] {
  const list: NormalizedEvalEvent[] = [];
  for (const system of reference.systems) {
    for (const measure of system.measures) {
      for (const event of measure.events) {
        list.push({
          id: event.id,
          measureNumber: measure.number,
          pitch: event.pitch,
          accidental: event.accidental,
          duration: event.duration,
          dots: event.dots,
          tiedOut: Boolean(event.tieTo),
        });
      }
    }
  }
  return list;
}

export function extractScoreEvents(score: Score): NormalizedEvalEvent[] {
  const staff = score.staves[0];
  if (!staff) return [];
  const list: NormalizedEvalEvent[] = [];
  staff.measures.forEach((measure, measureIdx) => {
    for (const item of measure.items) {
      if ((item.voice ?? 1) !== 1) continue;
      const duration = DURATION_MAP[item.duration] ?? [1, 4];
      const dots = item.isDotted ? 1 : 0;
      if (item.type === 'rest' || !item.pitch) {
        list.push({
          id: item.id,
          measureNumber: measureIdx + 1,
          pitch: null,
          accidental: null,
          duration,
          dots,
          tiedOut: false,
        });
      } else {
        const pitch = `${item.pitch.step}${item.pitch.octave}`;
        const acc =
          item.pitch.accidental === '#' ||
          item.pitch.accidental === 'b' ||
          item.pitch.accidental === 'n'
            ? item.pitch.accidental
            : null;
        list.push({
          id: item.id,
          measureNumber: measureIdx + 1,
          pitch,
          accidental: acc,
          duration,
          dots,
          tiedOut: Boolean(item.isTied),
        });
      }
    }
  });
  return list;
}

function eventKeyExact(e: NormalizedEvalEvent): string {
  return `${e.pitch ?? 'rest'}|${e.accidental ?? ''}|${e.duration[0]}/${e.duration[1]}|d${e.dots}|t${e.tiedOut ? 1 : 0}`;
}

function eventKeyPitchDuration(e: NormalizedEvalEvent): string {
  return `${e.pitch ?? 'rest'}|${e.duration[0]}/${e.duration[1]}|d${e.dots}`;
}

function measureEventsSignature(events: readonly (ReferenceEvent | NormalizedEvalEvent)[]): string {
  return events
    .map(
      (e) =>
        `${e.pitch ?? 'rest'}:${e.accidental ?? ''}:${e.duration[0]}/${e.duration[1]}:${e.dots}`
    )
    .join(' ');
}

export function evaluateAgainstReference(params: {
  sampleId: string;
  reference: MusicalReference;
  score: Score;
  ir?: OmrScoreIR | null;
  warnings?: OmrWarning[];
  modelConfidence?: number | null;
  referenceTokens?: string[];
  predictedTokens?: string[];
  category?: {
    clef?: string;
    condition?: string;
    sourceType?: string;
    partition?: string;
  };
  pagesCount?: number;
  observedReviewSeconds?: number | null;
  allowDraft?: boolean;
  targets?: AcceptanceTargets;
}): OmrEvaluationReport {
  const refSummary = checkReference(params.reference);
  if (!params.allowDraft) {
    assert.equal(
      refSummary.status,
      'reviewed',
      `La referencia ${params.reference.id} debe estar aprobada ('reviewed') antes de calcular exactitud`
    );
  }

  const refEvents = extractReferenceEvents(params.reference);
  const predEvents = extractScoreEvents(params.score);
  const sourceOfTruth = params.reference.id;

  const exactEvents = alignSequences(
    refEvents,
    predEvents,
    (a, b) => eventKeyExact(a) === eventKeyExact(b),
    {
      definition:
        'Alineación Levenshtein de eventos exigiendo coincidencia simultánea de altura/silencio, alteración impresa, figura, puntillos y ligadura saliente.',
      denominator: 'Total de eventos de la referencia validada',
      sourceOfTruth,
    }
  );

  const pitchAndDurationEvents = alignSequences(
    refEvents,
    predEvents,
    (a, b) => eventKeyPitchDuration(a) === eventKeyPitchDuration(b),
    {
      definition:
        'Alineación Levenshtein de eventos exigiendo coincidencia de altura escrita (o silencio), figura y puntillos.',
      denominator: 'Total de eventos de la referencia validada',
      sourceOfTruth,
    }
  );

  const tokenMetrics =
    params.referenceTokens && params.predictedTokens
      ? alignSequences(params.referenceTokens, params.predictedTokens, (a, b) => a === b, {
          definition: 'Distancia de edición de tokens **kern respecto de la referencia.',
          denominator: 'Total de tokens de la referencia',
          sourceOfTruth,
        })
      : null;

  // Evaluar componentes sobre los pares alineados de pitchAndDurationEvents
  let pitchMatches = 0;
  let notePitchMatches = 0;
  let durationMatches = 0;
  let accidentalMatches = 0;
  let printedAccidentalMatches = 0;

  for (const op of pitchAndDurationEvents.operations) {
    if (op.refIndex === undefined || op.predIndex === undefined) continue;
    const r = refEvents[op.refIndex];
    const p = predEvents[op.predIndex];
    if (r.pitch === p.pitch) {
      pitchMatches += 1;
      if (r.pitch !== null) notePitchMatches += 1;
    }
    if (r.duration[0] === p.duration[0] && r.duration[1] === p.duration[1] && r.dots === p.dots) {
      durationMatches += 1;
    }
    if (r.pitch !== null && p.pitch !== null && r.accidental === p.accidental) {
      accidentalMatches += 1;
      if (r.accidental !== null) printedAccidentalMatches += 1;
    }
  }

  const refNotesCount = refEvents.filter((e) => e.pitch !== null).length;
  const predNotesCount = predEvents.filter((e) => e.pitch !== null).length;
  const refPrintedAccidentals = refEvents.filter(
    (e) => e.pitch !== null && e.accidental !== null
  ).length;
  const predPrintedAccidentals = predEvents.filter(
    (e) => e.pitch !== null && e.accidental !== null
  ).length;

  // Compases y barras
  const refMeasures = params.reference.systems.flatMap((s) => s.measures);
  const predMeasures = params.score.staves[0]?.measures ?? [];
  const refMeasureSigs = refMeasures.map((m) => measureEventsSignature(m.events));
  const predMeasureSigs = predMeasures.map((_, idx) =>
    measureEventsSignature(predEvents.filter((e) => e.measureNumber === idx + 1))
  );
  const measureAlignment = alignSequences(
    refMeasureSigs,
    predMeasureSigs,
    (a, b) => a === b && a.length > 0,
    {
      definition: 'Compases con secuencia exacta de eventos y límites de barra conservados.',
      denominator: 'Total de compases impresos en la referencia',
      sourceOfTruth,
    }
  );

  // Clave
  const expectedScoreClef =
    (params.reference as { clef?: string }).clef === 'F4'
      ? 'bass'
      : (params.reference as { clef?: string }).clef === 'G2'
        ? 'treble'
        : 'bass';
  const predictedClef = params.score.staves[0]?.clef ?? null;
  const clefMatched = predictedClef === expectedScoreClef ? 1 : 0;

  // Métricas locales
  const refMeters: string[] = [
    `${params.reference.timeSignature[0]}/${params.reference.timeSignature[1]}@1`,
  ];
  for (const m of refMeasures) {
    if (m.timeSignature) {
      refMeters.push(`${m.timeSignature[0]}/${m.timeSignature[1]}@${m.number}`);
    }
  }
  const predMeters: string[] = [
    `${params.score.timeSignature.beats}/${params.score.timeSignature.beatType}@1`,
  ];
  predMeasures.forEach((m, idx) => {
    if (m.timeSignatureChange) {
      predMeters.push(
        `${m.timeSignatureChange.beats}/${m.timeSignatureChange.beatType}@${idx + 1}`
      );
    }
  });
  const matchedMeters = refMeters.filter((rm) => predMeters.includes(rm)).length;

  // Tempo con figura vs coincidencia numérica
  const refTempoDirections = params.reference.directions.filter(
    (d) => d.kind === 'tempo' || d.kind === 'equivalence'
  );
  const unitToDuration = (unit?: readonly number[]): string | null => {
    if (!unit || unit.length < 2) return null;
    if (unit[0] === 1 && unit[1] === 1) return 'w';
    if (unit[0] === 1 && unit[1] === 2) return 'h';
    if (unit[0] === 1 && unit[1] === 4) return 'q';
    if (unit[0] === 1 && unit[1] === 8) return '8';
    if (unit[0] === 1 && unit[1] === 16) return '16';
    return null;
  };
  const predictedTempoFiguresCount = predMeasures.reduce(
    (count, m) => count + (m.metronomeMark ? 1 : 0) + (m.metricEquivalence ? 1 : 0),
    0
  );
  let tempoFigureMatched = 0;
  let numericTempoCoincidences = 0;
  for (const d of refTempoDirections as Array<{
    kind: string;
    measure: number;
    beatUnit?: number[];
    dots?: number;
    perMinute?: number;
    quarterBpm?: number;
    previousUnit?: number[];
    nextUnit?: number[];
    derivedQuarterBpm?: number;
  }>) {
    if (d.measure === 1 && d.quarterBpm === params.score.tempo) {
      numericTempoCoincidences += 1;
    }
    const predMeasure = predMeasures[d.measure - 1];
    if (!predMeasure) continue;
    if (d.kind === 'tempo' && predMeasure.metronomeMark) {
      const expectedBeatUnit = unitToDuration(d.beatUnit);
      const unitMatches =
        !expectedBeatUnit || predMeasure.metronomeMark.beatUnit === expectedBeatUnit;
      const dotsMatch = (predMeasure.metronomeMark.dots ?? 0) === (d.dots ?? 0);
      const bpmMatches =
        d.perMinute === undefined || predMeasure.metronomeMark.perMinute === d.perMinute;
      if (unitMatches && dotsMatch && bpmMatches) {
        tempoFigureMatched += 1;
      }
    } else if (d.kind === 'equivalence' && predMeasure.metricEquivalence) {
      const expectedPrev = unitToDuration(d.previousUnit);
      const expectedNext = unitToDuration(d.nextUnit);
      const prevMatches =
        !expectedPrev || predMeasure.metricEquivalence.previousUnit === expectedPrev;
      const nextMatches = !expectedNext || predMeasure.metricEquivalence.nextUnit === expectedNext;
      if (prevMatches && nextMatches) {
        tempoFigureMatched += 1;
      }
    }
  }

  // Relaciones (ligaduras válidas)
  const refTiesCount = refEvents.filter((e) => e.tiedOut).length;
  let validPredTies = 0;
  for (let idx = 0; idx < predEvents.length - 1; idx++) {
    const cur = predEvents[idx];
    const nxt = predEvents[idx + 1];
    if (cur.tiedOut && cur.pitch !== null && nxt.pitch === cur.pitch) {
      validPredTies += 1;
    }
  }
  let matchedTies = 0;
  for (const op of pitchAndDurationEvents.operations) {
    if (op.refIndex === undefined || op.predIndex === undefined) continue;
    const r = refEvents[op.refIndex];
    const p = predEvents[op.predIndex];
    if (r.tiedOut && p.tiedOut && r.pitch === p.pitch) {
      matchedTies += 1;
    }
  }

  // Estructura y navegación
  const refSystemsCount = params.reference.systems.length;
  const irLines = params.ir?.lines ?? [];
  const detectedSystemsCount =
    irLines.length > 0
      ? new Set(irLines.map((l) => `${l.staff.page}:${l.staff.system}`)).size
      : predMeasures.filter((m) => m.systemBreak).length + (predMeasures.length > 0 ? 1 : 0);
  const stavesPerSystemMatch =
    irLines.length > 0
      ? irLines.length === refSystemsCount
      : detectedSystemsCount === refSystemsCount;
  const detectedParts = params.score.staves.length;
  const partIdentityMatch = detectedParts === 1;

  const refNav = params.reference.directions.filter((d) =>
    ['segno', 'to-coda', 'ds-al-coda', 'coda'].includes(d.kind)
  );
  const normalizeNavKind = (mark?: string | null): string | null => {
    if (!mark) return null;
    if (mark === 'toCoda') return 'to-coda';
    if (mark === 'dalSegnoAlCoda') return 'ds-al-coda';
    return mark;
  };
  const predNav = predMeasures.flatMap((m, idx) => {
    const k = normalizeNavKind(m.navigationMark);
    return k ? [`${k}@${idx + 1}`] : [];
  });
  const matchedNav = refNav.filter((d) =>
    predNav.includes(`${d.kind}@${(d as { measure: number }).measure}`)
  ).length;

  let matchedOtherDirections = 0;
  for (const d of params.reference.directions as Array<{
    kind: string;
    measure: number;
    text?: string;
    value?: number[];
    glyph?: string;
  }>) {
    if (
      ['tempo', 'equivalence', 'segno', 'to-coda', 'ds-al-coda', 'coda'].includes(d.kind)
    ) {
      continue;
    }
    const predMeasure = predMeasures[d.measure - 1];
    if (!predMeasure) continue;
    if (d.kind === 'style' && predMeasure.tempoText) {
      if (!d.text || predMeasure.tempoText.trim() === d.text.trim()) {
        matchedOtherDirections += 1;
      }
    } else if (d.kind === 'rehearsal' && predMeasure.rehearsalMark) {
      if (!d.text || predMeasure.rehearsalMark.trim() === d.text.trim()) {
        matchedOtherDirections += 1;
      }
    } else if (d.kind === 'fermata') {
      if (predMeasure.items.some((item) => item.articulation === 'fermata')) {
        matchedOtherDirections += 1;
      }
    } else if (d.kind === 'meter' && predMeasure.timeSignatureChange) {
      const valueMatches =
        !d.value ||
        (predMeasure.timeSignatureChange.beats === d.value[0] &&
          predMeasure.timeSignatureChange.beatType === d.value[1]);
      const glyphMatches = !d.glyph || (d.glyph === 'C' && predMeasure.meterGlyph === 'common');
      if (valueMatches && glyphMatches) {
        matchedOtherDirections += 1;
      }
    }
  }

  const missingMeasures = Math.max(0, refMeasures.length - predMeasures.length);
  const extraMeasures = Math.max(0, predMeasures.length - refMeasures.length);
  const warningCount = params.warnings?.length ?? params.ir?.warnings.length ?? 0;
  const unwarnedMissingSystems =
    detectedSystemsCount < refSystemsCount && warningCount === 0
      ? refSystemsCount - detectedSystemsCount
      : 0;
  const silentStructuralLosses = unwarnedMissingSystems + (detectedParts === 0 ? 1 : 0);

  // Coste humano estimado
  const pagesCount = Math.max(1, params.pagesCount ?? 1);
  const estimatedEventEdits =
    exactEvents.substitutions + exactEvents.deletions + exactEvents.insertions;
  const estimatedMeasureEdits = Math.abs(refMeasures.length - predMeasures.length);
  const missingDirections =
    params.reference.directions.length - matchedNav - tempoFigureMatched - matchedOtherDirections;
  const missingMeters = Math.max(0, refMeters.length - matchedMeters);
  const estimatedAttributeAndDirectionEdits =
    1 - clefMatched + missingMeters + Math.max(0, missingDirections);
  const totalEstimatedEdits =
    estimatedEventEdits + estimatedMeasureEdits + estimatedAttributeAndDirectionEdits;

  const targets = params.targets ?? DEFAULT_ACCEPTANCE_TARGETS;
  const passedCleanEventTarget = exactEvents.matchRate >= targets.cleanEventMatchRateMin;
  const passedZeroSilentStructuralLoss =
    silentStructuralLosses <= targets.maxSilentStructuralLosses;
  const passedPartIdentity = (partIdentityMatch ? 1 : 0) >= targets.partIdentityRateMin;

  const exactPct = round4(exactEvents.matchRate * 100);
  const pdPct = round4(pitchAndDurationEvents.matchRate * 100);
  const ctcPct = typeof params.modelConfidence === 'number' ? round4(params.modelConfidence) : null;

  return {
    sampleId: params.sampleId,
    referenceId: params.reference.id,
    referenceStatus: refSummary.status as 'reviewed' | 'draft',
    category: {
      clef: params.category?.clef ?? (params.reference as { clef?: string }).clef ?? 'unknown',
      condition: params.category?.condition ?? 'clean',
      sourceType: params.category?.sourceType ?? 'image',
      partition: params.category?.partition ?? 'validation',
    },
    confidenceVsAccuracy: {
      ctcConfidencePercent: ctcPct,
      exactEventMatchRatePercent: exactPct,
      pitchAndDurationMatchRatePercent: pdPct,
      overconfidenceGapPercent: ctcPct !== null ? round4(ctcPct - exactPct) : null,
      confidenceIsAccuracy: false,
      note: 'La confianza interna CTC refleja probabilidades de logits sobre tokens emitidos; nunca mide exactitud frente a la referencia validada.',
    },
    tokens: tokenMetrics,
    events: {
      exact: exactEvents,
      pitchAndDuration: pitchAndDurationEvents,
    },
    components: {
      pitch: {
        definition:
          'Eventos alineados cuya altura escrita (o silencio) coincide con la referencia.',
        denominator: 'Total de eventos de la referencia',
        sourceOfTruth,
        matched: pitchMatches,
        referenceTotal: refEvents.length,
        predictedTotal: predEvents.length,
        rate: refEvents.length > 0 ? round4(pitchMatches / refEvents.length) : 1,
      },
      notePitchOnly: {
        definition:
          'Notas alineadas cuya altura escrita (paso y octava) coincide con la referencia.',
        denominator: 'Total de notas de la referencia',
        sourceOfTruth,
        matched: notePitchMatches,
        referenceTotal: refNotesCount,
        predictedTotal: predNotesCount,
        rate: refNotesCount > 0 ? round4(notePitchMatches / refNotesCount) : 1,
      },
      exactDuration: {
        definition: 'Eventos alineados con la misma fracción rítmica y número de puntillos.',
        denominator: 'Total de eventos de la referencia',
        sourceOfTruth,
        matched: durationMatches,
        referenceTotal: refEvents.length,
        predictedTotal: predEvents.length,
        rate: refEvents.length > 0 ? round4(durationMatches / refEvents.length) : 1,
      },
      accidental: {
        definition: 'Notas alineadas cuyo estado de alteración (#, b, n o ninguna) coincide.',
        denominator: 'Total de notas de la referencia',
        sourceOfTruth,
        matched: accidentalMatches,
        referenceTotal: refNotesCount,
        predictedTotal: predNotesCount,
        rate: refNotesCount > 0 ? round4(accidentalMatches / refNotesCount) : 1,
      },
      printedAccidentalRecall: {
        definition: 'Notas con alteración explícita impresa en la fuente que fueron conservadas.',
        denominator: 'Total de notas con alteración impresa en la referencia',
        sourceOfTruth,
        matched: printedAccidentalMatches,
        referenceTotal: refPrintedAccidentals,
        predictedTotal: predPrintedAccidentals,
        rate:
          refPrintedAccidentals > 0 ? round4(printedAccidentalMatches / refPrintedAccidentals) : 1,
      },
      barlineAndMeasure: {
        definition: 'Compases cuyo contenido y límites coinciden exactamente con la referencia.',
        denominator: 'Total de compases de la referencia',
        sourceOfTruth,
        matched: measureAlignment.matches,
        referenceTotal: refMeasures.length,
        predictedTotal: predMeasures.length,
        rate: measureAlignment.matchRate,
        measureCountRatio:
          refMeasures.length > 0 ? round4(predMeasures.length / refMeasures.length) : 1,
      },
      clef: {
        definition: 'Coincidencia de la clave principal de la parte respecto de la referencia.',
        denominator: 'Partes de la referencia (1)',
        sourceOfTruth,
        matched: clefMatched,
        referenceTotal: 1,
        predictedTotal: detectedParts,
        rate: clefMatched,
      },
      meter: {
        definition: 'Métrica inicial y cambios locales de compás reconocidos en su posición.',
        denominator: 'Total de estados de compás en la referencia',
        sourceOfTruth,
        matched: matchedMeters,
        referenceTotal: refMeters.length,
        predictedTotal: predMeters.length,
        rate: refMeters.length > 0 ? round4(matchedMeters / refMeters.length) : 1,
      },
      tempoFigure: {
        definition:
          'Marcas metronómicas y equivalencias reconocidas con su figura musical y anclaje (no por simple valor numérico por defecto).',
        denominator: 'Total de marcas de tempo y equivalencia en la referencia',
        sourceOfTruth,
        matched: tempoFigureMatched,
        referenceTotal: refTempoDirections.length,
        predictedTotal: predictedTempoFiguresCount,
        rate:
          refTempoDirections.length > 0
            ? round4(tempoFigureMatched / refTempoDirections.length)
            : 1,
        numericCoincidenceCount: numericTempoCoincidences,
      },
      relationships: {
        definition: 'Ligaduras de prolongación válidas entre notas consecutivas de igual altura.',
        denominator: 'Total de ligaduras en la referencia',
        sourceOfTruth,
        matched: matchedTies,
        referenceTotal: refTiesCount,
        predictedTotal: validPredTies,
        rate: refTiesCount > 0 ? round4(matchedTies / refTiesCount) : 1,
        precision: validPredTies > 0 ? round4(matchedTies / validPredTies) : 1,
      },
    },
    structure: {
      referenceSystems: refSystemsCount,
      detectedSystems: detectedSystemsCount,
      stavesPerSystemMatch,
      referenceParts: 1,
      detectedParts,
      partIdentityMatch,
      referenceMeasures: refMeasures.length,
      detectedMeasures: predMeasures.length,
      missingMeasures,
      extraMeasures,
      navigationJumps: {
        definition: 'Marcas de navegación (Segno, To Coda, D.S. al Coda, Coda) reconocidas.',
        denominator: 'Total de marcas de navegación en la referencia',
        sourceOfTruth,
        matched: matchedNav,
        referenceTotal: refNav.length,
        predictedTotal: predNav.length,
        rate: refNav.length > 0 ? round4(matchedNav / refNav.length) : 1,
      },
      silentStructuralLosses,
    },
    humanEffort: {
      pagesCount,
      estimatedEventEdits,
      estimatedMeasureEdits,
      estimatedAttributeAndDirectionEdits,
      totalEstimatedEdits,
      editsPerPage: round4(totalEstimatedEdits / pagesCount),
      observedReviewSeconds: params.observedReviewSeconds ?? null,
    },
    targets: {
      targetProfile: 'clean-printed-single-part-v1',
      cleanEventMatchTarget: targets.cleanEventMatchRateMin,
      passedCleanEventTarget,
      passedZeroSilentStructuralLoss,
      passedPartIdentity,
      overallGatePassed:
        passedCleanEventTarget && passedZeroSilentStructuralLoss && passedPartIdentity,
    },
  };
}

export interface CategoryAggregateSummary {
  dimension: 'clef' | 'condition' | 'sourceType' | 'partition';
  bucket: string;
  samplesCount: number;
  meanExactEventMatchRate: number;
  worstExactEventMatchRate: number;
  worstSampleId: string;
  meanEditErrorRate: number;
  worstEditErrorRate: number;
  meanEditsPerPage: number;
  worstEditsPerPage: number;
}

export function aggregateMetricsByCategory(
  reports: readonly OmrEvaluationReport[]
): CategoryAggregateSummary[] {
  assert(reports.length > 0, 'Se requiere al menos un informe para agregar por categoría');
  const dimensions: Array<'clef' | 'condition' | 'sourceType' | 'partition'> = [
    'clef',
    'condition',
    'sourceType',
    'partition',
  ];
  const summaries: CategoryAggregateSummary[] = [];

  for (const dim of dimensions) {
    const groups = new Map<string, OmrEvaluationReport[]>();
    for (const report of reports) {
      const key = report.category[dim];
      const bucket = groups.get(key) ?? [];
      bucket.push(report);
      groups.set(key, bucket);
    }

    for (const [bucket, items] of groups.entries()) {
      const sortedByWorst = [...items].sort(
        (a, b) =>
          a.events.exact.matchRate - b.events.exact.matchRate ||
          b.events.exact.editErrorRate - a.events.exact.editErrorRate
      );
      const worst = sortedByWorst[0];
      const meanMatch = items.reduce((acc, r) => acc + r.events.exact.matchRate, 0) / items.length;
      const meanErr =
        items.reduce((acc, r) => acc + r.events.exact.editErrorRate, 0) / items.length;
      const meanEdits =
        items.reduce((acc, r) => acc + r.humanEffort.editsPerPage, 0) / items.length;
      const worstEdits = Math.max(...items.map((r) => r.humanEffort.editsPerPage));

      summaries.push({
        dimension: dim,
        bucket,
        samplesCount: items.length,
        meanExactEventMatchRate: round4(meanMatch),
        worstExactEventMatchRate: worst.events.exact.matchRate,
        worstSampleId: worst.sampleId,
        meanEditErrorRate: round4(meanErr),
        worstEditErrorRate: Math.max(...items.map((r) => r.events.exact.editErrorRate)),
        meanEditsPerPage: round4(meanEdits),
        worstEditsPerPage: round4(worstEdits),
      });
    }
  }

  return summaries;
}
