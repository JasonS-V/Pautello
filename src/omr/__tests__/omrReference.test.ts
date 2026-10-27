import { describe, expect, it } from 'vitest';
import { checkReference, type MusicalReference } from '../../../scripts/omr-reference-check';

function reference(): MusicalReference {
  return {
    version: 1,
    id: 'synthetic-control',
    source: { sha256: '0'.repeat(64), raster: { width: 100, height: 100 } },
    timeSignature: [3, 4],
    review: { visualPasses: 0, audition: false, approved: false },
    systems: [
      {
        number: 1,
        page: 1,
        measures: [
          {
            index: 0,
            number: 1,
            printedNumber: null,
            events: [
              {
                id: 'note',
                pitch: 'C3',
                accidental: null,
                duration: [1, 2],
                dots: 1,
                position: [30, 50],
              },
            ],
          },
        ],
      },
    ],
    directions: [],
  };
}

describe('referencia musical independiente', () => {
  it('cuenta eventos sin confundir una referencia sin aprobar con exactitud', () => {
    expect(checkReference(reference())).toMatchObject({
      systems: 1,
      measures: 1,
      notes: 1,
      rests: 0,
      status: 'draft',
    });
  });

  it('admite el compás incompleto solo si se declara sin completarlo', () => {
    const data = reference();
    const measure = data.systems[0].measures[0];
    measure.events[0].dots = 0;
    expect(() => checkReference(data)).toThrow(/incompleto/);
    measure.incompleteReason = 'Dos tiempos impresos en un compás de tres';
    expect(checkReference(data).incompleteMeasures).toEqual([1]);
    expect(measure.events).toHaveLength(1);
  });

  it('rechaza sobrecarga aunque se declare compás incompleto', () => {
    const data = reference();
    const measure = data.systems[0].measures[0];
    measure.incompleteReason = 'No debe permitir sobrecargas';
    measure.events[0].duration = [1, 1];
    expect(() => checkReference(data)).toThrow(/sobrecargado/);
  });

  it('usa cambios locales de métrica en la comprobación rítmica', () => {
    const data = reference();
    data.systems[0].measures[0].timeSignature = [4, 4];
    data.systems[0].measures[0].events[0].duration = [1, 1];
    data.systems[0].measures[0].events[0].dots = 0;
    expect(checkReference(data).measures).toBe(1);
  });

  it('rechaza ligaduras sin destino inmediato del mismo tono', () => {
    const data = reference();
    data.systems[0].measures[0].events[0].tieTo = 'missing';
    expect(() => checkReference(data)).toThrow(/Ligadura/);
  });

  it('conserva una ligadura aunque el destino no repita el accidental impreso', () => {
    const data = reference();
    const measure = data.systems[0].measures[0];
    const first = measure.events[0];
    first.duration = [1, 4];
    first.dots = 0;
    first.accidental = '#';
    first.tieTo = 'continuation';
    measure.events.push({
      ...first,
      id: 'continuation',
      accidental: null,
      duration: [1, 2],
      tieTo: undefined,
    });
    expect(checkReference(data).ties).toBe(1);
  });

  it('rechaza IDs duplicados y posiciones fuera del raster', () => {
    const data = reference();
    const measure = data.systems[0].measures[0];
    measure.events = [measure.events[0], { ...measure.events[0] }];
    measure.timeSignature = [6, 4];
    expect(() => checkReference(data)).toThrow(/duplicado/);
    measure.events[1].id = 'other';
    measure.events[1].position = [101, 50];
    expect(() => checkReference(data)).toThrow(/Posición/);
  });

  it('rechaza saltos a destinos ausentes', () => {
    const data = reference();
    data.directions.push({ id: 'ds', kind: 'ds-al-coda', measure: 1, targetId: 'missing' });
    expect(() => checkReference(data)).toThrow(/Destino/);
  });

  it('comprueba el anclaje de un calderón al evento y el tipo de destino D.S.', () => {
    const data = reference();
    data.directions.push({ id: 'fermata', kind: 'fermata', measure: 1, eventId: 'missing' });
    expect(() => checkReference(data)).toThrow(/Evento de indicación/);
    data.directions = [
      { id: 'ds', kind: 'ds-al-coda', measure: 1, targetId: 'coda' },
      { id: 'coda', kind: 'coda', measure: 1 },
    ];
    expect(() => checkReference(data)).toThrow(/Destino D.S. incompatible/);
  });

  it('exige audición, cero pendientes y función del compás inicial para aprobar una referencia', () => {
    const data = reference();
    data.review = { visualPasses: 2, audition: false, approved: true };
    expect(() => checkReference(data)).toThrow(/aprobada/);
    data.review = { visualPasses: 2, audition: true, approved: true, pending: ['revisar'] };
    expect(() => checkReference(data)).toThrow(/aprobada/);
    data.review = { visualPasses: 2, audition: true, approved: true, pending: [] };
    const measure = data.systems[0].measures[0];
    measure.events[0].dots = 0;
    measure.incompleteReason = 'Compás de anacrusa';
    expect(() => checkReference(data)).toThrow(/función musical/);
    data.review.initialMeasureRole = 'pickup-counted-as-measure-1';
    expect(checkReference(data).status).toBe('reviewed');
  });
});
