import assert from 'node:assert/strict';

export interface ReferenceEvent {
  id: string;
  pitch: string | null;
  accidental: '#' | 'b' | 'n' | null;
  duration: [number, number];
  dots: number;
  position: [number, number];
  tieTo?: string;
}

export interface ReferenceMeasure {
  index: number;
  number: number;
  printedNumber: number | null;
  timeSignature?: [number, number];
  incompleteReason?: string;
  events: ReferenceEvent[];
}

export interface MusicalReference {
  version: number;
  id: string;
  source: {
    path?: string;
    sha256: string;
    raster: { path?: string; sha256?: string; width: number; height: number };
  };
  timeSignature: [number, number];
  review: {
    visualPasses: number;
    audition: boolean;
    approved: boolean;
    pending?: string[];
    initialMeasureRole?: string;
  };
  systems: { number: number; page: number; measures: ReferenceMeasure[] }[];
  directions: {
    id: string;
    kind: string;
    measure: number;
    targetId?: string;
    eventId?: string;
    codaExitId?: string;
  }[];
}

export function checkReference(reference: MusicalReference) {
  assert.equal(reference.version, 1, 'Versión de referencia no admitida');
  assert(
    reference.id && /^[a-f0-9]{64}$/.test(reference.source.sha256),
    'Falta identidad/hash de la fuente'
  );
  const { width, height } = reference.source.raster;
  assert(width > 0 && height > 0, 'Raster inválido');
  assert(reference.systems.length > 0, 'Referencia sin sistemas');
  for (const [index, system] of reference.systems.entries()) {
    assert(
      system.number === index + 1 &&
        Number.isInteger(system.page) &&
        system.page > 0 &&
        system.measures.length > 0,
      'Sistema inválido'
    );
    if (index) assert(system.page >= reference.systems[index - 1].page, 'Páginas fuera de orden');
  }
  const measures = reference.systems.flatMap((system) => system.measures);
  const events = measures.flatMap((measure) => measure.events);
  assert(measures.length > 0 && events.length > 0, 'Referencia sin eventos');
  const ids = new Set<string>();
  let meter = reference.timeSignature;
  const incompleteMeasures: number[] = [];
  for (const [index, measure] of measures.entries()) {
    assert(
      measure.index === index && measure.number === index + 1,
      'Índice/numeración no consecutiva'
    );
    assert(
      measure.printedNumber === null || measure.printedNumber === measure.number,
      'Número impreso discrepante'
    );
    meter = measure.timeSignature ?? meter;
    assert(
      Number.isInteger(meter[0]) && meter[0] > 0 && [1, 2, 4, 8, 16, 32].includes(meter[1]),
      'Métrica inválida'
    );
    let beats = 0;
    for (const event of measure.events) {
      assert(event.id && !ids.has(event.id), `ID duplicado: ${event.id}`);
      ids.add(event.id);
      assert(
        event.pitch === null || /^[A-G][0-8]$/.test(event.pitch),
        `Altura inválida: ${event.id}`
      );
      assert([null, '#', 'b', 'n'].includes(event.accidental), `Alteración inválida: ${event.id}`);
      assert(
        event.pitch !== null || event.accidental === null,
        `Silencio con alteración: ${event.id}`
      );
      assert(
        event.duration[0] === 1 && [1, 2, 4, 8, 16, 32].includes(event.duration[1]),
        `Duración inválida: ${event.id}`
      );
      assert([0, 1, 2].includes(event.dots), `Puntillos inválidos: ${event.id}`);
      const [x, y] = event.position;
      assert(
        x >= 0 && x <= width && y >= 0 && y <= height,
        `Posición fuera del raster: ${event.id}`
      );
      beats += ((4 * event.duration[0]) / event.duration[1]) * (2 - 2 ** -event.dots);
    }
    const capacity = (4 * meter[0]) / meter[1];
    assert(beats <= capacity, `Compás ${measure.number} sobrecargado: ${beats}/${capacity}`);
    if (beats < capacity) {
      assert(
        measure.incompleteReason?.trim(),
        `Compás ${measure.number} incompleto sin explicación`
      );
      incompleteMeasures.push(measure.number);
    } else
      assert(
        !measure.incompleteReason,
        `Compás ${measure.number} completo marcado como incompleto`
      );
  }
  for (const [index, event] of events.entries()) {
    if (!event.tieTo) continue;
    const next = events[index + 1];
    assert(
      next && event.pitch !== null && next.id === event.tieTo && next.pitch === event.pitch,
      `Ligadura inválida: ${event.id}`
    );
    if (event.accidental !== null && next.accidental !== null) {
      assert(
        next.accidental === event.accidental,
        `Ligadura con alteraciones incompatibles: ${event.id}`
      );
    }
  }
  for (const direction of reference.directions) {
    assert(direction.id && !ids.has(direction.id), `ID duplicado: ${direction.id}`);
    ids.add(direction.id);
    assert(
      measures.some((measure) => measure.number === direction.measure),
      `Indicación fuera de compás: ${direction.id}`
    );
    if (direction.eventId)
      assert(
        measures[direction.measure - 1].events.some((event) => event.id === direction.eventId),
        `Evento de indicación ausente: ${direction.id}`
      );
  }
  for (const direction of reference.directions) {
    if (direction.targetId) {
      const target = reference.directions.find((target) => target.id === direction.targetId);
      assert(target, `Destino ausente: ${direction.id}`);
      if (direction.kind === 'ds-al-coda')
        assert(target.kind === 'segno', `Destino D.S. incompatible: ${direction.id}`);
      if (direction.kind === 'to-coda')
        assert(target.kind === 'coda', `Destino coda incompatible: ${direction.id}`);
    }
    if (direction.codaExitId)
      assert(
        reference.directions.some(
          (target) => target.id === direction.codaExitId && target.kind === 'to-coda'
        ),
        `Salida a coda ausente: ${direction.id}`
      );
  }
  const hasPending = (reference.review.pending?.length ?? 0) > 0;
  if (reference.review.approved) {
    assert(
      reference.review.visualPasses >= 2 && reference.review.audition && !hasPending,
      'Una referencia aprobada requiere al menos dos pasadas visuales, audición y cero pendientes'
    );
    if (incompleteMeasures.includes(1)) {
      assert(
        reference.review.initialMeasureRole?.trim(),
        'Una referencia aprobada con compás inicial incompleto debe declarar su función musical'
      );
    }
  }
  const reviewed =
    reference.review.visualPasses >= 2 &&
    reference.review.audition &&
    reference.review.approved &&
    !hasPending;
  return {
    id: reference.id,
    status: reviewed ? 'reviewed' : 'draft',
    systems: reference.systems.length,
    measures: measures.length,
    events: events.length,
    notes: events.filter((event) => event.pitch !== null).length,
    rests: events.filter((event) => event.pitch === null).length,
    ties: events.filter((event) => event.tieTo).length,
    directions: reference.directions.length,
    incompleteMeasures,
  };
}
