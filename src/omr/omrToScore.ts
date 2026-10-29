import {
  Accidental,
  BarlineType,
  Clef,
  KeySignature,
  Measure,
  NoteDuration,
  Pitch,
  Score,
  ScoreItem,
  Staff,
  TimeSignature,
  TupletInfo,
} from '../types/music';
import { getItemBeats, pitchToMidi } from '../constants/pitches';
import { beatsFromTimeSignature, getMeasureTimings } from '../utils/measureTiming';
import { detectKeyFromScore } from '../utils/keyDetection';
import { normalizeScore } from '../utils/scoreSchema';
import {
  applyOmrIndications,
  planOmrIndications,
  type OmrIndicationPlan,
} from './omrIndicationMapping';
import {
  OmrClefIR,
  OmrDurationIR,
  OmrPitchIR,
  OmrScoreIR,
  OmrSourceSpan,
  OmrWarning,
} from './omrDecode';

export interface OmrMetadataHints {
  title?: string;
  subtitle?: string;
  composer?: string;
  arranger?: string;
  partName?: string;
  copyright?: string;
  level?: string;
  collection?: string;
  dedication?: string;
  editorialKey?: string;
  lyricist?: string;
  tempo?: number;
  keySignature?: KeySignature;
  timeSignature?: TimeSignature;
  genre?: string;
  fullText?: string;
  lyrics?: string[];
  chords?: string[];
}

export interface OmrConversionSummary {
  score: Score;
  indicationPlans: OmrIndicationPlan[];
  metadataHints: OmrMetadataHints;
  warnings: OmrWarning[];
  proposals: OmrMeasureProposal[];
  report: {
    sourceEvents: number;
    representedEvents: number;
    pendingEvents: number;
    unparseableRecords: number;
  };
  sourceLinks: OmrSourceLink[];
  averageConfidence: number;
  measuresCount: number;
  notesCount: number;
  stavesCount: number;
}

export interface OmrMeasureProposal {
  staffId: string;
  measureId: string;
  reason: string;
  replacement: Measure[];
}

export interface OmrSourceLink {
  sourcePart: number;
  sourceMeasure: number;
  sourceEvent: number;
  src?: OmrSourceSpan;
  staffId: string | null;
  measureId: string | null;
  itemId: string;
}

const FIFTHS_TO_MAJOR: Readonly<Record<number, KeySignature>> = {
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
  [-1]: 'F',
  [-2]: 'Bb',
  [-3]: 'Eb',
  [-4]: 'Ab',
  [-5]: 'Db',
  [-6]: 'Gb',
  [-7]: 'Cb',
};

function mapDuration(dur: OmrDurationIR): {
  duration: NoteDuration;
  isDotted?: boolean;
  tuplet?: TupletInfo;
} {
  const isDotted = dur.dots > 0 ? true : undefined;
  switch (dur.base) {
    case '0':
    case '1':
      return { duration: 'w', isDotted };
    case '2':
      return { duration: 'h', isDotted };
    case '4':
      return { duration: 'q', isDotted };
    case '8':
      return { duration: '8', isDotted };
    case '16':
      return { duration: '16', isDotted };
    case '32':
      return { duration: '32', isDotted };
    case '3':
      return { duration: 'h', isDotted, tuplet: { actual: 3, normal: 2 } };
    case '6':
      return { duration: 'q', isDotted, tuplet: { actual: 3, normal: 2 } };
    case '12':
      return { duration: '8', isDotted, tuplet: { actual: 3, normal: 2 } };
    case '24':
      return { duration: '16', isDotted, tuplet: { actual: 3, normal: 2 } };
    default:
      return { duration: 'q', isDotted };
  }
}

function mapPitch(p: OmrPitchIR): Pitch {
  let accidental: Accidental = null;
  if (p.rawToken === '##' || p.alter === 2) accidental = '##';
  else if (p.rawToken === '--' || p.alter === -2) accidental = 'bb';
  else if (p.rawToken === '#' || p.alter === 1) accidental = '#';
  else if (p.rawToken === '-' || p.alter === -1) accidental = 'b';
  else if (p.rawToken === 'n') accidental = 'n';

  return {
    step: p.step,
    octave: p.octave,
    accidental,
  };
}

