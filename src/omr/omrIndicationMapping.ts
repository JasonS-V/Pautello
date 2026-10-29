import type { Score } from '../types/music';
import type { OmrScoreIR } from './omrDecode';

export interface OmrIndicationPlan {
  id: string;
  status: 'exact' | 'suggested' | 'pending';
  staffId: string | null;
  measureId: string | null;
  reason: string;
}

const centerX = (box: [number, number, number, number]) => box[0] + box[2] / 2;

export function planOmrIndications(ir: OmrScoreIR, score: Score): OmrIndicationPlan[] {
  return (ir.indications ?? []).map((indication) => {
    const pending = (reason: string): OmrIndicationPlan => ({
      id: indication.id,
      status: 'pending',
      staffId: null,
      measureId: null,
      reason,
    });
    if (indication.status !== 'recognized' || !indication.anchor)
      return pending('La lectura o el compás de origen requieren revisión.');
    if (indication.kind === 'symbol' || indication.kind === 'style')
      return pending('Esta indicación no tiene un campo editable equivalente.');
    const x = indication.anchor.x;
    const candidates = ir.parts
      .flatMap((part, partIndex) =>
        part.measures.flatMap((measure, index) => {
          if (measure.page !== indication.src.page || measure.system !== indication.anchor!.system)
            return [];
          const positions = measure.events
            .map((event) => event.src?.bbox)
            .filter((box): box is [number, number, number, number] => Boolean(box));
          if (!positions.length) return [];
          return [
            {
              partIndex,
              index,
              distance: Math.min(...positions.map((box) => Math.abs(centerX(box) - x))),
            },
          ];
        })
      )
      .sort((a, b) => a.distance - b.distance);
    const candidate = candidates[0];
    const staff = candidate && score.staves[candidate.partIndex];
    const measure = staff?.measures[candidate.index];
    if (!candidate || !staff || !measure)
      return pending('No hay un compás editable en la región de origen.');
    if (
      indication.kind === 'fermata' &&
      indication.target?.kind === 'rest' &&
      measure.items.filter((item) => item.type === 'rest').length !== 1
    )
      return pending('Hay varios silencios posibles; el calderón requiere seleccionar el evento.');
    const exact = indication.anchor.measureNumber === candidate.index + 1;
    return {
      id: indication.id,
      status: exact ? 'exact' : 'suggested',
      staffId: staff.id,
      measureId: measure.id,
      reason: exact
        ? 'La numeración y la región coinciden.'
        : 'La numeración impresa y los compases leídos difieren; confirmar en la fuente.',
    };
  });
}

export function applyOmrIndications(
  original: Score,
  ir: OmrScoreIR,
  plans: OmrIndicationPlan[],
  acceptedIds: string[] = []
): Score {
  const score = structuredClone(original);
  const selected = new Set(acceptedIds);
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const applied = new Set<string>();
  for (const indication of ir.indications ?? []) {
    const plan = planById.get(indication.id);
    if (!plan || !plan.measureId || (plan.status !== 'exact' && !selected.has(plan.id))) continue;
    const staff = score.staves.find((entry) => entry.id === plan.staffId);
    const measure = staff?.measures.find((entry) => entry.id === plan.measureId);
    if (!measure) continue;
    if (plan.status === 'exact' && indication.anchor?.measureNumber)
      measure.printedNumber = indication.anchor.measureNumber;
    if (indication.kind === 'tempo' && indication.tempo?.beatUnit && indication.tempo.quarterBpm) {
      const mark = {
        beatUnit: indication.tempo.beatUnit,
        dots: indication.tempo.dots,
        perMinute: indication.tempo.perMinute,
      };
      measure.metronomeMark = mark;
      measure.tempoBpm = indication.tempo.quarterBpm;
      if (staff?.measures[0] === measure) {
        score.metronomeMark = mark;
        score.tempo = indication.tempo.quarterBpm;
      }
    } else if (indication.kind === 'meter' && indication.meter) {
      const time = { beats: indication.meter.beats, beatType: indication.meter.beatType };
      measure.timeSignatureChange = time;
      if (indication.meter.glyph === 'common') measure.meterGlyph = 'common';
      if (staff?.measures[0] === measure) {
        score.timeSignature = time;
        if (indication.meter.glyph === 'common') score.meterGlyph = 'common';
      }
    } else if (
      indication.kind === 'equivalence' &&
      indication.equivalence?.previousUnit &&
      indication.equivalence.nextUnit
    ) {
      const e = indication.equivalence;
      measure.metricEquivalence = {
        previousUnit: e.previousUnit!,
        previousDots: e.previousDots,
        nextUnit: e.nextUnit!,
        nextDots: e.nextDots,
      };
      if (e.derivedQuarterBpm) measure.tempoBpm = e.derivedQuarterBpm;
    } else if (indication.kind === 'rehearsal' && indication.text) {
      measure.rehearsalMark = indication.text;
    } else if (indication.kind === 'navigation' && indication.navigation) {
      measure.navigationMark = indication.navigation;
    } else if (indication.kind === 'fermata' && indication.target?.kind === 'rest') {
      const rests = measure.items.filter((item) => item.type === 'rest');
      if (rests.length === 1) rests[0].articulation = 'fermata';
      else continue;
    } else continue;
    applied.add(indication.id);
  }
  linkOmrNavigationTargets(score, ir, plans, [...selected, ...applied]);
  return score;
}

export function linkOmrNavigationTargets(
  score: Score,
  ir: OmrScoreIR,
  plans: OmrIndicationPlan[],
  acceptedIds: string[]
): void {
  const selected = new Set(acceptedIds);
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const active = (id: string) => {
    const plan = planById.get(id);
    return plan?.measureId && (plan.status === 'exact' || selected.has(id));
  };
  for (const indication of ir.indications ?? []) {
    if (!indication.navigation || !active(indication.id)) continue;
    const plan = planById.get(indication.id);
    const measure = score.staves
      .find((staff) => staff.id === plan?.staffId)
      ?.measures.find((entry) => entry.id === plan?.measureId);
    if (!measure) continue;
    if (indication.targetId && active(indication.targetId))
      measure.navigationTargetMeasureId = planById.get(indication.targetId)?.measureId ?? undefined;
    if (indication.codaExitId && active(indication.codaExitId))
      measure.navigationExitMeasureId = planById.get(indication.codaExitId)?.measureId ?? undefined;
  }
}