function mapClef(clefIr: OmrClefIR | undefined, clefStr: string | null | undefined): Clef | null {
  if (clefIr) {
    const s = clefIr.sign.toUpperCase();
    if (s === 'F') return 'bass';
    if (s === 'C') return 'alto';
    if (s === 'G') return 'treble';
  }
  if (clefStr) {
    const upper = clefStr.toUpperCase();
    if (upper.startsWith('F')) return 'bass';
    if (upper.startsWith('C')) return 'alto';
    if (upper.startsWith('G')) return 'treble';
  }
  return null;
}

function inferClefFromItems(measures: Measure[]): Clef {
  const midis: number[] = [];
  for (const m of measures) {
    for (const it of m.items) {
      if (it.type === 'note' && it.pitch) {
        midis.push(pitchToMidi(it.pitch));
      }
    }
  }
  if (midis.length === 0) return 'treble';
  midis.sort((a, b) => a - b);
  const median = midis[Math.floor(midis.length / 2)];
  // Do central (C4) es MIDI 60. El registro de clave de Fa se centra en Re3 (50) y Sol2 (43).
  // El registro solo aporta una sugerencia, nunca sustituye la clave observada.
  return median <= 60 ? 'bass' : 'treble';
}

function itemDurationToBeats(item: {
  duration: NoteDuration;
  isDotted?: boolean;
  tuplet?: TupletInfo;
}): number {
  return getItemBeats(item.duration, item.isDotted, item.tuplet);
}

/** Solo produce una alternativa; el reconocimiento conserva los compases observados. */
export function reconcileMeasuresForTimeSignature(
  rawMeasures: Measure[],
  timeSignature: TimeSignature
): Measure[] {
  let localTime = timeSignature;
  return rawMeasures.flatMap((measure) => {
    localTime = measure.timeSignatureChange ?? localTime;
    const capacity = beatsFromTimeSignature(localTime);
    if (measure.isAnacrusis || measure.items.some((item) => item.voice === 2)) return [measure];
    const groups: ScoreItem[][] = [];
    let batch: ScoreItem[] = [];
    let beats = 0;
    for (const item of measure.items) {
      beats += itemDurationToBeats(item);
      if (beats > capacity + 1e-6) return [measure];
      batch.push(item);
      if (Math.abs(beats - capacity) < 1e-6) {
        groups.push(batch);
        batch = [];
        beats = 0;
      }
    }
    if (batch.length || groups.length < 2) return [measure];
    const {
      barline,
      repeatEnd,
      repeatCount,
      systemBreak,
      pageBreak,
      navigationMark,
      caesura,
      breathMark,
      ...start
    } = measure;
    return groups.map((items, i) => ({
      ...(i === 0
        ? {
            ...start,
            navigationMark:
              navigationMark === 'segno' || navigationMark === 'coda' ? navigationMark : undefined,
          }
        : {}),
      ...(i === groups.length - 1
        ? {
            barline,
            repeatEnd,
            repeatCount,
            systemBreak,
            pageBreak,
            navigationMark:
              navigationMark === 'segno' || navigationMark === 'coda' ? undefined : navigationMark,
            caesura,
            breathMark,
          }
        : {}),
      id: `${measure.id}-s${i}`,
      items,
    }));
  });
}

export function inspectOmrMeasures(
  score: Score,
  sourceLinks: OmrSourceLink[] = []
): { warnings: OmrWarning[]; proposals: OmrMeasureProposal[] } {
  const warnings: OmrWarning[] = [];
  const proposals: OmrMeasureProposal[] = [];
  for (const staff of score.staves) {
    const timings = getMeasureTimings({ ...score, staves: [staff] });
    staff.measures.forEach((measure, mIdx) => {
      if (measure.items.some((item) => item.id.startsWith('omr-empty-rest-'))) return;
      const found = measure.items.reduce((sum, item) => sum + itemDurationToBeats(item), 0);
      const expected = timings[mIdx].beatsPerMeasure;
      if (Math.abs(found - expected) < 1e-6) return;
      const src = sourceLinks.find((link) => link.measureId === measure.id)?.src;
      warnings.push({
        code: found > expected ? 'measure-overfull' : 'measure-underfull',
        severity: 'warning',
        provenance: 'observed',
        src,
        page: src?.page,
        system: src?.system,
        staff: src?.staff,
        found,
        expected,
        message: `Compás ${mIdx + 1}: ${found} tiempos leídos de ${expected}; se conserva sin completar ni dividir.`,
      });
      const replacement = reconcileMeasuresForTimeSignature([measure], timings[mIdx].timeSignature);
      if (replacement.length > 1)
        proposals.push({
          staffId: staff.id,
          measureId: measure.id,
          replacement,
          reason: `Los ${found} tiempos admiten ${replacement.length} grupos exactos de ${expected}; posible barra omitida, requiere revisión visual.`,
        });
    });
  }

  return { warnings, proposals };
}

export function applyOmrMeasureProposals(score: Score, selectedMeasureIds: string[]): Score {
  const selected = new Set(selectedMeasureIds);
  const proposals = new Map(
    inspectOmrMeasures(score).proposals.map((proposal) => [proposal.measureId, proposal])
  );
  return {
    ...score,
    staves: score.staves.map((staff) => ({
      ...staff,
      measures: staff.measures.flatMap((measure) =>
        selected.has(measure.id) ? (proposals.get(measure.id)?.replacement ?? [measure]) : [measure]
      ),
    })),
  };
}

export function refreshOmrSourceLinks(score: Score, links: OmrSourceLink[]): OmrSourceLink[] {
  const targets = new Map<string, { staffId: string; measureId: string }>();
  for (const staff of score.staves)
    for (const measure of staff.measures)
      for (const item of measure.items) {
        targets.set(item.id, { staffId: staff.id, measureId: measure.id });
      }
  return links.map((link) => ({
    ...link,
    staffId: targets.get(link.itemId)?.staffId ?? null,
    measureId: targets.get(link.itemId)?.measureId ?? null,
  }));
}

/**
 * Convierte la representación intermedia `OmrScoreIR` en un objeto `Score` de Pautello.
 */
export function convertOmrIrToScore(
  ir: OmrScoreIR,
  hints: OmrMetadataHints = {}
): OmrConversionSummary {
  const confidences: number[] = [];
  let notesCount = 0;
  const warnings: OmrWarning[] = [];
  const rawTime = ir.structure.recognized.time;
  const validTime =
    rawTime && rawTime.num >= 1 && rawTime.num <= 16 && [2, 4, 8, 16].includes(rawTime.den);
  const timeSignature: TimeSignature = validTime
    ? { beats: rawTime.num, beatType: rawTime.den }
    : (hints.timeSignature ?? { beats: 4, beatType: 4 });
  const recognizedFifths = ir.structure.recognized.keyFifths;
  const recognizedKey = recognizedFifths !== null ? FIFTHS_TO_MAJOR[recognizedFifths] : undefined;
  const initialKey = recognizedKey ?? hints.keySignature ?? 'C';
  if (
    (validTime &&
      hints.timeSignature &&
      (rawTime.num !== hints.timeSignature.beats ||
        rawTime.den !== hints.timeSignature.beatType)) ||
    (recognizedKey && hints.keySignature && recognizedKey !== hints.keySignature)
  ) {
    warnings.push({
      code: 'metadata-conflict',
      severity: 'warning',
      provenance: 'inferred',
      message:
        'Las pistas editoriales discrepan de atributos leídos; se conservan la métrica y armadura observadas.',
    });
  }
  if (!validTime)
    warnings.push({
      code: 'estimated-time',
      severity: 'warning',
      provenance: 'inferred',
      message: `Métrica no reconocida: se usa ${timeSignature.beats}/${timeSignature.beatType} como valor provisional.`,
    });
  if (!recognizedKey)
    warnings.push({
      code: 'estimated-key',
      severity: 'warning',
      provenance: 'inferred',
      message: `Armadura no reconocida: se usa ${initialKey} como valor provisional.`,
    });
  if (!hints.tempo)
    warnings.push({
      code: 'estimated-tempo',
      severity: 'warning',
      provenance: 'inferred',
      message: 'Tempo no reconocido: se usa negra = 120 como valor provisional.',
    });

  if (hints.lyrics?.length || hints.chords?.length)
    warnings.push({
      code: 'unanchored-text',
      severity: 'warning',
      provenance: 'unsupported',
      message:
        'Texto/cifrado sin anclaje temporal: conservado en las pistas editoriales para revisión, sin asignarlo a notas por su orden.',
    });

  const staves: Staff[] = ir.parts.map((part, pIdx) => {
    const firstClef = part.measures.find((m) => m.attributes?.clef)?.attributes?.clef;
    const explicitClef = mapClef(firstClef, ir.structure.recognized.clefs[pIdx]);
    let carryRepeatStart = false;

    const rawMeasures: Measure[] = part.measures.map((mIr, mIdx) => {
      const localClef = mIr.attributes?.clef;
      if (
        localClef &&
        (localClef.octaveChange !== 0 ||
          !(
            (localClef.sign === 'G' && localClef.line === 2) ||
            (localClef.sign === 'F' && localClef.line === 4) ||
            (localClef.sign === 'C' && localClef.line === 3)
          ) ||
          (mIdx > 0 && mapClef(localClef, null) !== explicitClef))
      ) {
        warnings.push({
          code: 'unsupported-clef-change',
          severity: 'warning',
          provenance: 'unsupported',
          src: mIr.attributeEvents?.find((e) => e.clef)?.src,
          message:
            'La clave local, su línea u octavación no se puede representar fielmente; se conserva en el IR.',
        });
      }
      const items: ScoreItem[] = mIr.events.flatMap((ev, evIdx): ScoreItem[] => {
        const pitches = ev.pitches?.length ? ev.pitches : ev.pitch ? [ev.pitch] : [];
        const unsupported =
          !['1', '2', '4', '8', '16', '32', '3', '6', '12', '24'].includes(ev.duration.base) ||
          ev.duration.dots > 1 ||
          ev.duration.dots < 0 ||
          (ev.kind === 'note' &&
            (!pitches.length ||
              pitches.some(
                (p) =>
                  p.octave < 1 ||
                  p.octave > 7 ||
                  !Number.isInteger(p.octave) ||
                  !'CDEFGAB'.includes(p.step) ||
                  !Number.isInteger(p.alter) ||
                  Math.abs(p.alter) > 2
              )));
        if (unsupported) {
          warnings.push({
            code: 'unsupported-event',
            severity: 'error',
            provenance: 'unsupported',
            src: ev.src,
            tokens: ev.tokens,
            message:
              'Evento pendiente: altura o duración no representable sin pérdida; se conserva en el IR y no se sustituye por otra nota.',
          });
          return [];
        }
        confidences.push(ev.confidence);
        const { duration, isDotted, tuplet } = mapDuration(ev.duration);

        if (ev.kind === 'rest') {
          return [
            {
              id: `omr-rest-${pIdx}-${mIdx}-${evIdx}`,
              type: 'rest',
              duration,
              isDotted,
              tuplet,
              articulation: ev.fermata ? 'fermata' : undefined,
            },
          ];
        }

        notesCount++;
        const mappedPitches = pitches.map(mapPitch);

        const isTied = ev.tie === 'start' || ev.tie === 'continue' ? true : undefined;
        return [
          {
            id: `omr-note-${pIdx}-${mIdx}-${evIdx}`,
            type: 'note',
            pitch: mappedPitches[0],
            pitches: mappedPitches,
            duration,
            isDotted,
            tuplet,
            isTied,
            slur: ev.slur,
            articulation: ev.fermata ? 'fermata' : undefined,
          },
        ];
      });

      const finalItems: ScoreItem[] = items.length
        ? items
        : [
            {
              id: `omr-empty-rest-${pIdx}-${mIdx}`,
              type: 'rest',
              duration: 'w',
              omrPlaceholder: true,
            },
          ];
      if (!items.length)
        warnings.push({
          code: 'empty-measure-placeholder',
          severity: 'error',
          provenance: 'modified',
          src: mIr.events[0]?.src ?? mIr.leftBarline?.src ?? mIr.barline?.src,
          message: `Compás ${mIdx + 1} sin eventos representables: el silencio mostrado es un marcador del editor, no música reconocida.`,
        });

      let barline: BarlineType | undefined = undefined;
      const repeatStart =
        carryRepeatStart || ['repeat-start', 'repeat-both'].includes(mIr.leftBarline?.type ?? '')
          ? true
          : undefined;
      let repeatEnd: boolean | undefined = undefined;
      carryRepeatStart = false;

      const bType = mIr.barline?.type;
      if (
        bType &&
        ![
          'regular',
          'double',
          'final',
          'repeat-start',
          'repeat-end',
          'final-repeat-end',
          'repeat-both',
        ].includes(bType)
      ) {
        warnings.push({
          code: 'unsupported-barline',
          severity: 'warning',
          provenance: 'unsupported',
          src: mIr.barline?.src,
          message: `Barra ${bType} conservada en el IR; su estilo no se representa en el editor.`,
        });
      }
      if (bType === 'double') barline = 'double';
      else if (bType === 'final') barline = 'final';
      else if (bType === 'repeat-start') carryRepeatStart = true;
      else if (bType === 'repeat-end' || bType === 'final-repeat-end') {
        repeatEnd = true;
        if (bType === 'final-repeat-end') barline = 'final';
      } else if (bType === 'repeat-both') {
        repeatEnd = true;
        carryRepeatStart = true;
      }

      const localTime = mIr.attributes?.time;
      const timeSignatureChange: TimeSignature | undefined =
        localTime &&
        (mIdx > 0 ||
          localTime.num !== timeSignature.beats ||
          localTime.den !== timeSignature.beatType) &&
        localTime.num >= 1 &&
        localTime.num <= 16 &&
        [2, 4, 8, 16].includes(localTime.den)
          ? { beats: localTime.num, beatType: localTime.den }
          : undefined;
      if (
        localTime &&
        (localTime.num < 1 || localTime.num > 16 || ![2, 4, 8, 16].includes(localTime.den))
      )
        warnings.push({
          code: 'unsupported-time',
          severity: 'warning',
          provenance: 'unsupported',
          src: mIr.attributeEvents?.find((e) => e.time)?.src,
          message: 'Métrica local no representable: conservada en el IR para revisión.',
        });
      const localFifths = mIr.attributes?.keyFifths;
      if (localFifths !== undefined && !FIFTHS_TO_MAJOR[localFifths])
        warnings.push({
          code: 'unsupported-key',
          severity: 'warning',
          provenance: 'unsupported',
          src: mIr.attributeEvents?.find((e) => e.keyFifths !== undefined)?.src,
          message: 'Armadura fuera del rango representable: conservada en el IR para revisión.',
        });

      const isLastMeasureOfSystem =
        mIdx === part.measures.length - 1 ||
        part.measures[mIdx + 1]?.system !== mIr.system ||
        part.measures[mIdx + 1]?.page !== mIr.page;

      return {
        id: `omr-meas-${pIdx}-${mIdx}`,
        items: finalItems,
        barline,
        repeatStart,
        repeatEnd,
        timeSignatureChange,
        keySignatureChange:
          localFifths !== undefined && (mIdx > 0 || FIFTHS_TO_MAJOR[localFifths] !== initialKey)
            ? FIFTHS_TO_MAJOR[localFifths]
            : undefined,
        pageBreak:
          mIdx < part.measures.length - 1 && part.measures[mIdx + 1]?.page !== mIr.page
            ? true
            : undefined,
        systemBreak: isLastMeasureOfSystem ? true : undefined,
      };
    });

    const measures = rawMeasures;

    const stream = measures.flatMap((m) => m.items);
    const pitchKey = (item: ScoreItem) =>
      (item.pitches ?? (item.pitch ? [item.pitch] : []))
        .map((p) => `${p.step}/${p.octave}/${p.accidental === 'n' ? '' : (p.accidental ?? '')}`)
        .sort()
        .join('|');
    const itemsById = new Map(stream.map((item) => [item.id, item]));
    const sourceStream = part.measures.flatMap((m, mi) =>
      m.events.map((event, ei) => ({
        event,
        item: itemsById.get(`omr-${event.kind}-${pIdx}-${mi}-${ei}`),
      }))
    );
    sourceStream.forEach(({ item, event }, index) => {
      if (!item?.isTied) return;
      const next = sourceStream[index + 1]?.item;
      if (
        next?.type === 'note' &&
        (item.pitches?.length ?? 1) === 1 &&
        pitchKey(item) === pitchKey(next)
      )
        return;
      item.isTied = undefined;
      warnings.push({
        code: 'invalid-tie',
        severity: 'warning',
        provenance: 'unsupported',
        src: event?.src,
        tokens: event?.tokens,
        message:
          'Ligadura sin continuación adyacente de todas las alturas en la misma voz; relación conservada en el IR para revisión.',
      });
    });

    const clef = explicitClef ?? 'treble';
    if (!explicitClef)
      warnings.push({
        code: 'estimated-clef',
        severity: 'warning',
        provenance: 'inferred',
        message: `Parte ${pIdx + 1}: clave no reconocida; se usa Sol provisionalmente. El registro sugiere ${inferClefFromItems(measures) === 'bass' ? 'Fa' : 'Sol'}, requiere confirmación.`,
      });
    return {
      id: `staff-omr-${pIdx + 1}`,
      name: part.label || `Pentagrama ${pIdx + 1}`,
      clef,
      measures:
        measures.length > 0
          ? measures
          : [
              {
                id: `omr-meas-${pIdx}-0`,
                items: [{ id: `omr-rest-${pIdx}-0-0`, type: 'rest', duration: 'w' }],
              },
            ],
    };
  });

  if (staves.length === 0) {
    staves.push({
      id: 'staff-omr-1',
      name: 'Voz / Melodía',
      clef: 'treble',
      measures: [
        {
          id: 'omr-meas-0-0',
          items: [{ id: 'omr-rest-0-0-0', type: 'rest', duration: 'w' }],
        },
      ],
    });
  }

  const maxMeasures = Math.max(1, ...staves.map((s) => s.measures.length));
  if (staves.some((s) => s.measures.length !== maxMeasures))
    warnings.push({
      code: 'part-alignment-uncertain',
      severity: 'warning',
      provenance: 'inferred',
      message:
        'Las partes tienen distintos números de compases; no se añaden silencios para aparentar una alineación confirmada.',
    });

  const preliminaryScore: Score = {
    id: `score-omr-${Date.now()}`,
    title: hints.title?.trim() || 'Partitura Reconocida (OMR)',
    subtitle: hints.subtitle?.trim() || undefined,
    composer: hints.composer?.trim() || 'Autor Desconocido',
    lyricist: hints.lyricist?.trim() || undefined,
    arranger: hints.arranger?.trim() || undefined,
    partName: hints.partName?.trim() || undefined,
    copyright: hints.copyright?.trim() || undefined,
    tempo: hints.tempo && hints.tempo >= 30 && hints.tempo <= 300 ? hints.tempo : 120,
    timeSignature,
    keySignature: initialKey,
    staves,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const detectedKeyInfo = detectKeyFromScore(preliminaryScore);
  if (detectedKeyInfo.key !== preliminaryScore.keySignature)
    warnings.push({
      code: 'key-suggestion',
      severity: 'warning',
      provenance: 'inferred',
      message: `El análisis tonal sugiere ${detectedKeyInfo.key}; no reemplaza la armadura ${preliminaryScore.keySignature}.`,
    });

  const normalized = normalizeScore(preliminaryScore) ?? preliminaryScore;
  const indicationPlans = planOmrIndications(ir, normalized);
  const mapped = applyOmrIndications(normalized, ir, indicationPlans);
  for (const plan of indicationPlans.filter((entry) => entry.status === 'suggested')) {
    const indication = ir.indications?.find((entry) => entry.id === plan.id);
    warnings.push({
      code: 'indication-anchor-uncertain',
      severity: 'warning',
      provenance: 'inferred',
      src: indication?.src,
      message: `Indicación ${indication?.text ?? indication?.kind ?? plan.id}: ${plan.reason}`,
    });
  }

  const rawLinks: OmrSourceLink[] = ir.parts.flatMap((part, sourcePart) =>
    part.measures.flatMap((measure, sourceMeasure) =>
      measure.events.map((event, sourceEvent) => {
        const itemId = `omr-${event.kind}-${sourcePart}-${sourceMeasure}-${sourceEvent}`;
        return {
          sourcePart,
          sourceMeasure,
          sourceEvent,
          src: event.src,
          staffId: null,
          measureId: null,
          itemId,
        };
      })
    )
  );

  const sourceLinks = refreshOmrSourceLinks(mapped, rawLinks);
  const analysis = inspectOmrMeasures(mapped, sourceLinks);
  warnings.push(...analysis.warnings);

  const avgConf =
    confidences.length > 0
      ? Math.round((confidences.reduce((acc, v) => acc + v, 0) / confidences.length) * 100)
      : 0;

  return {
    score: mapped,
    indicationPlans,
    metadataHints: hints,
    warnings,
    proposals: analysis.proposals,
    report: {
      sourceEvents: sourceLinks.length,
      representedEvents: sourceLinks.filter((link) => link.measureId !== null).length,
      pendingEvents: sourceLinks.filter((link) => link.measureId === null).length,
      unparseableRecords: ir.warnings.filter((warning) => warning.code === 'unparseable-tokens')
        .length,
    },
    sourceLinks,
    averageConfidence: Math.max(0, Math.min(100, avgConf)),
    measuresCount: maxMeasures,
    notesCount,
    stavesCount: staves.length,
  };
}
